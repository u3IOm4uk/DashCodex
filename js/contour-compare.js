(function(root){
'use strict';

const D=root.ContourData,C=root.ContourConfig,V=root.ContourView,H=root.ContourCharts;
if(!D||!C||!V||!H||!root.ApexCharts)return;
const $=selector=>document.querySelector(selector);
const {esc,fmt,fullDate,shortDate}=V;
const MAX_SERIES=6;
const SERIES_COLORS=[D.colors.gold,D.colors.blue,D.colors.red,D.colors.green,D.colors.violet,D.colors.cyan];
const DEFAULT_SELECTION=['ops:shells:0','ops:assault:1','ops:drones:fpv'];
const button=$('#compare-open'),mobileButton=$('#mobile-compare'),dialog=$('#compare-dialog');
if(!button||!dialog)return;

let model=null,sourceName=C.APP_CONFIG.defaultWorkbook,sourceKind=C.APP_CONFIG.sourceKinds.BUNDLED;
let catalog=[],selected=new Set(DEFAULT_SELECTION),chart=null,chartType='area',valueMode='normalized',activeView='chart';
let range={from:null,to:null},bounds={from:null,to:null};
const selectedUnits=new Set(),expandedUnits=new Set(),openCategories=new Set();

const dayStamp=day=>Date.parse(day+'T12:00:00Z');
const clamp=(value,min,max)=>value<min?min:value>max?max:value;
const daysBetween=(from,to)=>{const rows=[];for(let day=from;day<=to;day=D.shift(day,1))rows.push(day);return rows};
const mobileComparison=()=>{const nav=$('.mobile-nav');return !!nav&&root.getComputedStyle(nav).display!=='none'};
const comparisonChartHeight=()=>matchMedia('(max-width:900px)').matches?420:480;
function syncMobileDialogOffset(){const nav=$('.mobile-nav'),height=nav?.getBoundingClientRect().height||64;dialog.style.setProperty('--compare-mobile-nav-height',height+'px')}
function syncMobileNavState(active){
 if(!mobileButton)return;const overview=$('#mobile-overview');mobileButton.classList.toggle('active',active);
 if(active){overview?.classList.remove('active');mobileButton.setAttribute('aria-current','page')}else{mobileButton.removeAttribute('aria-current');overview?.classList.add('active')}
}

function setCompareView(next,rerender=true){
 const target=next==='details'?'details':'chart',changed=activeView!==target;activeView=target;
 const chartPanel=$('#compare-chart-panel'),tablePanel=dialog.querySelector('.compare-table-panel'),chartHeading=chartPanel?.querySelector('.compare-fold-heading'),tableHeading=tablePanel?.querySelector('.panel-heading');
 chartPanel?.classList.toggle('is-collapsed',activeView!=='chart');
 tablePanel?.classList.toggle('is-collapsed',activeView!=='details');
 chartHeading?.setAttribute('aria-expanded',String(activeView==='chart'));
 tableHeading?.setAttribute('aria-expanded',String(activeView==='details'));
 if(activeView==='details'&&chart){chart.destroy();chart=null;const host=$('#compare-chart');if(host)host.innerHTML=''}
 if(rerender&&changed&&activeView==='chart'&&model&&range.from&&range.to)renderAnalysis();
}

function ensureCompareAccordion(){
 const workspace=dialog.querySelector('.compare-workspace'),chartNode=$('#compare-chart'),dataNote=$('#compare-data-note'),tablePanel=dialog.querySelector('.compare-table-panel');
 if(!workspace||!chartNode||!dataNote||!tablePanel)return;
 let chartPanel=$('#compare-chart-panel');
 if(!chartPanel){
  chartPanel=document.createElement('section');chartPanel.id='compare-chart-panel';chartPanel.className='panel compare-chart-panel';
  const heading=document.createElement('button');heading.type='button';heading.className='panel-heading compare-fold-heading compare-chart-heading';heading.id='compare-chart-toggle';heading.setAttribute('aria-controls','compare-chart-body');heading.innerHTML='<div><h3>Графік</h3><p>Візуальне порівняння обраних показників</p></div><span class="compare-fold-chevron" aria-hidden="true">›</span>';
  const body=document.createElement('div');body.id='compare-chart-body';body.className='compare-chart-body';
  chartNode.before(chartPanel);chartPanel.append(heading,body);body.append(chartNode,dataNote);
  heading.addEventListener('click',()=>setCompareView('chart'));
 }
 const tableHeading=tablePanel.querySelector('.panel-heading'),tableTitle=tableHeading?.querySelector('h3');
 if(tableTitle)tableTitle.textContent='Деталі';
 if(tableHeading&&!tableHeading.dataset.compareAccordionBound){
  tableHeading.dataset.compareAccordionBound='true';tableHeading.classList.add('compare-fold-heading');tableHeading.setAttribute('role','button');tableHeading.setAttribute('tabindex','0');tableHeading.setAttribute('aria-controls','compare-table-head');
  const chevron=document.createElement('span');chevron.className='compare-fold-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='›';tableHeading.append(chevron);
  const activate=()=>setCompareView('details');tableHeading.addEventListener('click',activate);tableHeading.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate()}});
 }
 setCompareView(activeView,false);
}

