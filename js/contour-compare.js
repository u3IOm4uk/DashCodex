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
let catalog=[],selected=new Set(DEFAULT_SELECTION),chart=null,chartType='area',valueMode='normalized';
let range={from:null,to:null},bounds={from:null,to:null},unit='';

const dayStamp=day=>Date.parse(day+'T12:00:00Z');
const clamp=(value,min,max)=>value<min?min:value>max?max:value;
const daysBetween=(from,to)=>{const rows=[];for(let day=from;day<=to;day=D.shift(day,1))rows.push(day);return rows};
const mobileComparison=()=>matchMedia('(max-width:650px)').matches;
function syncMobileDialogOffset(){const nav=$('.mobile-nav'),height=nav?.getBoundingClientRect().height||64;dialog.style.setProperty('--compare-mobile-nav-height',height+'px')}

function flattenUnits(nodes,out=[]){for(const node of nodes||[]){out.push(node.name);flattenUnits(node.children,out)}return out}
const unitNames=[...new Set(flattenUnits(C.UNIT_HIERARCHY))];

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
 if(!model)return;
 $('#compare-source-note').textContent=`Джерело: ${sourceName}${sourceKind===C.APP_CONFIG.sourceKinds.BUNDLED?' · тестова книга':' · імпортована книга'}`;
 const from=$('#compare-from'),to=$('#compare-to');from.min=to.min=bounds.from;from.max=to.max=bounds.to;from.value=range.from;to.value=range.to;
 $('#compare-unit').innerHTML='<option value="">Загальний підсумок</option>'+unitNames.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');$('#compare-unit').value=unit;
 renderCatalog();syncButtons();renderAnalysis();
}

function renderCatalog(){
 const host=$('#compare-catalog'),sections=new Map();
 for(const item of catalog){if(!sections.has(item.section.id))sections.set(item.section.id,{name:item.sectionName,categories:new Map()});const sec=sections.get(item.section.id);if(!sec.categories.has(item.categoryName))sec.categories.set(item.categoryName,[]);sec.categories.get(item.categoryName).push(item)}
 host.innerHTML=[...sections.values()].map(sec=>`<details class="compare-section" open><summary>${esc(sec.name)}</summary>${[...sec.categories.entries()].map(([name,items])=>`<div class="compare-category"><h4>${esc(name)}</h4>${items.map(item=>{const checked=selected.has(item.id),disabled=!checked&&selected.size>=MAX_SERIES;return `<label class="compare-metric ${disabled?'is-disabled':''}"><input type="checkbox" data-compare-metric="${esc(item.id)}" ${checked?'checked':''} ${disabled?'disabled':''}><span>${esc(item.name)}</span><small>${esc(item.unit||'од.')}${item.supportsUnit?'':' · загальний'}</small></label>`}).join('')}</div>`).join('')}</details>`).join('');
 $('#compare-selected-count').textContent=`${selected.size} / ${MAX_SERIES}`;
 host.querySelectorAll('[data-compare-metric]').forEach(input=>input.addEventListener('change',()=>{
  const id=input.dataset.compareMetric;
  if(input.checked){if(selected.size>=MAX_SERIES){input.checked=false;setMessage(`Одночасно можна відобразити до ${MAX_SERIES} показників.`);return}selected.add(id)}else selected.delete(id);
  setMessage(selected.size?`Обрано ${selected.size} показник${selected.size===1?'':selected.size<5?'и':'ів'}.`:'Оберіть хоча б один показник.');renderCatalog();renderAnalysis();
 }));
}

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
function unitFor(item){return item.supportsUnit&&unit?unit:undefined}

function analysisRows(){
 const days=daysBetween(range.from,range.to),items=selectedItems();let unavailable=0,missing=0;
 const series=items.map((item,colorIndex)=>{
  const aggregate=D.aggregate(model,item.section,item.category,range.from,range.to,unitFor(item));
  const raw=aggregate.series[item.index]||days.map(()=>null);missing+=raw.filter(value=>value===null).length;
  const transformed=valueMode==='normalized'?normalized(raw):{values:raw,baseline:null};if(valueMode==='normalized'&&transformed.baseline===null)unavailable++;
  return {item,color:SERIES_COLORS[colorIndex%SERIES_COLORS.length],raw,values:transformed.values,baseline:transformed.baseline};
 });
 return {days,series,unavailable,missing};
}

