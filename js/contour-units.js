(function(root){
'use strict';

const C=root.ContourConfig||(typeof module!=='undefined'&&module.exports?require('./contour-config.js'):null);
if(!C)throw new Error('ContourConfig має бути завантажений перед ContourUnits.');

const STATUS=Object.freeze({ACTIVE:'active',HIDDEN:'hidden',ARCHIVED:'archived'});
const STORAGE_KEY='contour.unit-status.v1';
const validStatus=value=>Object.values(STATUS).includes(value);
const clean=value=>String(value??'').trim().replace(/\s+/g,' ');

function hierarchyIndex(hierarchy=C.UNIT_HIERARCHY){
  const index=Object.create(null);let order=0;
  const visit=(entries,parent=null,depth=0)=>{
    for(const entry of entries||[]){
      const name=clean(entry?.name);if(!name)continue;
      if(index[name])throw new Error(`Дубль у UNIT_HIERARCHY: ${name}`);
      index[name]={name,parent,level:depth===0?'group':depth===1?'corps':'unit',order:order++,children:[]};
      visit(entry.children||[],name,depth+1);
    }
  };
  visit(hierarchy||[]);
  for(const node of Object.values(index))if(node.parent&&index[node.parent])index[node.parent].children.push(node.name);
  return index;
}

function buildCatalog(data,hierarchy=C.UNIT_HIERARCHY){
  const sheet=data?.sheets?.[C.WORKBOOK_SCHEMA.sheets.ops];
  const records=sheet?.records||[],total=C.WORKBOOK_SCHEMA.rows.opsSummary;
  const firstOrder=new Map(),allNames=new Set();let sequence=0;
  for(const row of records){
    const name=clean(row.group);if(!name||name===total)continue;
    allNames.add(name);if(!firstOrder.has(name))firstOrder.set(name,sequence++);
  }
  const configured=hierarchyIndex(hierarchy);
  const nodes=[...allNames].map(name=>{
    const definition=configured[name],configuredParent=definition?.parent||null;
    return {
      name,
      parent:configuredParent&&allNames.has(configuredParent)?configuredParent:null,
      level:definition?.level||'unit',
      unconfigured:!definition,
      order:definition?.order??(100000+(firstOrder.get(name)??Number.MAX_SAFE_INTEGER)),
      children:[]
    };
  }).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'uk'));
  const index=Object.create(null);nodes.forEach(node=>{index[node.name]=node});
  for(const node of nodes)if(node.parent&&index[node.parent])index[node.parent].children.push(node.name);
  const roots=nodes.filter(node=>!node.parent).map(node=>node.name);
  return {nodes,index,roots,unconfigured:nodes.filter(node=>node.unconfigured).map(node=>node.name)};
}

function loadStatuses(storage){
  try{
    const raw=storage?.getItem(STORAGE_KEY);if(!raw)return {};
    const parsed=JSON.parse(raw),result={};
    for(const [name,status] of Object.entries(parsed||{}))if(validStatus(status)&&status!==STATUS.ACTIVE)result[name]=status;
    return result;
  }catch{return {}}
}
function saveStatuses(storage,statuses){
  try{storage?.setItem(STORAGE_KEY,JSON.stringify(statuses))}catch{}
}

let data=null,catalog={nodes:[],index:Object.create(null),roots:[],unconfigured:[]},statuses={},showArchived=false;
const expanded=new Set();
let refreshQueued=false,observer=null;
const storage=typeof localStorage!=='undefined'?localStorage:null;
statuses=loadStatuses(storage);