const unitMeta=new Map();
function indexUnits(nodes,parent=null,depth=0){for(const node of nodes||[]){unitMeta.set(node.name,{node,parent,depth});indexUnits(node.children,node.name,depth+1)}}
indexUnits(C.UNIT_HIERARCHY);
function descendantNames(name,out=[]){const meta=unitMeta.get(name);for(const child of meta?.node.children||[]){out.push(child.name);descendantNames(child.name,out)}return out}
function directChildNames(name){const runtime=root.ContourUnits?.catalog?.index?.[name]?.children;if(Array.isArray(runtime))return [...runtime];return (unitMeta.get(name)?.node.children||[]).map(child=>child.name)}
function ancestorNames(name){const out=[];let parent=unitMeta.get(name)?.parent;while(parent){out.push(parent);parent=unitMeta.get(parent)?.parent}return out}

function modelBounds(){
 const dates=D.sections(model).flatMap(section=>model.sheets[section.sheet]?.dates||[]).sort();
 return {from:dates[0]||null,to:dates.at(-1)||null};
}

function initialRange(){
 const dashboardFrom=$('#from')?.value,dashboardTo=$('#to')?.value;
 if(dashboardFrom&&dashboardTo&&dashboardFrom<=dashboardTo&&dashboardFrom>=bounds.from&&dashboardTo<=bounds.to)return {from:dashboardFrom,to:dashboardTo};
 const to=bounds.to,from=clamp(D.shift(to,-6),bounds.from,to);return {from,to};
}

function customDroneCategory(base,type){
 if(type==='other')return {...base,id:'drones-other',name:'БпС без FPV',fields:[C.WORKBOOK_SCHEMA.fields.ops.dronesOther],labels:['Інші БпС (без FPV)'],colors:[D.colors.gold]};
 return {...base,id:'drones-'+type.id,name:'БпС · '+type.name,fields:[type.field],labels:[type.name],colors:[type.color]};
}

function buildCatalog(){
 const items=[];
 for(const section of D.sections(model)){
  for(const category of section.categories){
   if(section.id==='ops'&&category.id==='drones'){
    items.push({id:'ops:drones:total',section,category,index:0,sectionName:section.name,categoryName:'БпС противника',name:'Усього ударів БпЛА',unit:category.unit,supportsUnit:true});
    for(const type of D.droneTypes){const cat=customDroneCategory(category,type);items.push({id:`ops:drones:${type.id}`,section,category:cat,index:0,sectionName:section.name,categoryName:'БпС противника',name:type.name,unit:cat.unit,supportsUnit:true})}
    const other=customDroneCategory(category,'other');items.push({id:'ops:drones:other',section,category:other,index:0,sectionName:section.name,categoryName:'БпС противника',name:'Інші БпС (без FPV)',unit:other.unit,supportsUnit:true});
    continue;
   }
   category.fields.forEach((field,index)=>items.push({
    id:`${section.id}:${category.id}:${index}`,section,category,index,sectionName:section.name,categoryName:category.name,
    name:category.fields.length>1?category.labels[index]:category.name,unit:category.unit,supportsUnit:section.id==='ops'||section.id==='ovgp'
   }));
  }
 }
 catalog=items;
 const ids=new Set(catalog.map(item=>item.id));selected=new Set([...selected].filter(id=>ids.has(id)));
 if(!selected.size){for(const id of DEFAULT_SELECTION)if(ids.has(id)&&selected.size<3)selected.add(id);for(const item of catalog)if(selected.size<3)selected.add(item.id)}
}