function chartOptions(rows){
 const base=H.baseOptions(matchMedia('(prefers-reduced-motion: reduce)').matches),all=rows.series.flatMap(series=>series.values.filter(value=>value!==null));
 const limits=valueMode==='normalized'?D.axisRange(all):D.integerAxis(all,false);
 return {...base,chart:{...base.chart,type:chartType,height:420,zoom:{enabled:false}},series:rows.series.map(series=>({name:series.item.categoryName===series.item.name?series.item.name:`${series.item.categoryName} · ${series.item.name}`,data:rows.days.map((day,index)=>({x:dayStamp(day),y:series.values[index]}))})),colors:rows.series.map(series=>series.color),stroke:{...base.stroke,width:chartType==='area'?2.2:0},fill:chartType==='area'?{type:'gradient',gradient:{opacityFrom:.24,opacityTo:.02}}:{type:'solid',opacity:.9},plotOptions:{bar:{columnWidth:'62%',borderRadius:2}},xaxis:{type:'datetime',labels:{datetimeUTC:true,formatter:(value,stamp)=>shortDate(new Date(stamp).toISOString().slice(0,10))},axisBorder:{show:false},axisTicks:{show:false},tooltip:{enabled:false}},yaxis:{...limits,forceNiceScale:false,labels:{formatter:value=>valueMode==='normalized'?`${Math.round(value)}`:fmt(Math.round(value))},title:{text:valueMode==='normalized'?'Індекс, база = 100':'Абсолютне значення'}},tooltip:{theme:'dark',shared:true,intersect:false,x:{formatter:stamp=>fullDate(new Date(stamp).toISOString().slice(0,10))},y:{formatter:value=>value===null||value===undefined?'—':valueMode==='normalized'?`${fmt(Math.round(value*10)/10)} інд.`:fmt(value)}},legend:{...base.legend,onItemClick:{toggleDataSeries:true}}};
}

function renderTable(rows){
 const head=$('#compare-table-head'),body=$('#compare-table-body');
 head.innerHTML=`<tr><th>Дата</th>${rows.series.map(series=>`<th><span style="color:${series.color}">●</span> ${esc(series.item.name)}</th>`).join('')}</tr>`;
 body.innerHTML=rows.days.map((day,rowIndex)=>`<tr><th scope="row">${fullDate(day)}</th>${rows.series.map(series=>{const value=series.values[rowIndex];return `<td>${value===null?'—':valueMode==='normalized'?fmt(Math.round(value*10)/10):fmt(value)}</td>`}).join('')}</tr>`).join('');
}

function renderAnalysis(){
 if(!model||!range.from||!range.to)return;syncButtons();
 const items=selectedItems(),status=$('#compare-status');
 if(!items.length){chart?.destroy();chart=null;$('#compare-chart').innerHTML='';$('#compare-table-head').innerHTML='';$('#compare-table-body').innerHTML='';status.hidden=false;status.textContent='Оберіть показники ліворуч.';return}
 const validation=D.validateDateRange(range.from,range.to);if(!validation.valid){status.hidden=false;status.textContent=validation.reason;return}
 status.hidden=true;const rows=analysisRows();
 chart?.destroy();chart=null;$('#compare-chart').innerHTML='';
 try{chart=new ApexCharts($('#compare-chart'),chartOptions(rows));chart.render().catch(error=>{console.error(error);status.hidden=false;status.textContent='Не вдалося побудувати графік порівняння.'})}catch(error){console.error(error);status.hidden=false;status.textContent='Не вдалося побудувати графік порівняння.'}
 renderTable(rows);
 const notes=[];
 if(valueMode==='normalized')notes.push('Нормалізація: перше доступне ненульове значення кожної серії = 100.');else notes.push('Абсолютний режим використовує спільну шкалу; для показників різного порядку величини зручніше нормалізоване порівняння.');
 if(unit)notes.push(`Фільтр підрозділу «${unit}» застосовано лише до показників, де джерело має таку деталізацію.`);
 if(rows.unavailable)notes.push(`${rows.unavailable} сер. без ненульової бази не нормалізовано.`);
 if(rows.missing)notes.push('Пропуски залишаються «—» і не прирівнюються до нуля.');
 $('#compare-data-note').textContent=notes.join(' ');
 $('#compare-range-note').textContent=`${fullDate(range.from)} — ${fullDate(range.to)} · ${items.length} показник${items.length===1?'':items.length<5?'и':'ів'}`;
}

