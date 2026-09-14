(function(root){
'use strict';

const C=root.ContourConfig||(typeof module!=='undefined'&&module.exports?require('./contour-config.js'):null);
if(!C)throw new Error('ContourConfig має бути завантажений перед ContourUnits.');

const STATUS=Object.freeze({ACTIVE:'active',HIDDEN:'hidden',ARCHIVED:'archived'});
const STORAGE_KEY='contour.unit-status.v1';
const validStatus=value=>Object.values(STATUS).includes(value);
const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
const reduceMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

function hierarchyIndex(hierarchy=C.UNIT_HIERARCHY){
  const index=Object.create(null);let order=0;
  const visit=(entries,parent=null,depth=0)=>{
    for(const entry of entries||[]){
      const name=clean(entry?.name);if(!name)continue;
      if(index[name])throw new Error(`Дубль у UNIT_HIERARCHY: ${name}`);
      index[name]={name,parent,depth,level:depth===0?'group':depth===1?'corps':'unit',order:order++,children:[]};
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
    const definition=configured[name],configuredParent=definition?.parent||null,parent=configuredParent&&allNames.has(configuredParent)?configuredParent:null;
    return {
      name,
      parent,
      depth:parent?(definition?.depth||1):0,
      level:parent?(definition?.level||'unit'):(definition?.level==='group'?'group':'unit'),
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

let data=null,catalog={nodes:[],index:Object.create(null),roots:[],unconfigured:[]},statuses={},showArchived=false,showHidden=false;
const expanded=new Set(),toggling=new Set();
let refreshQueued=false,observer=null,detailObserver=null;
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
function visibleNode(node){if(showHidden)return node.unconfigured||statusOf(node.name)===STATUS.HIDDEN;if(node.unconfigured)return false;if(!visibleByStatus(node))return false;for(const parent of parentChain(node)){if(!visibleByStatus(parent)||!expanded.has(parent.name))return false}return true}
function isLastSibling(node){if(!node?.parent)return true;const siblings=catalog.index[node.parent]?.children||[];return siblings.at(-1)===node.name}
function descendants(name){const result=[],stack=[...(catalog.index[name]?.children||[])];while(stack.length){const child=stack.shift(),node=catalog.index[child];if(!node)continue;result.push(child);stack.unshift(...node.children)}return result}
function visibleDescendantRows(name){const names=new Set(descendants(name));return [...document.querySelectorAll('#table-body tr')].filter(row=>names.has(row.dataset.unitName)&&!row.hidden)}

function isOpsTable(){return document.querySelector('#table-head th:first-child')?.textContent.trim()==='Угруповання'}
function ensureControls(){
  const heading=document.querySelector('.details-panel .panel-heading');if(!heading||document.querySelector('#unit-controls'))return;
  const controls=document.createElement('div');controls.id='unit-controls';controls.className='unit-controls';controls.innerHTML='<button type="button" class="text-button" id="unit-hidden-toggle" aria-pressed="false">Приховані</button><button type="button" class="text-button" id="unit-archive-toggle" aria-pressed="false">Архів</button><button type="button" class="text-button" id="unit-manage">Підрозділи <span>↗</span></button>';
  const exportButton=document.querySelector('#export-button');heading.insertBefore(controls,exportButton||null);
  controls.querySelector('#unit-hidden-toggle').onclick=()=>{showHidden=!showHidden;requestRefresh()};
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
    return `<label class="unit-manager-row unit-manager-${node.level}" style="--unit-depth:${node.depth}"><span><strong>${escapeHtml(node.name)}</strong>${parent}${issue}</span><select data-unit-status="${escapeAttr(node.name)}" aria-label="Статус: ${escapeAttr(node.name)}"><option value="active"${statusOf(node.name)==='active'?' selected':''}>Активний</option><option value="hidden"${statusOf(node.name)==='hidden'?' selected':''}>Прихований</option><option value="archived"${statusOf(node.name)==='archived'?' selected':''}>Архів</option></select></label>`;
  }).join('');
  list.querySelectorAll('[data-unit-status]').forEach(select=>select.onchange=()=>setStatus(select.dataset.unitStatus,select.value));
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const escapeAttr=escapeHtml;

function decorateRow(row,node){
  if(row.dataset.unitEnhanced==='1')return;
  row.dataset.unitEnhanced='1';row.dataset.unitName=node.name;row.dataset.unitLevel=node.level;row.dataset.unitDepth=String(node.depth);if(node.parent)row.dataset.unitParent=node.parent;
  row.classList.add('unit-row',`unit-level-${node.level}`);if(node.unconfigured)row.classList.add('unit-unconfigured');
  const cell=row.querySelector('td:first-child'),button=row.querySelector('.row-button'),name=button?.querySelector('.row-name'),index=button?.querySelector('.row-index');if(!cell||!button||!name||!index)return;
  const main=document.createElement('div');main.className='unit-row-main';main.append(index);
  if(node.children.length){
    row.classList.add('unit-parent');
    const expand=document.createElement('button');expand.type='button';expand.className='unit-expand';expand.setAttribute('aria-label',`Розгорнути: ${node.name}`);expand.onclick=event=>{event.preventDefault();event.stopPropagation();void toggle(node.name)};main.append(expand);
  }else{
    const slot=document.createElement('span');slot.className='unit-expand-slot';slot.setAttribute('aria-hidden','true');main.append(slot);
  }
  const branchNodes=[...parentChain(node),node].slice(1);
  if(branchNodes.length){
    const branch=document.createElement('span');branch.className='unit-branch';branch.setAttribute('aria-hidden','true');
    for(const branchNode of branchNodes){const segment=document.createElement('i');segment.className='unit-branch-segment';if(branchNode===node)segment.classList.add('current');if(!isLastSibling(branchNode))segment.classList.add('continue');branch.append(segment)}
    button.prepend(branch);
  }
  main.append(button);cell.append(main);
  if(node.unconfigured){const badge=document.createElement('span');badge.className='unit-badge';badge.textContent='не в конфіг.';name.after(badge)}
}
function reorderRows(rows){
  const body=document.querySelector('#table-body');if(!body)return rows;
  const byName=new Map(),known=new Set();for(const row of rows){const name=clean(row.querySelector('.row-name')?.textContent);if(name&&!byName.has(name))byName.set(name,row)}
  const ordered=[];for(const node of catalog.nodes){const row=byName.get(node.name);if(row){ordered.push(row);known.add(row)}}for(const row of rows)if(!known.has(row))ordered.push(row);
  if(ordered.some((row,index)=>body.children[index]!==row))body.append(...ordered);
  return ordered;
}
function reindexVisibleRows(rows){let index=0;for(const row of rows){if(row.hidden)continue;const label=row.querySelector('.row-index');if(label)label.textContent=String(++index).padStart(2,'0')}}
function animateRows(rows,entering){
  if(reduceMotion()||!rows.length)return {finished:Promise.resolve(),cancel(){}};
  const animations=[],ordered=entering?rows:[...rows].reverse();
  ordered.forEach((row,index)=>{
    row.classList.add('unit-animating');
    const delay=Math.min(index*16,112),frames=entering?[{opacity:0,transform:'translateY(-7px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}];
    for(const cell of row.children){const animation=cell.animate(frames,{duration:220,delay,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});animations.push(animation)}
  });
  return {
    finished:Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))),
    cancel(){for(const animation of animations)animation.cancel();for(const row of rows)row.classList.remove('unit-animating')}
  };
}
async function toggle(name){
  if(toggling.has(name)||!catalog.index[name])return;toggling.add(name);
  try{
    if(expanded.has(name)){
      const rows=visibleDescendantRows(name),effect=animateRows(rows,false);await effect.finished;expanded.delete(name);applyTableState();effect.cancel();
    }else{
      expanded.add(name);applyTableState();const rows=visibleDescendantRows(name),effect=animateRows(rows,true);await effect.finished;effect.cancel();
    }
  }finally{toggling.delete(name)}
}
function applyTableState(){
  if(typeof document==='undefined')return[];ensureControls();ensureDialog();const controls=document.querySelector('#unit-controls');if(controls)controls.hidden=!isOpsTable();if(!isOpsTable())return[];
  const hiddenToggle=document.querySelector('#unit-hidden-toggle');if(hiddenToggle){hiddenToggle.setAttribute('aria-pressed',String(showHidden));const count=catalog.nodes.filter(n=>n.unconfigured||statusOf(n.name)===STATUS.HIDDEN).length;hiddenToggle.textContent='Приховані'+(count?' · '+count:'')}
  const archiveToggle=document.querySelector('#unit-archive-toggle');if(archiveToggle){archiveToggle.setAttribute('aria-pressed',String(showArchived));const count=catalog.nodes.filter(n=>statusOf(n.name)===STATUS.ARCHIVED).length;archiveToggle.textContent=`Архів${count?' · '+count:''}`}
  const sourceRows=[...document.querySelectorAll('#table-body tr')];for(const row of sourceRows){const name=clean(row.querySelector('.row-name')?.textContent),node=nodeOf(name);if(node)decorateRow(row,node)}
  const rows=reorderRows(sourceRows);
  for(const row of rows){const name=clean(row.querySelector('.row-name')?.textContent),node=nodeOf(name);if(!node)continue;const status=statusOf(node.name);row.classList.toggle('unit-status-archived',status===STATUS.ARCHIVED);row.classList.toggle('unit-status-hidden',status===STATUS.HIDDEN);row.hidden=!visibleNode(node);const expand=row.querySelector('.unit-expand');if(expand){const open=expanded.has(node.name);expand.setAttribute('aria-expanded',String(open));expand.textContent=open?'−':'+';expand.setAttribute('aria-label',`${open?'Згорнути':'Розгорнути'}: ${node.name}`)}}
  reindexVisibleRows(rows);return rows;
}

function detailCategory(){
  const D=root.ContourData;if(!D||!data)return null;
  const sectionId=document.querySelector('#inline-sections [data-section][aria-pressed="true"]')?.dataset.section;if(sectionId!=='ops')return null;
  const section=D.sections(data).find(item=>item.id==='ops'),metricId=document.querySelector('#metrics [data-metric][aria-pressed="true"]')?.dataset.metric;
  let category=section?.categories.find(item=>item.id===metricId);if(!section||!category)return null;
  if(category.id==='drones'){
    const types=[...C.WORKBOOK_SCHEMA.droneTypes],fpv=types.find(type=>type.id==='fpv'),ordered=[fpv,...types.filter(type=>type.id!=='fpv')].filter(Boolean);
    category={...category,fields:ordered.map(type=>type.field),labels:ordered.map(type=>type.name),colors:ordered.map(type=>type.color)};
  }
  return {D,section,category};
}
function enhanceDetailTable(){
  const dialog=document.querySelector('#detail-dialog');if(!dialog?.open)return;
  const name=clean(document.querySelector('#detail-name')?.textContent),node=nodeOf(name),children=node?.children||[];if(!name||!children.length)return;
  const context=detailCategory(),table=document.querySelector('#detail-content .table-wrap table'),from=document.querySelector('#from')?.value,to=document.querySelector('#to')?.value;if(!context||!table||!from||!to)return;
  const key=[name,context.category.id,from,to].join('|');if(table.dataset.unitBreakdown===key)return;
  const V=root.ContourView,fmt=V?.fmt||((value)=>value??'—'),fullDate=V?.fullDate||((value)=>value),entries=[name,...children];
  const aggregates=new Map(entries.map(unit=>[unit,context.D.aggregate(data,context.section,context.category,from,to,unit)])),parent=aggregates.get(name),span=entries.length;
  table.classList.add('detail-hierarchy-table');table.dataset.unitBreakdown=key;
  table.querySelector('thead').innerHTML=`<tr><th scope="col">Дата</th><th scope="col">Підрозділ</th>${context.category.labels.map(label=>`<th scope="col">${escapeHtml(label)}</th>`).join('')}</tr>`;
  table.querySelector('tbody').innerHTML=parent.days.map((day,index)=>{
    const parentValues=parent.series.map(series=>series[index]);
    const parentRow=`<tr class="detail-unit-parent" data-detail-date="${escapeAttr(day)}" data-detail-unit="${escapeAttr(name)}"><th scope="rowgroup" rowspan="${span}" class="detail-unit-date">${escapeHtml(fullDate(day))}</th><th scope="row" class="detail-unit-name"><strong>${escapeHtml(name)}</strong><small>загальний показник</small></th>${parentValues.map(value=>`<td>${escapeHtml(fmt(value))}</td>`).join('')}</tr>`;
    const childRows=children.map(child=>{const aggregate=aggregates.get(child),values=aggregate.series.map(series=>series[index]);return `<tr class="detail-unit-child" data-detail-date="${escapeAttr(day)}" data-detail-unit="${escapeAttr(child)}" data-detail-parent="${escapeAttr(name)}"><th scope="row" class="detail-unit-name"><span aria-hidden="true">↳</span>${escapeHtml(child)}</th>${values.map(value=>`<td>${escapeHtml(fmt(value))}</td>`).join('')}</tr>`}).join('');
    return parentRow+childRows;
  }).join('');
  const wrap=table.closest('.table-wrap');if(wrap)wrap.setAttribute('aria-label',`Поденні дані: ${name} та безпосередньо підпорядковані підрозділи`);
  if(!table.parentElement.previousElementSibling?.classList.contains('detail-unit-note'))table.parentElement.insertAdjacentHTML('beforebegin','<p class="detail-unit-note">Нижче показані лише безпосередньо підпорядковані підрозділи. Загальний рядок — власний показник джерела і не є сумою дочірніх.</p>');
}
function observeDetail(){
  const dialog=document.querySelector('#detail-dialog');if(!dialog||detailObserver)return;
  detailObserver=new MutationObserver(()=>{if(dialog.open)queueMicrotask(enhanceDetailTable)});detailObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
}
function requestRefresh(){if(typeof document==='undefined'||refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;applyTableState()})}
function bootDom(){
  if(typeof document==='undefined')return;ensureControls();ensureDialog();observeDetail();const body=document.querySelector('#table-body');if(!body)return;
  observer=new MutationObserver(()=>requestRefresh());observer.observe(body,{childList:true});requestRefresh();
}
if(typeof document!=='undefined')bootDom();
const api={STATUS,STORAGE_KEY,buildCatalog,loadStatuses,statusOf,setStatus,setData,get catalog(){return catalog},get data(){return data}};
root.ContourUnits=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