function setModel(next,name,kind){
 model=next;sourceName=name||C.APP_CONFIG.defaultWorkbook;sourceKind=kind;bounds=modelBounds();buildCatalog();range=initialRange();renderShell();
}

async function parseBuffer(buffer,name,kind){
 const workbook=XLSX.read(buffer,{type:'array',cellDates:true,cellText:false});
 setModel(D.parse(workbook,XLSX),name,kind);
}

async function ensureModel(){
 if(model)return;
 setLoading('Завантаження даних для порівняння…');
 const response=await fetch(encodeURI(C.APP_CONFIG.defaultWorkbook));if(!response.ok)throw new Error('Файл недоступний');
 await parseBuffer(await response.arrayBuffer(),C.APP_CONFIG.defaultWorkbook,C.APP_CONFIG.sourceKinds.BUNDLED);
}

function setLoading(text){$('#compare-status').textContent=text;$('#compare-status').hidden=false}
function setMessage(text=''){const node=$('#compare-selection-note');node.textContent=text;node.hidden=!text}
function renderShell(){
 if(!model)return;ensureCompareAccordion();
 $('#compare-source-note').textContent=`Джерело: ${sourceName}${sourceKind===C.APP_CONFIG.sourceKinds.BUNDLED?' · тестова книга':' · імпортована книга'}`;
 const from=$('#compare-from'),to=$('#compare-to');from.min=to.min=bounds.from;from.max=to.max=bounds.to;from.value=range.from;to.value=range.to;
 renderCatalog();renderUnitTree();syncButtons();renderAnalysis();
}

function renderCatalog(){
 const host=$('#compare-catalog'),sections=new Map();
 for(const item of catalog){
  if(!sections.has(item.section.id))sections.set(item.section.id,{id:item.section.id,name:item.sectionName,categories:new Map()});
  const sec=sections.get(item.section.id),key=`${item.section.id}:${item.categoryName}`;
  if(!sec.categories.has(key))sec.categories.set(key,{name:item.categoryName,items:[]});sec.categories.get(key).items.push(item);
 }
 host.innerHTML=[...sections.values()].map(sec=>`<section class="compare-section-group"><h4>${esc(sec.name)}</h4>${[...sec.categories.entries()].map(([key,group])=>`<details class="compare-category" data-compare-category-key="${esc(key)}" ${openCategories.has(key)?'open':''}><summary>${esc(group.name)}<span>${group.items.length}</span></summary><div class="compare-category-items">${group.items.map(item=>{const checked=selected.has(item.id),disabled=!checked&&selected.size>=MAX_SERIES;return `<label class="compare-metric ${disabled?'is-disabled':''}"><input type="checkbox" data-compare-metric="${esc(item.id)}" ${checked?'checked':''} ${disabled?'disabled':''}><span>${esc(item.name)}</span><small>${esc(item.unit||'од.')}${item.supportsUnit?'':' · загальний'}</small></label>`}).join('')}</div></details>`).join('')}</section>`).join('');
 $('#compare-selected-count').textContent=`${selected.size} / ${MAX_SERIES}`;
 host.querySelectorAll('[data-compare-category-key]').forEach(node=>node.addEventListener('toggle',()=>{const key=node.dataset.compareCategoryKey;if(node.open)openCategories.add(key);else openCategories.delete(key)}));
 host.querySelectorAll('[data-compare-metric]').forEach(input=>input.addEventListener('change',()=>{
  const id=input.dataset.compareMetric;
  if(input.checked){if(selected.size>=MAX_SERIES){input.checked=false;setMessage(`Одночасно можна відобразити до ${MAX_SERIES} показників.`);return}selected.add(id)}else selected.delete(id);
  setMessage(selected.size?`Обрано ${selected.size} показник${selected.size===1?'':selected.size<5?'и':'ів'}.`:'Оберіть хоча б один показник.');renderCatalog();renderAnalysis();
 }));
}

