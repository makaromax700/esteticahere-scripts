/* Estetica Here — связанные самостоятельные товары по названию, v4.0 */
(function(){
'use strict';
if(window.__estRelatedV4)return;
window.__estRelatedV4=true;
const CFG={storepartuid:'623465384892',recid:'4927596801',pageSize:500,maxPages:12,cacheMs:10*60*1000,timeoutMs:10000};
const API='https://store.tildaapi.com/api/getproductslist/';
const CACHE='est-related-v4:'+CFG.storepartuid;
const INFO='.t-store__prod-popup__info';
const BLOCK='est-related-v4';
const HIDE='est-related-v4-native-hidden';
const ACTIVE='est-related-v4-color-ready';
const state=window.estRelatedProducts={version:'4.0',status:'idle',products:0,groups:0,links:0,source:'',error:'',refresh:refresh};
let byId=new Map(),byTitle=new Map(),loaded=false,inflight=null,queued=false,observer=null,failureUntil=0;
const clean=s=>String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('ru-RU');
const productId=p=>clean(p.uid||p.id||p.productuid||p.productUid||p.genuid||p.product_gen_uid||'');
const productName=p=>clean(p.title||p.name||p.producttitle||p.productTitle||'');
function goodLink(input,id){
if(!input)return '';
try{
const url=new URL(input,location.origin);
if(!['http:','https:'].includes(url.protocol)||url.origin!==location.origin)return '';
const match=url.pathname.match(/\/tproduct\/(\d+)(?:-|\/|$)/);
return match&&match[1]===String(id)?url.href:'';
}catch(e){return '';}
}
function goodImage(input){
if(typeof input!=='string'||!input.trim())return '';
try{const u=new URL(input,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch(e){return '';}
}
function firstImage(p){
let value=p.gallery||p.images||p.photos||p.photo||p.image||p.img||[];
if(typeof value==='string'){
try{value=JSON.parse(value);}catch(e){return goodImage(value);}
}
if(Array.isArray(value))value=value[0];
if(typeof value==='object'&&value!==null)value=value.img||value.src||value.url||value.image||'';
return goodImage(value);
}
function extract(data){
if(Array.isArray(data))return data;
for(const x of [data&&data.products,data&&data.data&&data.data.products,data&&data.result&&data.result.products])if(Array.isArray(x))return x;
return [];
}
function compact(raw){
const seen=new Set(),all=[],counts=new Map();
raw.forEach(function(p){
const id=productId(p),title=productName(p);
if(!/^\d+$/.test(id)||!title||seen.has(id))return;
seen.add(id);
const item={id:id,title:title,image:firstImage(p),url:goodLink(p.url||p.product_url||p.productUrl||p.href||p.link||'',id)};
all.push(item);
const key=norm(title);counts.set(key,(counts.get(key)||0)+1);
});
return {total:all.length,items:all.filter(x=>counts.get(norm(x.title))>1)};
}
function apply(payload,source){
byId=new Map();byTitle=new Map();
payload.items.forEach(function(item){
if(!item||!/^\d+$/.test(String(item.id))||!item.title)return;
const entry={id:String(item.id),title:clean(item.title),image:goodImage(item.image),url:goodLink(item.url,item.id)};
const key=norm(entry.title);byId.set(entry.id,entry);
if(!byTitle.has(key))byTitle.set(key,[]);
byTitle.get(key).push(entry);
});
state.products=payload.total;
state.groups=byTitle.size;
state.links=[...byId.values()].filter(p=>p.url).length;
state.source=source;state.error='';state.status='ready';loaded=true;failureUntil=0;
schedule();
}
function cached(){
try{
const entry=JSON.parse(sessionStorage.getItem(CACHE)||'null');
if(entry&&entry.version===4&&Date.now()-entry.ts<CFG.cacheMs&&Array.isArray(entry.items)&&typeof entry.total==='number')return entry;
}catch(e){}
return null;
}
async function fetchPage(page){
const url=new URL(API);
[['storepartuid',CFG.storepartuid],['recid',CFG.recid],['getparts','true'],['getoptions','true'],['slice',page],['size',CFG.pageSize]].forEach(([k,v])=>url.searchParams.set(k,String(v)));
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),CFG.timeoutMs);
try{
const response=await fetch(url.toString(),{mode:'cors',credentials:'omit',signal:controller.signal});
if(!response.ok)throw new Error('Tilda API HTTP '+response.status);
return await response.json();
}finally{clearTimeout(timeout);}
}
async function fetchCatalog(){
const all=[],seen=new Set();let page=1;
for(let n=0;n<CFG.maxPages;n++){
const data=await fetchPage(page),batch=extract(data);
if(!batch.length)break;
let added=0;
for(const p of batch){const id=productId(p);if(id&&!seen.has(id)){seen.add(id);all.push(p);added++;}}
if(!added||batch.length<CFG.pageSize)break;
const supplied=Number(data&&((data.nextslice??data.nextSlice)??(data.data&&data.data.nextslice)));
if(data&&data.nextslice===false)break;
page=Number.isFinite(supplied)&&supplied>page?supplied:page+1;
}
if(!all.length)throw new Error('Каталог Тильды вернул пустой список');
return compact(all);
}
function getData(force){
if(inflight)return inflight;
if(loaded&&!force)return Promise.resolve();
if(!force&&Date.now()<failureUntil)return Promise.resolve();
if(!force){
const value=cached();
if(value){apply(value,'session-cache');return Promise.resolve();}
}
state.status='loading';
inflight=fetchCatalog().then(function(payload){
apply(payload,'tilda-api');
try{sessionStorage.setItem(CACHE,JSON.stringify({version:4,ts:Date.now(),total:payload.total,items:payload.items}));}catch(e){}
}).catch(function(err){
state.error=String(err&&err.message||err);
state.status='error';failureUntil=Date.now()+60*1000;
console.warn('[Estetica related v4]',state.error);
}).finally(function(){inflight=null;});
return inflight;
}
function refresh(){
try{sessionStorage.removeItem(CACHE);}catch(e){}
loaded=false;return getData(true);
}
function visible(info){
if(!info||!info.isConnected)return false;
if(location.pathname.includes('/tproduct/'))return true;
return !!info.getClientRects().length;
}
function currentItem(info){
const match=location.pathname.match(/\/tproduct\/(\d+)(?:-|\/|$)/);
if(match&&byId.has(match[1]))return byId.get(match[1]);
const root=info.closest('[data-product-gen-uid],[data-product-uid],[data-product-lid]');
if(root)for(const attr of ['data-product-gen-uid','data-product-uid','data-product-lid']){
const id=root.getAttribute(attr);
if(byId.has(String(id)))return byId.get(String(id));
}
const name=info.querySelector('.js-store-prod-name,.t-store__prod-popup__name,.t-store__prod-popup__title');
const group=byTitle.get(norm(name&&name.textContent))||[];
if(group.length===1)return group[0];
if(group.length>1){
const popup=info.closest('.t-store__prod-popup,.js-store-product')||info.parentElement;
const gallery=popup&&popup.querySelector('.t-store__prod-popup__gallery-column img,.t-slds__item_active img');
const img=gallery&&(gallery.getAttribute('data-original')||gallery.src||'');
if(img){
const basename=url=>{try{return new URL(url,location.href).pathname.split('/').pop().toLowerCase();}catch(e){return '';}};
const found=group.filter(x=>x.image&&basename(x.image)===basename(img));
if(found.length===1)return found[0];
}
}
return null;
}
function linkFromDom(id){
const link=document.querySelector('a[href*="/tproduct/'+id+'-"]');
return link?goodLink(link.getAttribute('href'),id):'';
}
function makeBlock(current){
const group=byTitle.get(norm(current.title))||[];
if(group.length<2)return null;
const entries=group.map(function(item){
return {item:item,url:item.url||linkFromDom(item.id)||(item.id===current.id?location.href:'')};
}).filter(x=>x.item.id===current.id||!!goodLink(x.url,x.item.id));
if(entries.length<2)return null;
const section=document.createElement('section');section.className=BLOCK;section.dataset.currentId=current.id;
const label=document.createElement('div');label.className=BLOCK+'__heading';label.textContent='Другие варианты';section.appendChild(label);
const tiles=document.createElement('div');tiles.className=BLOCK+'__items';
entries.forEach(function(x,index){
const a=document.createElement('a');a.className=BLOCK+'__item'+(x.item.id===current.id?' is-current':'');
a.href=x.url;a.title=x.item.title;a.setAttribute('aria-label','Вариант '+(index+1)+(x.item.id===current.id?', выбран':' — открыть товар'));
if(x.item.id===current.id){a.setAttribute('aria-current','page');a.addEventListener('click',e=>e.preventDefault());}
if(x.item.image){const img=document.createElement('img');img.src=x.item.image;img.alt=x.item.title+' — вариант '+(index+1);img.loading='lazy';a.appendChild(img);}
else{const placeholder=document.createElement('span');placeholder.className=BLOCK+'__placeholder';a.appendChild(placeholder);}
tiles.appendChild(a);
});
section.appendChild(tiles);return section;
}
function findColorOption(info){
return [...info.querySelectorAll('.t-product__option')].find(function(el){
const title=el.querySelector('.t-product__option-title');
return title&&/^цвет(?:\s|:|$)/i.test(title.textContent.trim());
})||null;
}
function restore(info){
info.querySelectorAll('.'+ACTIVE).forEach(el=>el.classList.remove(ACTIVE));
info.querySelectorAll('.'+HIDE).forEach(el=>el.classList.remove(HIDE));
}
function mount(info,block){
const option=findColorOption(info);
if(option){
const title=option.querySelector('.t-product__option-title');
option.appendChild(block);
option.classList.add(ACTIVE);
[...option.children].forEach(function(child){
if(child!==block&&child!==title&&!(title&&child.contains(title)))child.classList.add(HIDE);
});
option.querySelectorAll('select,.t-product__option-select').forEach(el=>el.classList.add(HIDE));
return;
}
const anchor=info.querySelector('.t-store__prod-popup__text,.js-store-prod-descr,.t-store__prod-popup__btn-wrapper');
if(anchor)anchor.insertAdjacentElement('beforebegin',block);
else info.appendChild(block);
}
function renderOne(info){
const current=currentItem(info),old=info.querySelector('.'+BLOCK);
if(!current){if(old){old.remove();restore(info);}return;}
if(old&&old.dataset.currentId===current.id){
const opt=findColorOption(info);
if(!opt||old.parentNode===opt)return;
old.remove();restore(info);
}else if(old){old.remove();restore(info);}
const block=makeBlock(current);
if(!block)return;
mount(info,block);
}
function scan(){
const infos=[...document.querySelectorAll(INFO)].filter(visible);
if(!infos.length)return;
if(!loaded){getData(false);return;}
infos.forEach(renderOne);
}
function schedule(){
if(queued)return;queued=true;
requestAnimationFrame(function(){queued=false;scan();});
}
function addCSS(){
if(document.getElementById('est-related-v4-css'))return;
const el=document.createElement('style');el.id='est-related-v4-css';
el.textContent='.est-related-v4{margin:20px 0 26px;color:#563827;font-family:inherit}.est-related-v4__heading{margin:0 0 12px;font-size:16px;font-weight:500}.est-related-v4__items{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px}.est-related-v4__item{display:block;box-sizing:border-box;width:76px;height:96px;flex:0 0 76px;border:2px solid transparent;text-decoration:none!important;background:#e8e5e2;transition:border-color .2s,opacity .2s}.est-related-v4__item.is-current{border-color:#563827}.est-related-v4__item:hover{opacity:.75}.est-related-v4__item:focus-visible{outline:2px solid #9e392f;outline-offset:3px}.est-related-v4__item img,.est-related-v4__placeholder{display:block;width:100%;height:100%;object-fit:cover;background:#e8e5e2}.est-related-v4-color-ready .est-related-v4-native-hidden{display:none!important}.est-related-v4-color-ready .est-related-v4{margin:10px 0 22px}.est-related-v4-color-ready .est-related-v4__heading{display:none!important}@media(max-width:639px){.est-related-v4__items{gap:9px}.est-related-v4__item{width:68px;height:86px;flex-basis:68px}.est-related-v4__heading{font-size:14px}}';
document.head.appendChild(el);
}
function isProductMutation(m){
if(m.target.nodeType===1&&m.target.closest&&m.target.closest('.'+BLOCK))return false;
if(m.target.nodeType===1&&m.target.closest&&m.target.closest(INFO))return true;
for(const n of m.addedNodes){
if(n.nodeType!==1)continue;
if(n.classList&&n.classList.contains(BLOCK))continue;
if(n.closest&&n.closest('.'+BLOCK))continue;
if(n.matches&&n.matches(INFO))return true;
if(n.querySelector&&n.querySelector(INFO))return true;
}
return false;
}
function init(){
addCSS();schedule();
observer=new MutationObserver(function(ms){if(ms.some(isProductMutation))schedule();});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',function(e){
if(e.target.closest&&e.target.closest('.js-product,.t-store__card,.t-store__prod-popup__close,.t-store__card__link')){
schedule();setTimeout(schedule,200);
}
},true);
window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
