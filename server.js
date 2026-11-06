#!/usr/bin/env node
/*
 * Cifra server — serves the static site plus a SQLite-backed song library.
 * Zero dependencies; needs Node 22+ (node:sqlite).
 *
 *   node server.js                → http://localhost:8765
 *   PORT=9000 node server.js      → custom port
 *   CIFRA_TOKEN=s3cret node …     → /api requires "Authorization: Bearer s3cret"
 *   CIFRA_DB=/path/cifra.db …     → sqlite file location (default ./cifra.db)
 *
 * Without this server (static hosting, file://), the site still works —
 * the song library then falls back to per-browser IndexedDB.
 */
'use strict';
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');

const PORT=Number(process.env.PORT||process.argv[2]||8765);
const TOKEN=process.env.CIFRA_TOKEN||'';
const DB_FILE=process.env.CIFRA_DB||path.join(__dirname,'cifra.db');
const ROOT=__dirname;

const db=new DatabaseSync(DB_FILE);
db.exec(`CREATE TABLE IF NOT EXISTS songs(
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  title  TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  raw    TEXT NOT NULL,
  saved  INTEGER NOT NULL
)`);

const TYPES={
  '.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript',
  '.json':'application/json','.txt':'text/plain; charset=utf-8',
  '.ico':'image/x-icon','.md':'text/markdown; charset=utf-8'
};

function send(res,status,body,type){
  res.writeHead(status,{
    'Content-Type':type||'text/plain; charset=utf-8',
    'Content-Length':Buffer.byteLength(body)
  });
  res.end(body);
}
const sendJSON=(res,status,obj)=>send(res,status,JSON.stringify(obj),'application/json; charset=utf-8');

function readBody(req){
  return new Promise((res,rej)=>{
    let size=0; const chunks=[];
    req.on('data',c=>{
      size+=c.length;
      if(size>2*1024*1024){rej(new Error('body too large'));req.destroy();}
      else chunks.push(c);
    });
    req.on('end',()=>res(Buffer.concat(chunks).toString('utf8')));
    req.on('error',rej);
  });
}
async function readJSON(req){
  const text=await readBody(req).catch(()=>null);
  if(text==null)return null;
  try{return JSON.parse(text);}catch(e){return null;}
}
function songFromBody(o){
  if(!o||typeof o!=='object')return null;
  const title=typeof o.title==='string'&&o.title.trim()?o.title.slice(0,200):'Untitled chart';
  const artist=typeof o.artist==='string'?o.artist.slice(0,200):'';
  const raw=typeof o.raw==='string'?o.raw.slice(0,1024*1024):'';
  const saved=Number(o.saved)||Date.now();
  return raw.trim()?{title,artist,raw,saved}:null;
}
const FIELDS='id,title,artist,raw,saved';
const byId=id=>db.prepare(`SELECT ${FIELDS} FROM songs WHERE id=?`).get(id);

/* Page fetch for "paste a URL" tab import. Browsers can't scrape cross-origin,
   so the server fetches the page and hands the HTML (minus scripts/styles) to
   the client, which knows how to parse it. */
const FETCH_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IMPORT_CAP=5*1024*1024;
async function handleImport(req,res){
  let target;
  try{
    target=new URL(req.url||'','http://x').searchParams.get('url')||'';
    const u=new URL(target);
    if(u.protocol!=='http:'&&u.protocol!=='https:')throw new Error('bad protocol');
  }catch(e){return sendJSON(res,400,{error:'url must be http(s)'});}
  try{
    const r=await fetch(target,{
      headers:{'User-Agent':FETCH_UA,'Accept':'text/html'},
      redirect:'follow',signal:AbortSignal.timeout(10000)
    });
    /* read up to IMPORT_CAP, then drop the rest */
    let html='';
    if(r.body){
      const reader=r.body.getReader(); let size=0, chunks=[];
      while(size<IMPORT_CAP){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.length; chunks.push(value);
      }
      if(size>=IMPORT_CAP)reader.cancel().catch(()=>{});
      html=Buffer.concat(chunks.slice(0, chunks.length)).toString('utf8').slice(0,IMPORT_CAP);
    }else html=await r.text();
    html=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
    sendJSON(res,200,{url:r.url,status:r.status,html});
  }catch(e){sendJSON(res,502,{error:'fetch failed: '+String(e.message||e)});}
}

async function handleApi(req,res,pathname){
  if(TOKEN&&req.headers.authorization!=='Bearer '+TOKEN)
    return sendJSON(res,401,{error:'unauthorized'});

  if(req.method==='GET'&&pathname==='/api/import')
    return handleImport(req,res).catch(e=>sendJSON(res,500,{error:String(e.message||e)}));

  const idm=pathname.match(/^\/api\/songs\/(\d+)$/);
  if(req.method==='GET'&&pathname==='/api/songs')
    return sendJSON(res,200,db.prepare(`SELECT ${FIELDS} FROM songs ORDER BY saved DESC, id DESC`).all());

  if(req.method==='POST'&&pathname==='/api/songs'){
    const s=songFromBody(await readJSON(req));
    if(!s)return sendJSON(res,400,{error:'invalid song'});
    const r=db.prepare('INSERT INTO songs (title,artist,raw,saved) VALUES (?,?,?,?)')
      .run(s.title,s.artist,s.raw,s.saved);
    return sendJSON(res,201,byId(r.lastInsertRowid));
  }
  if(idm&&(req.method==='PUT'||req.method==='PATCH')){
    const s=songFromBody(await readJSON(req));
    if(!s)return sendJSON(res,400,{error:'invalid song'});
    const r=db.prepare('UPDATE songs SET title=?,artist=?,raw=?,saved=? WHERE id=?')
      .run(s.title,s.artist,s.raw,s.saved,Number(idm[1]));
    if(!r.changes)return sendJSON(res,404,{error:'not found'});
    return sendJSON(res,200,byId(Number(idm[1])));
  }
  if(idm&&req.method==='DELETE'){
    const r=db.prepare('DELETE FROM songs WHERE id=?').run(Number(idm[1]));
    return r.changes?send(res,204,''):sendJSON(res,404,{error:'not found'});
  }
  sendJSON(res,404,{error:'no such endpoint'});
}

async function serveStatic(res,pathname){
  const rel=pathname==='/'?'/index.html':pathname;
  const file=path.join(ROOT,path.normalize(rel).replace(/^(\.\.[\/\\])+/,''));
  if(!file.startsWith(ROOT))return send(res,403,'Forbidden');
  try{
    const data=await readFile(file);
    res.writeHead(200,{
      'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream',
      'Content-Length':data.length
    });
    res.end(data);
  }catch(e){ send(res,404,'Not found'); }
}

createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  if(pathname.startsWith('/api/'))
    handleApi(req,res,pathname).catch(e=>sendJSON(res,500,{error:String(e.message||e)}));
  else
    serveStatic(res,pathname).catch(e=>sendJSON(res,500,'Server error'));
}).listen(PORT,()=>{
  console.log(`cifra · http://localhost:${PORT} · library: ${DB_FILE}${TOKEN?' (token required)':''}`);
});