function unitNodeHtml(node,depth=0){
 const children=node.children||[],hasChildren=children.length>0,expanded=expandedUnits.has(node.name),checked=selectedUnits.has(node.name);
 return `<div class="compare-unit-node" style="--unit-depth:${depth}"><div class="compare-unit-row">${hasChildren?`<button type="button" class="compare-unit-toggle" data-unit-toggle="${esc(node.name)}" aria-label="${expanded?'Згорнути':'Розгорнути'} ${esc(node.name)}" aria-expanded="${expanded}">${expanded?'⌄':'›'}</button>`:'<span class="compare-unit-toggle-spacer"></span>'}<label><input type="checkbox" data-compare-unit="${esc(node.name)}" ${checked?'checked':''}><span>${esc(node.name)}</span></label></div>${hasChildren?`<div class="compare-unit-children" ${expanded?'':'hidden'}>${children.map(child=>unitNodeHtml(child,depth+1)).join('')}</div>`:''}</div>`;
}

function renderUnitTree(){
 const host=$('#compare-unit-tree');host.innerHTML=C.UNIT_HIERARCHY.map(node=>unitNodeHtml(node)).join('');
 const all=$('#compare-units-all'),count=$('#compare-unit-count');all.setAttribute('aria-pressed',String(selectedUnits.size===0));all.classList.toggle('is-active',selectedUnits.size===0);count.textContent=selectedUnits.size?`${selectedUnits.size} обр.`:'Усі';
 host.querySelectorAll('[data-unit-toggle]').forEach(control=>control.addEventListener('click',()=>{const name=control.dataset.unitToggle;if(expandedUnits.has(name))expandedUnits.delete(name);else expandedUnits.add(name);renderUnitTree()}));
 host.querySelectorAll('[data-compare-unit]').forEach(input=>input.addEventListener('change',()=>{
  const name=input.dataset.compareUnit;
  if(input.checked){
   for(const ancestor of ancestorNames(name))selectedUnits.delete(ancestor);
   for(const descendant of descendantNames(name))selectedUnits.delete(descendant);
   selectedUnits.add(name);if(unitMeta.get(name)?.node.children?.length)expandedUnits.add(name);
  }else selectedUnits.delete(name);
  renderUnitTree();renderAnalysis();
 }));
}

$('#compare-units-all')?.addEventListener('click',()=>{selectedUnits.clear();renderUnitTree();renderAnalysis()});

