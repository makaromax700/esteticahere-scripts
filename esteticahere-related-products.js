/* Estetica Here — связанные товары по одинаковому названию, v2.0 */
(function(){
'use strict';
if(window.__estRelatedV2)return;
window.__estRelatedV2=true;
const OPT={storepartuid:'623465384892',recid:'4927596801',batch:500,maxPages:12,cacheMs:5*60*1000};
const API='https://store.tildaapi.com/api/getproductslist/';
const CACHE='est-related-v2:'+OPT.storepartuid;
const state=window.estRelatedProducts={status:'loading',products:0,groups:0,links:0,source:'',error:'',version:'2.0',refresh:refresh};
let products=[],byId=new Map(),byTitle=new Map(),urls=new Map(),ready=false,running=false,pending=false;
const clean=s=>String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('ru-RU');
const idOf=p=>clean(p.uid||p.id||p.productuid||p.productUid||p.genuid||p.product_gen_uid||'');
const titleOf=p=>clean(p.title||p.name||p.producttitle||p.productTitle||'');
function sameOriginLink(url){
try{const u=new URL(url,location.origin);if(['http:','https:'].includes(u.protocol)&&u.origin===location.origin&&/\/tproduct\/\d+/.test(u.pathname))return u.href;}catch(e){}
return '';
}
function imageOf(p){
let imgs=p.gallery||p.images||p.photos||p.photo||p.image||p.img||[];
if(typeof imgs==='string'){try{const v=JSON.parse(imgs);imgs=v;}catch(e){return /^https?:\/\//i.test(imgs)?imgs:'';}}
if(Array.isArray(imgs)&&imgs.length){const x=imgs[0];return typeof x==='string'?x:clean(x&&((x.img||x.src||x.url||x.image)||''));}
if(imgs&&typeof imgs==='object')return clean(imgs.img||imgs.url||imgs.src||'');
return '';
}
function extractProducts(data){
if(Array.isArray(data))return data;
for(const v of [data&&data.products,data&&data.data&&data.data.products,data&&data.result&&data.result.products])if(Array.isArray(v))return v;
return [];
}
async function fetchJSON(url){
const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
try{const res=await fetch(url,{credentials:'omit',mode:'cors',signal:ctrl.signal});if(!res.ok)throw Error('HTTP '+res.status);return await res.json();}finally{clearTimeout(timer);}
}
async function catalog(){
const all=[],seen=new Set();let slice=1;
for(let n=0;n<OPT.maxPages;n++){
const u=new URL(API);[['storepartuid',OPT.storepartuid],['recid',OPT.recid],['getparts','true'],['getoptions','true'],['slice',slice],['size',OPT.batch]].forEach(([k,v])=>u.searchParams.set(k,String(v)));
const data=await fetchJSON(u.toString());const batch=extractProducts(data);
if(!batch.length)break;
let added=0;for(const p of batch){const id=idOf(p);if(id&&!seen.has(id)){all.push(p);seen.add(id);added++;}}
if(!added||batch.length<OPT.batch)break;
const raw=data&&((data.nextslice??data.nextSlice)??(data.data&&data.data.nextslice));
const next=Number(raw);slice=Number.isFinite(next)&&next>slice?next:slice+1;
}
if(!all.length)throw Error('Каталог вернул пустой список');
return all;
}
async function sitemap(){
try{
const res=await fetch('/sitemap-store.xml',{credentials:'same-origin',cache:'no-cache'});if(!res.ok)return new Map();
const xml=new DOMParser().parseFromString(await res.text(),'text/xml');if(xml.querySelector('parsererror'))return new Map();
const found=new Map();xml.querySelectorAll('loc').forEach(el=>{const u=sameOriginLink(el.textContent);if(!u)return;const m=new URL(u).pathname.match(/\/tproduct\/(\d+)/);if(m)found.set(m[1],u);});return found;
}catch(e){return new Map();}
}
function apply(raw,source,sitemapUrls){
products=[];byId=new Map();byTitle=new Map();urls=sitemapUrls||new Map();
for(const p of raw){const id=idOf(p),title=titleOf(p);if(!/^\d+$/.test(id)||!title||byId.has(id))continue;
const item={id,title,image:imageOf(p),url:sameOriginLink(p.url||p.product_url||p.productUrl||p.href||p.link||'')||urls.get(id)||''};
products.push(item);byId.set(id,item);const key=norm(title);if(!byTitle.has(key))byTitle.set(key,[]);byTitle.get(key).push(item);
}
state.products=products.length;state.groups=[...byTitle.values()].filter(a=>a.length>1).length;state.links=products.filter(p=>p.url).length;state.source=source;state.error='';state.status='ready';ready=true;queue();
}
function fromCache(){
try{const c=JSON.parse(sessionStorage.getItem(CACHE)||'null');if(c&&Date.now()-c.ts<OPT.cacheMs&&Array.isArray(c.data)&&c.data.length){apply(c.data,'session-cache',new Map(c.urls||[]));return true;}}catch(e){}
return false;
}
async function load(force){
if(running)return;
if(!force&&ready)return;
if(!force&&fromCache())return;
running=true;state.status='loading';
try{
const results=await Promise.allSettled([catalog(),sitemap()]);
if(results[0].status!=='fulfilled')throw results[0].reason;
const raw=results[0].value;const links=results[1].status==='fulfilled'?results[1].value:new Map();
apply(raw,'tilda-api',links);
try{sessionStorage.setItem(CACHE,JSON.stringify({ts:Date.now(),data:raw,urls:[...links]}));}catch(e){}
}catch(e){state.status='error';state.error=String(e&&e.message||e);console.warn('[Estetica related] Не удалось загрузить каталог:',e);}finally{running=false;}
}
async function refresh(){try{sessionStorage.removeItem(CACHE);}catch(e){}ready=false;await load(true);}
function findCurrent(info){
const pageMatch=location.pathname.match(/\/tproduct\/(\d+)/);
if(pageMatch&&byId.has(pageMatch[1]))return byId.get(pageMatch[1]);
const root=info.closest('[data-product-gen-uid],[data-product-uid],[data-product-lid]');
if(root){for(const attr of ['data-product-gen-uid','data-product-uid','data-product-lid']){const id=root.getAttribute(attr);if(byId.has(String(id)))return byId.get(String(id));}}
const titleEl=info.querySelector('.js-store-prod-name,.t-store__prod-popup__name,.t-store__prod-popup__title');
const group=byTitle.get(norm(titleEl&&titleEl.textContent))||[];
if(group.length===1)return group[0];
if(group.length>1){
const popup=info.closest('.t-store__prod-popup,.js-store-product')||info.parentElement;
const gallery=popup&&popup.querySelector('.t-store__prod-popup__gallery-column img,.t-slds__item_active img');
const photo=gallery&&(gallery.getAttribute('data-original')||gallery.src||'');
if(photo){const basename=u=>{try{return new URL(u,location.origin).pathname.split('/').pop().toLowerCase();}catch(e){return '';}};const matches=group.filter(p=>p.image&&basename(p.image)===basename(photo));if(matches.length===1)return matches[0];}
}
return null;
}
function liveHref(id){
let a=document.querySelector('a[href*="/tproduct/'+id+'-"]');if(a)return sameOriginLink(a.href);
const card=document.querySelector('[data-product-gen-uid="'+id+'"],[data-product-uid="'+id+'"]');
if(card){a=card.querySelector('a[href*="/tproduct/"]');if(a)return sameOriginLink(a.href);}
return '';
}
function linkOf(item,current){
if(item.url)return item.url;
const live=liveHref(item.id);if(live)return live;
const m=location.pathname.match(/^(.*\/tproduct\/)(\d+)(-[^/?#]+)\/?$/);
if(m&&current&&m[2]===current.id&&norm(item.title)===norm(current.title))return location.origin+m[1]+item.id+m[3];
return '';
}
function createBlock(current){
const group=byTitle.get(norm(current.title))||[];if(group.length<2)return null;
const section=document.createElement('section');section.className='est-related-v2';section.dataset.currentId=current.id;
const heading=document.createElement('div');heading.className='est-related-v2__heading';heading.textContent='Другие варианты';section.appendChild(heading);
const gallery=document.createElement('div');gallery.className='est-related-v2__items';
for(const p of group){const href=linkOf(p,current);if(!href&&p.id!==current.id)continue;
const a=document.createElement('a');a.className='est-related-v2__item'+(p.id===current.id?' is-current':'');a.href=href||location.href;a.title=p.title;a.setAttribute('aria-label','Вариант '+(group.indexOf(p)+1)+(p.id===current.id?', выбран':'')+(p.id===current.id?'':' — перейти'));
if(p.id===current.id){a.setAttribute('aria-current','page');a.addEventListener('click',e=>e.preventDefault());}
if(p.image){const im=document.createElement('img');im.src=p.image;im.alt=p.title+' — вариант '+(group.indexOf(p)+1);im.loading='lazy';a.appendChild(im);}else{const ph=document.createElement('span');ph.className='est-related-v2__placeholder';a.appendChild(ph);}
gallery.appendChild(a);
}
if(gallery.children.length<2)return null;section.appendChild(gallery);return section;
}
function render(){
if(!ready)return;
const infos=document.querySelectorAll('.t-store__prod-popup__info');
infos.forEach(info=>{
const item=findCurrent(info);const old=info.querySelector('.est-related-v2');
if(!item){if(old)old.remove();return;}
if(old&&old.dataset.currentId===item.id)return;
if(old)old.remove();const block=createBlock(item);if(!block)return;
const desc=info.querySelector('.t-store__prod-popup__text,.js-store-prod-descr');
const btn=info.querySelector('.t-store__prod-popup__btn-wrapper');
const anchor=desc||btn;
if(anchor&&anchor.parentNode===info)info.insertBefore(block,anchor);
else if(anchor)anchor.insertAdjacentElement('beforebegin',block);
else info.appendChild(block);
});
}
function queue(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render();});}
function addCSS(){
if(document.getElementById('est-related-v2-css'))return;
const s=document.createElement('style');s.id='est-related-v2-css';s.textContent='.est-related-v2{margin:20px 0 26px;color:#563827;font-family:inherit}.est-related-v2__heading{margin:0 0 12px;font-size:16px;font-weight:500}.est-related-v2__items{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px}.est-related-v2__item{display:block;box-sizing:border-box;width:76px;height:96px;flex:0 0 76px;border:2px solid transparent;text-decoration:none!important;background:#e8e5e2;transition:border-color .2s,opacity .2s}.est-related-v2__item.is-current{border-color:#563827}.est-related-v2__item:hover{opacity:.75}.est-related-v2__item:focus-visible{outline:2px solid #9e392f;outline-offset:3px}.est-related-v2__item img,.est-related-v2__placeholder{display:block;width:100%;height:100%;object-fit:cover;background:#e8e5e2}@media(max-width:639px){.est-related-v2__items{gap:9px}.est-related-v2__item{width:68px;height:86px;flex-basis:68px}.est-related-v2__heading{font-size:14px}}';
(document.head||document.documentElement).appendChild(s);
}
function start(){addCSS();load(false);queue();new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});window.addEventListener('popstate',queue);window.addEventListener('hashchange',queue);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