function statusOf(name){return statuses[name]||STATUS.ACTIVE}
function setStatus(name,status){
  if(!validStatus(status))return;
  if(status===STATUS.ACTIVE)delete statuses[name];else statuses[name]=status;
  saveStatuses(storage,statuses);requestRefresh();renderManager();
}
function setData(next){data=next;catalog=buildCatalog(next);expanded.clear();requestRefresh();}
function nodeOf(name){return catalog.index[clean(name)]||null}
function parentChain(node){const chain=[];let current=node;const guard=new Set();while(current?.parent&&catalog.index[current.parent]&&!guard.has(current.parent)){guard.add(current.parent);current=catalog.index[current.parent];chain.unshift(current)}return chain}
function visibleByStatus(node){const status=statusOf(node.name);return status!==STATUS.HIDDEN&&(status!==STATUS.ARCHIVED||showArchived)}
function visibleNode(node){if(!visibleByStatus(node))return false;for(const parent of parentChain(node)){if(!visibleByStatus(parent)||!expanded.has(parent.name))return false}return true}

function isOpsTable(){return document.querySelector('#table-head th:first-child')?.textContent.trim()==='Угруповання'}
function ensureControls(){
  const heading=document.querySelector('.details-panel .panel-heading');if(!heading||document.querySelector('#unit-controls'))return;
  const controls=document.createElement('div');controls.id='unit-controls';controls.className='unit-controls';controls.innerHTML='<button type="button" class="text-button" id="unit-archive-toggle" aria-pressed="false">Архів</button><button type="button" class="text-button" id="unit-manage">Підрозділи <span>↗</span></button>';
  const exportButton=document.querySelector('#export-button');heading.insertBefore(controls,exportButton||null);
  controls.querySelector('#unit-archive-toggle').onclick=()=>{showArchived=!showArchived;requestRefresh()};
  controls.querySelector('#unit-manage').onclick=()=>{renderManager();document.querySelector('#unit-manager-dialog')?.showModal()};
}
function ensureDialog(){
  if(document.querySelector('#unit-manager-dialog'))return;
  document.body.insertAdjacentHTML('beforeend','<dialog id="unit-manager-dialog" class="source-dialog unit-manager-dialog" aria-labelledby="unit-manager-title"><div class="sheet-heading"><div><span class="eyebrow">СТРУКТУРА</span><h2 id="unit-manager-title">Підрозділи та архів</h2></div><button class="icon-button unit-manager-close" aria-label="Закрити">×</button></div><p class="source-intro">Статус зберігається лише локально в цьому браузері. Дані Excel не змінюються і не видаляються.</p><div id="unit-manager-list" class="unit-manager-list"></div><div class="unit-manager-actions"><button type="button" class="text-button" id="unit-reset-statuses">Скинути статуси</button></div></dialog>');
  const dialog=document.querySelector('#unit-manager-dialog');dialog.querySelector('.unit-manager-close').onclick=()=>dialog.close();
  dialog.querySelector('#unit-reset-statuses').onclick=()=>{statuses={};saveStatuses(storage,statuses);showArchived=false;requestRefresh();renderManager()};
}
function renderManager(){
  if(typeof document==='undefined')return;ensureDialog();const list=document.querySelector('#unit-manager-list');if(!list)return;
  if(!catalog.nodes.length){list.innerHTML='<p class="focus-note">У поточній книзі немає структури ГОЧ.</p>';return}
  list.innerHTML=catalog.nodes.map(node=>{
    const parent=node.parent?`<small>${escapeHtml(node.parent)}</small>`:'<small>верхній рівень</small>';
    const issue=node.unconfigured?'<em>не визначено у contour-config.js</em>':'';
    return `<label class="unit-manager-row unit-manager-${node.level}" style="--unit-depth:${node.level==='group'?0:node.level==='corps'?1:2}"><span><strong>${escapeHtml(node.name)}</strong>${parent}${issue}</span><select data-unit-status="${escapeAttr(node.name)}" aria-label="Статус: ${escapeAttr(node.name)}"><option value="active"${statusOf(node.name)==='active'?' selected':''}>Активний</option><option value="hidden"${statusOf(node.name)==='hidden'?' selected':''}>Прихований</option><option value="archived"${statusOf(node.name)==='archived'?' selected':''}>Архів</option></select></label>`;
  }).join('');
  list.querySelectorAll('[data-unit-status]').forEach(select=>select.onchange=()=>setStatus(select.dataset.unitStatus,select.value));
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const escapeAttr=escapeHtml;

function decorateRow(row,node){
  if(row.dataset.unitEnhanced==='1')return;
  row.dataset.unitEnhanced='1';row.dataset.unitName=node.name;row.dataset.unitLevel=node.level;if(node.parent)row.dataset.unitParent=node.parent;
  row.classList.add('unit-row',`unit-level-${node.level}`);if(node.unconfigured)row.classList.add('unit-unconfigured');
  const cell=row.querySelector('td:first-child'),button=row.querySelector('.row-button'),name=button?.querySelector('.row-name'),index=button?.querySelector('.row-index');if(!cell||!button||!name||!index)return;
  const main=document.createElement('div');main.className='unit-row-main';main.append(index);
  if(node.children.length){
    row.classList.add('unit-parent');
    const expand=document.createElement('button');expand.type='button';expand.className='unit-expand';expand.setAttribute('aria-label',`Розгорнути: ${node.name}`);expand.onclick=event=>{event.preventDefault();event.stopPropagation();toggle(node.name)};main.append(expand);
  }else{
    const slot=document.createElement('span');slot.className='unit-expand-slot';slot.setAttribute('aria-hidden','true');main.append(slot);
  }
  main.append(button);cell.append(main);
  if(node.unconfigured){const badge=document.createElement('span');badge.className='unit-badge';badge.textContent='не в конфіг.';name.after(badge)}
}
function toggle(name){if(expanded.has(name))expanded.delete(name);else expanded.add(name);applyTableState()}
function applyTableState(){
  if(typeof document==='undefined')return;ensureControls();ensureDialog();const controls=document.querySelector('#unit-controls');if(controls)controls.hidden=!isOpsTable();if(!isOpsTable())return;
  const archiveToggle=document.querySelector('#unit-archive-toggle');if(archiveToggle){archiveToggle.setAttribute('aria-pressed',String(showArchived));const count=catalog.nodes.filter(n=>statusOf(n.name)===STATUS.ARCHIVED).length;archiveToggle.textContent=`Архів${count?' · '+count:''}`}
  const rows=[...document.querySelectorAll('#table-body tr')];
  for(const row of rows){const name=clean(row.querySelector('.row-name')?.textContent),node=nodeOf(name);if(!node)continue;decorateRow(row,node);const status=statusOf(node.name);row.classList.toggle('unit-status-archived',status===STATUS.ARCHIVED);row.classList.toggle('unit-status-hidden',status===STATUS.HIDDEN);row.hidden=!visibleNode(node);const expand=row.querySelector('.unit-expand');if(expand){const open=expanded.has(node.name);expand.setAttribute('aria-expanded',String(open));expand.textContent=open?'−':'+';expand.setAttribute('aria-label',`${open?'Згорнути':'Розгорнути'}: ${node.name}`)}}
}
function requestRefresh(){if(typeof document==='undefined'||refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;applyTableState()})}
function bootDom(){
  if(typeof document==='undefined')return;ensureControls();ensureDialog();const body=document.querySelector('#table-body');if(!body)return;
  observer=new MutationObserver(()=>requestRefresh());observer.observe(body,{childList:true});requestRefresh();
}
function wrapParser(){
  const D=root.ContourData;if(!D||D.__contourUnitsWrapped)return;
  const original=D.parse;D.parse=function(...args){const parsed=original.apply(this,args);setData(parsed);return parsed};D.__contourUnitsWrapped=true;
}

wrapParser();if(typeof document!=='undefined')bootDom();
const api={STATUS,STORAGE_KEY,buildCatalog,loadStatuses,statusOf,setStatus,get catalog(){return catalog},get data(){return data}};
root.ContourUnits=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