function syncButtons(){
 dialog.querySelectorAll('[data-compare-chart]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.compareChart===chartType)));
 dialog.querySelectorAll('[data-compare-mode]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.compareMode===valueMode)));
}

function normalized(values){
 const baseline=values.find(value=>value!==null&&value!==0);
 if(baseline===undefined)return {values:values.map(()=>null),baseline:null};
 return {values:values.map(value=>value===null?null:value/baseline*100),baseline};
}

function selectedItems(){const map=new Map(catalog.map(item=>[item.id,item]));return [...selected].map(id=>map.get(id)).filter(Boolean)}
function unitScopeLabel(){const names=[...selectedUnits];if(!names.length)return 'Загальний підсумок';if(names.length<=2)return names.join(' + ');return `Обрано підрозділів: ${names.length}`}
function sourceSeries(item,days,unit){const aggregate=D.aggregate(model,item.section,item.category,range.from,range.to,unit);return aggregate.series[item.index]||days.map(()=>null)}
function rawForItem(item,days){
 if(!item.supportsUnit||!selectedUnits.size)return sourceSeries(item,days);
 const scoped=[...selectedUnits].map(name=>sourceSeries(item,days,name));
 if(scoped.length===1)return scoped[0];
 return days.map((_,index)=>{const values=scoped.map(series=>series[index]);return values.some(value=>value===null||value===undefined)?null:values.reduce((sum,value)=>sum+value,0)});
}

function analysisRows(){
 const days=daysBetween(range.from,range.to),items=selectedItems();let unavailable=0,missing=0;
 const series=items.map((item,colorIndex)=>{
  const raw=rawForItem(item,days);missing+=raw.filter(value=>value===null).length;
  const transformed=valueMode==='normalized'?normalized(raw):{values:raw,baseline:null};if(valueMode==='normalized'&&transformed.baseline===null)unavailable++;
  return {item,color:SERIES_COLORS[colorIndex%SERIES_COLORS.length],raw,values:transformed.values,baseline:transformed.baseline};
 });
 return {days,series,unavailable,missing};
}

function chartOptions(rows){
 const base=H.baseOptions(matchMedia('(prefers-reduced-motion: reduce)').matches),all=rows.series.flatMap(series=>series.values.filter(value=>value!==null));
 const limits=valueMode==='normalized'?D.axisRange(all):D.integerAxis(all,false);
 return {...base,chart:{...base.chart,type:chartType,height:comparisonChartHeight(),zoom:{enabled:false}},series:rows.series.map(series=>({name:series.item.categoryName===series.item.name?series.item.name:`${series.item.categoryName} · ${series.item.name}`,data:rows.days.map((day,index)=>({x:dayStamp(day),y:series.values[index]}))})),colors:rows.series.map(series=>series.color),stroke:{...base.stroke,width:chartType==='area'?2.2:0},fill:chartType==='area'?{type:'gradient',gradient:{opacityFrom:.24,opacityTo:.02}}:{type:'solid',opacity:.9},plotOptions:{bar:{columnWidth:'62%',borderRadius:2}},xaxis:{type:'datetime',labels:{datetimeUTC:true,formatter:(value,stamp)=>shortDate(new Date(stamp).toISOString().slice(0,10))},axisBorder:{show:false},axisTicks:{show:false},tooltip:{enabled:false}},yaxis:{...limits,forceNiceScale:false,labels:{formatter:value=>valueMode==='normalized'?`${Math.round(value)}`:fmt(Math.round(value))},title:{text:valueMode==='normalized'?'Індекс, база = 100':'Абсолютне значення'}},tooltip:{theme:'dark',shared:true,intersect:false,x:{formatter:stamp=>fullDate(new Date(stamp).toISOString().slice(0,10))},y:{formatter:value=>value===null||value===undefined?'—':valueMode==='normalized'?`${fmt(Math.round(value*10)/10)} інд.`:fmt(value)}},legend:{...base.legend,onItemClick:{toggleDataSeries:true}}};
}

function tableData(days,items){
 const units=[...selectedUnits],scopedItems=items.filter(item=>item.supportsUnit),globalItems=items.filter(item=>!item.supportsUnit);
 if(!units.length||!scopedItems.length){
  const values=new Map(items.map(item=>[item.id,sourceSeries(item,days)]));
  return {showUnit:false,hierarchy:false,childCount:0,rows:days.map((day,index)=>({day,values:items.map(item=>values.get(item.id)[index])}))};
 }
 const blocks=units.map(parent=>{const children=directChildNames(parent);return {parent,children,entries:[parent,...children]}}),unitNames=[...new Set(blocks.flatMap(block=>block.entries))],scoped=new Map();
 for(const unit of unitNames)for(const item of scopedItems)scoped.set(`${unit}\u001f${item.id}`,sourceSeries(item,days,unit));
 const globals=new Map(globalItems.map(item=>[item.id,sourceSeries(item,days)]));
 return {
  showUnit:true,hierarchy:true,childCount:blocks.reduce((sum,block)=>sum+block.children.length,0),
  days:days.map((day,index)=>({
   day,
   blocks:blocks.map(block=>({parent:block.parent,rows:block.entries.map((unit,rowIndex)=>({unit,kind:rowIndex?'child':'parent',values:items.map(item=>item.supportsUnit?scoped.get(`${unit}\u001f${item.id}`)[index]:null)}))})),
   global:globalItems.length?{unit:'Загальні показники',values:items.map(item=>item.supportsUnit?null:globals.get(item.id)[index])}:null
  }))
 };
}

function renderTable(rows){
 const head=$('#compare-table-head'),body=$('#compare-table-body'),foot=$('#compare-table-foot'),note=$('#compare-unit-breakdown-note'),table=head.closest('table'),items=rows.series.map(series=>series.item),detail=tableData(rows.days,items);
 const headerName=item=>item.categoryName===item.name?item.name:`${item.categoryName} · ${item.name}`,valueHtml=value=>value===null||value===undefined?'—':esc(fmt(value));
 table?.classList.toggle('detail-hierarchy-table',detail.hierarchy);
 head.innerHTML=`<tr><th>Дата</th>${detail.showUnit?'<th>Підрозділ</th>':''}${rows.series.map(series=>`<th><span style="color:${series.color}">●</span> ${esc(headerName(series.item))}</th>`).join('')}</tr>`;
 if(!detail.hierarchy){
  body.innerHTML=detail.rows.map(row=>`<tr><td>${fullDate(row.day)}</td>${row.values.map(value=>`<td>${valueHtml(value)}</td>`).join('')}</tr>`).join('');
 }else{
  body.innerHTML=detail.days.map(group=>{
   const blocks=group.blocks.map(block=>{
    const parent=block.rows[0],span=block.rows.length;
    const parentRow=`<tr class="detail-unit-parent" data-detail-date="${esc(group.day)}" data-detail-unit="${esc(parent.unit)}"><th scope="rowgroup" rowspan="${span}" class="detail-unit-date">${esc(fullDate(group.day))}</th><th scope="row" class="detail-unit-name"><strong>${esc(parent.unit)}</strong><small>загальний показник</small></th>${parent.values.map(value=>`<td>${valueHtml(value)}</td>`).join('')}</tr>`;
    const childRows=block.rows.slice(1).map(row=>`<tr class="detail-unit-child" data-detail-date="${esc(group.day)}" data-detail-unit="${esc(row.unit)}" data-detail-parent="${esc(block.parent)}"><th scope="row" class="detail-unit-name"><span aria-hidden="true">↳</span>${esc(row.unit)}</th>${row.values.map(value=>`<td>${valueHtml(value)}</td>`).join('')}</tr>`).join('');
    return parentRow+childRows;
   }).join('');
   const globalRow=group.global?`<tr class="compare-global-row"><th scope="row" class="detail-unit-date">${esc(fullDate(group.day))}</th><th scope="row" class="detail-unit-name">${esc(group.global.unit)}</th>${group.global.values.map(value=>`<td>${valueHtml(value)}</td>`).join('')}</tr>`:'';
   return blocks+globalRow;
  }).join('');
 }
 if(note){note.hidden=!(detail.hierarchy&&detail.childCount);note.textContent='Нижче показані вибрані батьківські підрозділи та лише їхні безпосередньо підпорядковані підрозділи. Батьківський рядок — власний показник джерела і не є сумою дочірніх.'}
 if(foot){const childNote=detail.childCount?` · + ${detail.childCount} безпосередніх дочірніх`:'';const globalNote=detail.showUnit&&items.some(item=>!item.supportsUnit)?' · глобальні показники окремим рядком':'';foot.textContent=`Абсолютні значення джерела · ${rows.days.length} дн. · ${items.length} показн.${detail.showUnit?` · ${selectedUnits.size} обр. підрозд.${childNote}`:''}${globalNote}`}
}

function renderAnalysis(){
 if(!model||!range.from||!range.to)return;ensureCompareAccordion();syncButtons();
 const items=selectedItems(),status=$('#compare-status');
 if(!items.length){chart?.destroy();chart=null;$('#compare-chart').innerHTML='';$('#compare-table-head').innerHTML='';$('#compare-table-body').innerHTML='';if($('#compare-table-foot'))$('#compare-table-foot').textContent='';if($('#compare-unit-breakdown-note'))$('#compare-unit-breakdown-note').hidden=true;status.hidden=false;status.textContent='Оберіть показники у блоці «Показники».';return}
 const validation=D.validateDateRange(range.from,range.to);if(!validation.valid){status.hidden=false;status.textContent=validation.reason;return}
 status.hidden=true;const rows=analysisRows();
 chart?.destroy();chart=null;$('#compare-chart').innerHTML='';
 if(activeView==='chart'){
  try{chart=new ApexCharts($('#compare-chart'),chartOptions(rows));chart.render().catch(error=>{console.error(error);status.hidden=false;status.textContent='Не вдалося побудувати графік порівняння.'})}catch(error){console.error(error);status.hidden=false;status.textContent='Не вдалося побудувати графік порівняння.'}
 }
 renderTable(rows);
 const notes=[];
 if(valueMode==='normalized')notes.push('Нормалізація: перше доступне ненульове значення кожної серії = 100.');else notes.push('Абсолютний режим використовує спільну шкалу; для показників різного порядку величини зручніше нормалізоване порівняння.');
 if(selectedUnits.size===1)notes.push(`Підрозділ: ${unitScopeLabel()}. Для батьківського вузла використовується тільки його власний рядок джерела.`);
 if(selectedUnits.size>1)notes.push(`Підрозділи: ${unitScopeLabel()}. Серії сумуються тільки за явно вибраними вузлами; parent і його нащадки одночасно не враховуються.`);
 if(selectedUnits.size&&items.some(item=>!item.supportsUnit))notes.push('Показники без підроздільної деталізації залишаються загальними.');
 if(rows.unavailable)notes.push(`${rows.unavailable} сер. без ненульової бази не нормалізовано.`);
 if(rows.missing)notes.push('Пропуски залишаються «—» і не прирівнюються до нуля; при виборі кількох підрозділів неповний день не підсумовується частково.');
 $('#compare-data-note').textContent=notes.join(' ');
 $('#compare-range-note').textContent=`${fullDate(range.from)} — ${fullDate(range.to)} · ${items.length} показник${items.length===1?'':items.length<5?'и':'ів'} · ${unitScopeLabel()}`;
}

function applyRange(nextFrom,nextTo){
 if(!model)return;nextFrom=clamp(nextFrom,bounds.from,bounds.to);nextTo=clamp(nextTo,bounds.from,bounds.to);if(nextFrom>nextTo)[nextFrom,nextTo]=[nextTo,nextFrom];const validation=D.validateDateRange(nextFrom,nextTo);if(!validation.valid){setMessage(validation.reason);return}
 range={from:nextFrom,to:nextTo};$('#compare-from').value=range.from;$('#compare-to').value=range.to;renderAnalysis();
}

async function openComparison(){
 if(dialog.open)return;activeView='chart';ensureCompareAccordion();setCompareView('chart',false);
 if(mobileComparison()){
  syncMobileDialogOffset();syncMobileNavState(true);dialog.classList.add('compare-mobile-nav');dialog.show();
 }else{
  syncMobileNavState(false);dialog.classList.remove('compare-mobile-nav');dialog.style.removeProperty('--compare-mobile-nav-height');dialog.showModal();
 }
 try{await ensureModel();renderShell()}catch(error){console.error(error);setLoading('Не вдалося підключити дані для порівняння. Імпортуйте Excel або повторіть спробу.')}
}
button.addEventListener('click',openComparison);mobileButton?.addEventListener('click',openComparison);
dialog.querySelector('[data-compare-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(!dialog.classList.contains('compare-mobile-nav')&&event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}});
dialog.addEventListener('close',()=>{chart?.destroy();chart=null;syncMobileNavState(false);dialog.classList.remove('compare-mobile-nav');dialog.style.removeProperty('--compare-mobile-nav-height')});
['#mobile-overview','#mobile-menu'].forEach(selector=>$(selector)?.addEventListener('click',()=>{if(dialog.open&&dialog.classList.contains('compare-mobile-nav'))dialog.close()},true));
addEventListener('resize',()=>{if(dialog.open&&dialog.classList.contains('compare-mobile-nav'))syncMobileDialogOffset()});

$('#compare-from').addEventListener('change',()=>applyRange($('#compare-from').value,$('#compare-to').value));
$('#compare-to').addEventListener('change',()=>applyRange($('#compare-from').value,$('#compare-to').value));
dialog.querySelectorAll('[data-compare-days]').forEach(node=>node.addEventListener('click',()=>{
 if(!model)return;const days=Number(node.dataset.compareDays);applyRange(clamp(D.shift(range.to,-days+1),bounds.from,bounds.to),range.to);
}));
$('#compare-dashboard-period').addEventListener('click',()=>{const from=$('#from')?.value,to=$('#to')?.value;if(from&&to)applyRange(from,to)});
dialog.querySelectorAll('[data-compare-chart]').forEach(node=>node.addEventListener('click',()=>{chartType=node.dataset.compareChart;renderAnalysis()}));
dialog.querySelectorAll('[data-compare-mode]').forEach(node=>node.addEventListener('click',()=>{valueMode=node.dataset.compareMode;renderAnalysis()}));

$('#file-input')?.addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file||file.size>C.APP_CONFIG.maxImportBytes)return;
 try{await parseBuffer(await file.arrayBuffer(),file.name,C.APP_CONFIG.sourceKinds.USER)}catch(error){console.warn('Comparison model kept previous source:',error)}
});

root.ContourCompare={normalize:normalized,maxSeries:MAX_SERIES};
if(typeof module!=='undefined')module.exports=root.ContourCompare;
})(typeof window!=='undefined'?window:globalThis);