function applyRange(nextFrom,nextTo){
 if(!model)return;nextFrom=clamp(nextFrom,bounds.from,bounds.to);nextTo=clamp(nextTo,bounds.from,bounds.to);if(nextFrom>nextTo)[nextFrom,nextTo]=[nextTo,nextFrom];const validation=D.validateDateRange(nextFrom,nextTo);if(!validation.valid){setMessage(validation.reason);return}
 range={from:nextFrom,to:nextTo};$('#compare-from').value=range.from;$('#compare-to').value=range.to;renderAnalysis();
}

async function openComparison(){
 if(dialog.open)return;
 if(mobileComparison()){
  syncMobileDialogOffset();dialog.classList.add('compare-mobile-nav');dialog.show();
 }else{
  dialog.classList.remove('compare-mobile-nav');dialog.style.removeProperty('--compare-mobile-nav-height');dialog.showModal();
 }
 try{await ensureModel();renderShell()}catch(error){console.error(error);setLoading('Не вдалося підключити дані для порівняння. Імпортуйте Excel або повторіть спробу.')}
}
button.addEventListener('click',openComparison);mobileButton?.addEventListener('click',openComparison);
dialog.querySelector('[data-compare-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(!dialog.classList.contains('compare-mobile-nav')&&event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}});
dialog.addEventListener('close',()=>{chart?.destroy();chart=null;dialog.classList.remove('compare-mobile-nav');dialog.style.removeProperty('--compare-mobile-nav-height')});
['#mobile-overview','#mobile-menu'].forEach(selector=>$(selector)?.addEventListener('click',()=>{if(dialog.open&&dialog.classList.contains('compare-mobile-nav'))dialog.close()},true));
addEventListener('resize',()=>{if(dialog.open&&dialog.classList.contains('compare-mobile-nav'))syncMobileDialogOffset()});

$('#compare-from').addEventListener('change',()=>applyRange($('#compare-from').value,$('#compare-to').value));
$('#compare-to').addEventListener('change',()=>applyRange($('#compare-from').value,$('#compare-to').value));
dialog.querySelectorAll('[data-compare-days]').forEach(node=>node.addEventListener('click',()=>{
 if(!model)return;const days=Number(node.dataset.compareDays);applyRange(clamp(D.shift(range.to,-days+1),bounds.from,bounds.to),range.to);
}));
$('#compare-dashboard-period').addEventListener('click',()=>{const from=$('#from')?.value,to=$('#to')?.value;if(from&&to)applyRange(from,to)});
$('#compare-unit').addEventListener('change',event=>{unit=event.target.value;renderAnalysis()});
dialog.querySelectorAll('[data-compare-chart]').forEach(node=>node.addEventListener('click',()=>{chartType=node.dataset.compareChart;renderAnalysis()}));
dialog.querySelectorAll('[data-compare-mode]').forEach(node=>node.addEventListener('click',()=>{valueMode=node.dataset.compareMode;renderAnalysis()}));

$('#file-input')?.addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file||file.size>C.APP_CONFIG.maxImportBytes)return;
 try{await parseBuffer(await file.arrayBuffer(),file.name,C.APP_CONFIG.sourceKinds.USER)}catch(error){console.warn('Comparison model kept previous source:',error)}
});

root.ContourCompare={normalize:normalized,maxSeries:MAX_SERIES};
if(typeof module!=='undefined')module.exports=root.ContourCompare;
})(typeof window!=='undefined'?window:globalThis);