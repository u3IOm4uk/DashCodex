(async function(){
'use strict';
const S=ContourSource,D=ContourData,C=ContourConfig,V=ContourView,H=ContourCharts,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const {esc,fmt,shortDate,fullDate,icon}=V;
$$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
let data,sections,section,category,from,to,chartType='area',charts=[],current,tableRows=[],source=C.source(C.APP_CONFIG.sourceKinds.BUNDLED,C.APP_CONFIG.defaultWorkbook),generation=0;
let distributionView='bars',distributionIndex=0,graphMode='dynamics',detailChart=null,detailObserver=null;
let mainPlotWindow=null,mainPeriodDispose=null,detailPeriodDispose=null;
const droneModes={};let suppressRailClick=false,categorySizeLock=null,returningToTop=false;
const splitCategory=c=>['assault','ongoing','territory','losses','positions','drones'].includes(c.id)&&c.fields.length>1;
$('#analysis-grid').insertAdjacentHTML('beforebegin','<div id="drone-anchor"></div><section id="drone-types" class="panel drone-types" aria-label="Типи БпС противника" hidden></section>');
$('#distribution-subtitle').insertAdjacentHTML('afterend','<div id="distribution-controls" class="distribution-controls"></div>');
const groupNames=[...C.GROUP_NAMES];
const groupLabel=n=>n.replace('УВ (с) ','').replaceAll('"','');
const palette=[D.colors.gold,D.colors.blue,D.colors.red,D.colors.green,D.colors.violet,D.colors.cyan,'#8e9ba1'];
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function empty(el,text='Немає даних за цей період',note='Змініть період або завантажте іншу книгу.'){el.innerHTML=`<div class="empty">${esc(text)}<small>${esc(note)}</small></div>`}
function chartError(el,error){console.error(error);empty(el,'Не вдалося побудувати графік','Табличні дані залишаються доступними. Спробуйте змінити період або категорію.')}
function setRange(days=7){mainPlotWindow=null;const dates=data.sheets[section.sheet].dates;to=dates.at(-1);from=days==='all'?dates[0]:D.shift(to,-Number(days)+1);$('#from').value=from;$('#to').value=to;syncPeriodLabel();$$('[data-days]').forEach(b=>b.classList.toggle('active',b.dataset.days===String(days)))}
function selectSection(id){distributionIndex=0;section=sections.find(s=>s.id===id)||sections[0];category=section.categories[0];setRange(7);render()}
function selectCategory(id){
 categorySizeLock=document.body.classList.contains('cards-away');returningToTop=scrollY>0;
 distributionIndex=0;graphMode=['territory','positions'].includes(id)?'balance':'dynamics';const wasOpen=$('#navigation-dialog').open;category=section.categories.find(c=>c.id===id)||section.categories[0];if(category.id==='drones')category=droneCategory({id:'other'});
 if(wasOpen)$('#navigation-dialog').close();render();followCategory();ContourNavigation.scrollCategory();dockScroll();
}
function navigation(){
$('#sheet-sections').innerHTML=sections.map(s=>`<button data-section="${s.id}" class="${s.id===section.id?'active':''}" aria-pressed="${s.id===section.id}">${esc(s.short)}</button>`).join('');
const cats=section.categories.map((c,i)=>`<button class="category-button ${c.id===category.id?'active':''}" data-category="${c.id}" aria-pressed="${c.id===category.id}"><span class="cat-index">${String(i+1).padStart(2,'0')}</span><span>${esc(c.name)}</span>${c.id===category.id?'<span class="cat-arrow">↗</span>':''}</button>`).join('');
$('#inline-sections').innerHTML=sections.map(s=>`<button data-section="${s.id}" aria-pressed="${s.id===section.id}">${icon(s.icon)}${esc(s.short)}</button>`).join('');$('#sheet-categories').innerHTML=cats;
$$('[data-section]').forEach(b=>b.onclick=()=>selectSection(b.dataset.section));$$('[data-category]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.category));
}
function spark(values,color){const finite=values.filter(v=>v!==null);if(!finite.length)return '<div class="spark"></div>';const lo=Math.min(...finite),hi=Math.max(...finite),pad=(hi-lo)*.15||Math.max(Math.abs(hi)*.05,1),min=lo-pad,max=hi+pad,h=27,w=180;let path='',gap=true;values.forEach((v,i)=>{if(v===null){gap=true;return}const x=i*w/Math.max(values.length-1,1),y=h-(v-min)/(max-min)*h+4;path+=`${gap?'M':'L'}${x.toFixed(1)},${y.toFixed(1)} `;gap=false});return `<svg class="spark" aria-hidden="true" viewBox="0 0 180 36" preserveAspectRatio="none"><path d="M0 34H180" stroke="${color}" opacity=".12"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>${from===to?`<line x1="${sparkX(values.length)}" x2="${sparkX(values.length)}" y1="0" y2="36" stroke="#c2bd51" stroke-dasharray="3 3"/>`:''}</svg>`}
function sparkX(length){const r=D.contextRange(data.sheets[section.sheet].dates,from,to);return Math.max(0,Math.min(180,(Date.parse(from)-Date.parse(r.from))/864e5*180/Math.max(length-1,1)))}
const signed=v=>v===null?'—':(v>0?'+':'')+fmt(v);
function percentNote(a,p,i){const c=D.change(a.totals[i],p.totals[i],a.complete&&p.complete);return c.percent===null?(c.delta===null?'Немає бази порівняння':'База попереднього періоду: 0'):signed(c.percent)+'% до попереднього періоду'}
function changeBadge(a,p,i){const c=D.change(a.totals[i],p.totals[i],a.complete&&p.complete),label=c.percent===null?(c.delta===null?'Немає порівняння':'База: 0'): `${c.percent>0?'↗':c.percent<0?'↘':'→'} ${c.percent>0?'+':''}${fmt(c.percent)}%`;return `<span class="change-badge" title="${esc(percentNote(a,p,i))}" aria-label="${esc(percentNote(a,p,i))}">${label}</span>`}
function metrics(){const row=$('#metrics'),previousScroll=row.scrollLeft;row.innerHTML=section.categories.map(c=>{
 if(c.id==='drones')c={...c,fields:['FPV-дрони',C.WORKBOOK_SCHEMA.fields.ops.dronesOther],labels:['FPV','Інші БпС'],colors:['#e58caf',D.colors.gold]};
 const a=D.aggregate(data,section,c,from,to),range=D.contextRange(data.sheets[section.sheet].dates,from,to),plot=D.aggregate(data,section,c,range.from,range.to),prev=D.aggregate(data,section,c,D.shift(from,-a.days.length),D.shift(from,-1)),paired=splitCategory(c),indices=paired?[0,1]:[0];
 const balance=c.id==='territory'?(a.totals.every(v=>v!==null)?a.totals[0]-a.totals[1]:null):null;
 return '<button class="metric-card '+(paired?'metric-card-paired ':'')+(category.id===c.id?'active':'')+'" data-metric="'+c.id+'" aria-pressed="'+(category.id===c.id)+'"><span class="metric-top">'+esc(c.name)+'</span><div class="card-stats '+(paired?'paired':'')+'">'+indices.map(j=>'<div class="metric-series" style="--series-color:'+c.colors[j]+'"><div class="metric-numbers"><span class="stat-label">'+(paired||c.fields.length>1?esc(c.labels[j]):'За період')+'</span><span class="stat-value"><strong>'+fmt(a.totals[j])+'</strong>'+(c.id!=='territory'?changeBadge(a,prev,j):'')+'</span></div><div class="metric-trend">'+miniTooltip(spark(plot.series[j],c.colors[j]),plot.series[j],plot.days,c.name===c.labels[j]?c.name:c.name+' · '+c.labels[j],c.colors[j])+'</div></div>').join('')+'</div>'+(c.id==='territory'?'<span class="metric-balance" title="Відновлено мінус втрачено">Δ '+signed(balance)+'</span>':'')+(a.present<a.days.length?'<span class="card-missing">'+(a.present?'Без даних: '+(a.days.length-a.present)+' із '+a.days.length+' днів':'Немає даних за період')+'</span>':'')+'</button>';
 }).join('');row.scrollLeft=previousScroll;$$('[data-metric]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.metric));}
function followCategory(){const r=$('#metrics'),cards=[...r.children],i=cards.findIndex(c=>c.dataset.metric===category.id);if(i<0)return;const bounds=r.getBoundingClientRect(),box=cards[i].getBoundingClientRect();const ahead=cards.slice(i+1).filter(c=>c.getBoundingClientRect().right<=bounds.right).length;let dx=0;if(box.left<bounds.left)dx=box.left-bounds.left-4;else if(box.right>bounds.right||ahead<=2){const next=cards[Math.min(cards.length-1,i+3)];dx=box.right>bounds.right?box.right-bounds.right+4:Math.max(0,Math.min(next.getBoundingClientRect().right-bounds.right+4,box.left-bounds.left-4))}if(dx)r.scrollBy({left:dx,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
function dragRail(rail){let drag=null;rail.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,left:rail.scrollLeft,moved:false};});rail.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>6&&!drag.moved){drag.moved=true;rail.setPointerCapture(e.pointerId);rail.classList.add('is-dragging')}if(drag.moved){e.preventDefault();rail.scrollLeft=drag.left-dx}});const end=()=>{if(!drag)return;if(drag.moved){suppressRailClick=true;setTimeout(()=>{suppressRailClick=false},0)}rail.classList.remove('is-dragging');drag=null};rail.addEventListener('pointerleave',()=>{if(drag&&!drag.moved)drag=null});rail.addEventListener('pointerup',end);rail.addEventListener('pointercancel',end);rail.addEventListener('lostpointercapture',end);rail.addEventListener('click',e=>{if(suppressRailClick){e.preventDefault();e.stopImmediatePropagation()}},true);rail.addEventListener('dragstart',e=>e.preventDefault());}
dragRail($('#metrics'));
function droneCategory(type){const base=section.categories.find(c=>c.id==='drones');if(type?.id==='other')return {...base,name:'БпС без FPV',fields:[C.WORKBOOK_SCHEMA.fields.ops.dronesOther],labels:['Інші БпС (без FPV)'],colors:[D.colors.gold],droneType:'other'};return type?{...base,name:'БпС · '+type.name,fields:[type.field],labels:[type.name],colors:[type.color],droneType:type.id}:base}
function droneBreakdown(){return D.droneTypes.map(type=>({...type,value:D.aggregate(data,section,droneCategory(type),from,to).totals[0]}))}
function miniChart(values,color,mode,days,label){
 const svg=mode==='area'?spark(values,color):H.miniBar({dataApi:D,values,color,days,selectedDay:from===to?from:null,fmt,fullDate});
 return miniTooltip(svg,values,days,label,color,mode);
}
function miniTooltip(svg,values,days,label,color,mode='area'){
 return `<span class="mini-hover" data-mini-points="${esc(JSON.stringify({values,days,label,color,mode}))}">${svg}</span>`;
}
const miniTip=document.createElement('div');miniTip.id='mini-tooltip';miniTip.setAttribute('role','tooltip');miniTip.hidden=true;document.body.append(miniTip);
const miniPoints=new WeakMap();
function hideMiniTip(){miniTip.hidden=true}
document.addEventListener('pointermove',e=>{
 const host=e.target.closest?.('.mini-hover');if(!host||e.buttons||e.pointerType==='touch'){hideMiniTip();return}
 const box=host.getBoundingClientRect();if(box.height<3){hideMiniTip();return}
 if(!miniPoints.has(host))miniPoints.set(host,JSON.parse(host.dataset.miniPoints));
 const point=miniPoints.get(host),fraction=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width));
 const i=Math.min(point.days.length-1,point.mode==='bar'?Math.floor(fraction*point.days.length):Math.round(fraction*(point.days.length-1)));
 if(i<0){hideMiniTip();return}
 miniTip.innerHTML=`<div>${esc(fullDate(point.days[i]))}</div><span><i style="background:${point.color}"></i>${esc(point.label)} <strong>${fmt(point.values[i])}</strong></span>`;
 miniTip.hidden=false;const rect=miniTip.getBoundingClientRect();
 miniTip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,e.clientX+14))+'px';
 miniTip.style.top=Math.max(8,e.clientY+18+rect.height>innerHeight?e.clientY-rect.height-12:e.clientY+18)+'px';
});
document.addEventListener('pointerout',e=>{if(e.target.closest?.('.mini-hover')&&!e.relatedTarget?.closest?.('.mini-hover'))hideMiniTip()});
document.addEventListener('scroll',hideMiniTip,true);document.addEventListener('pointerdown',hideMiniTip);document.addEventListener('keydown',e=>{if(e.key==='Escape')hideMiniTip()});

function mountPlotPeriod(host,initial,onChange,currentRange=initial){
 let range={...currentRange},timer;const controller=new AbortController(),dates=data.sheets[section.sheet].dates;
 const controls=document.createElement('div');controls.className='chart-period-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Період графіка');
 controls.innerHTML='<span>Період графіка</span><button type="button" data-plot-days="7">7 днів</button><button type="button" data-plot-days="30">30 днів</button><button type="button" data-plot-days="reset">Обраний</button><small>Колесо: ↑ наблизити · ↓ розширити</small>';
 host.before(controls);
 const sync=()=>{host.dataset.plotFrom=range.from;host.dataset.plotTo=range.to;controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.plotDays==='reset'?false:String(Math.round((Date.parse(range.to)-Date.parse(range.from))/864e5)+1)===b.dataset.plotDays))};
 const apply=()=>{clearTimeout(timer);sync();onChange({...range})};
 controls.onclick=e=>{const b=e.target.closest('[data-plot-days]');if(!b)return;range=b.dataset.plotDays==='reset'?{...initial}:H.periodRange(dates,{from:initial.from,to:initial.to},Number(b.dataset.plotDays),1);apply()};
 host.addEventListener('wheel',e=>{
  if(e.ctrlKey||!e.deltaY||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
  e.preventDefault();hideMiniTip();
  const box=(host.querySelector('.apexcharts-grid')||host).getBoundingClientRect(),anchor=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width));
  const count=Math.round((Date.parse(range.to)-Date.parse(range.from))/864e5)+1,next=e.deltaY>0?Math.max(count+1,Math.ceil(count*1.35)):Math.max(1,Math.floor(count/1.35));
  const resized=H.periodRange(dates,range,next,anchor);if(resized.from===range.from&&resized.to===range.to)return;
  range=resized;clearTimeout(timer);timer=setTimeout(apply,90);
 },{passive:false,signal:controller.signal});
 sync();return ()=>{clearTimeout(timer);controller.abort();controls.remove()};
}
const modeLabel=H.modeLabel;
function renderDroneTypes(){
 const panel=$('#drone-types'),previousScroll=panel.querySelector('.drone-type-grid')?.scrollLeft||0;
 panel.hidden=category.id!=='drones';$('#drone-anchor').hidden=panel.hidden;if(panel.hidden){panel.innerHTML='';panel.classList.remove('drone-compact','drone-row');panel.style.removeProperty('margin-bottom');return}
 const rows=droneBreakdown(),all=D.aggregate(data,section,droneCategory(),from,to).totals[0],typed=D.sum(rows.map(r=>r.value)),difference=all!==null&&typed!==null?all-typed:null;
 const cards=[rows.find(r=>r.id==='fpv'),...rows.filter(r=>r.id!=='fpv')],cache=new Map();
 panel.innerHTML=`<div class="drone-heading"><div><h3>Типи БпС <span>· усього ${fmt(all)}</span></h3></div><button id="drone-overview" class="text-button">Огляд без FPV</button></div><div class="drone-type-grid">${cards.map(r=>{
 const cat=droneCategory(r),a=D.aggregate(data,section,cat,from,to),prev=D.aggregate(data,section,cat,D.shift(from,-a.days.length),D.shift(from,-1)),range=D.contextRange(data.sheets[section.sheet].dates,from,to),plot=D.aggregate(data,section,cat,range.from,range.to),days=plot.days,raw=plot.series[0],mode=droneModes[r.id]||'area';cache.set(r.id,{r,days,raw});
 return `<article class="drone-type ${category.droneType===r.id?'active':''}" style="--type-color:${r.color}" data-drone-card="${r.id}"><button class="drone-select" data-drone="${r.id}" aria-pressed="${category.droneType===r.id}"><span class="drone-type-name">${esc(r.name)}</span><span class="drone-type-number"><span>${fmt(r.value)}</span>${changeBadge(a,prev,0)}</span></button><div class="drone-mini">${miniChart(raw,r.color,mode,days,r.name)}</div><div class="drone-chart-modes" aria-label="Графік: ${esc(r.name)}">${['area','bar'].map(m=>`<button data-mini="${r.id}" data-mode="${m}" aria-label="${esc(r.name)}: ${modeLabel(m)}" aria-pressed="${mode===m}">${icon(m==='area'?'trend':'bars')}</button>`).join('')}</div></article>`;
 }).join('')}</div><p class="drone-source-note">Зміни % — до попереднього періоду. Автомасштаб; вісь може не починатися з нуля.${difference!==null&&Math.abs(difference)>.00001?' Сума типів не збігається із загальним підсумком.':difference===null?' Для звірки типів бракує даних.':''}</p>`;
 $$('[data-drone]').forEach(b=>b.onclick=()=>{category=droneCategory(b.dataset.drone==='other'?{id:'other'}:D.droneTypes.find(t=>t.id===b.dataset.drone));distributionIndex=0;render();$('[data-drone="'+b.dataset.drone+'"]').focus({preventScroll:true})});
 $$('.drone-mini').forEach(host=>host.onclick=()=>host.closest('.drone-type').querySelector('[data-drone]').click());
 $$('[data-mini]').forEach(b=>b.onclick=()=>{const id=b.dataset.mini,mode=b.dataset.mode,item=cache.get(id),card=b.closest('.drone-type');droneModes[id]=mode;card.querySelector('.drone-mini').innerHTML=miniChart(item.raw,item.r.color,mode,item.days,item.r.name);card.querySelectorAll('[data-mini]').forEach(x=>x.setAttribute('aria-pressed',x===b));});
 $('#drone-overview').onclick=()=>{category=droneCategory({id:'other'});distributionIndex=0;render()};
}
function temporalOptions(a,labels,colors,height=260,balance=false,mode=chartType){
 if(balance&&category.id==='positions')a={...a,series:[a.series[1],a.series[0]]};
 return H.temporalOptions({dataApi:D,aggregate:a,labels,colors,height,balance,mode,from,to,fmt,shortDate,fullDate,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
}
function plotData(group,window=null){const r=window||D.contextRange(data.sheets[section.sheet].dates,from,to);return D.aggregate(data,section,category,r.from,r.to,group)}
function detailRows(){
if(section.id==='ops'){const names=[...new Set(current.raw.map(r=>r.group))].filter(n=>n!==C.WORKBOOK_SCHEMA.rows.opsSummary);return names.map(name=>({name,values:category.fields.map((_,i)=>D.sum(current.raw.filter(r=>r.group===name).map(r=>D.values(r,category,section)[i]))),summary:groupNames.includes(name)}))}
if(section.id==='ovgp'){return [...new Set(current.rows.map(r=>r.name))].map(name=>({name,values:category.fields.map((_,i)=>D.sum(current.rows.filter(r=>r.name===name).map(r=>D.values(r,category,section)[i])))}))}
return current.days.map((date,j)=>({name:fullDate(date),date,values:current.series.map(s=>s[j])}));
}
function distribution(){
if(category.id==='drones'&&category.droneType==='other')return droneBreakdown().filter(r=>r.id!=='fpv').map(r=>({name:r.name,value:r.value,color:r.color}));
if(section.id==='personnel')return current.days.map((d,i)=>({name:shortDate(d),value:current.series[0][i],color:palette[i%palette.length]}));
if(section.id==='compare')return category.labels.map((name,i)=>({name,value:current.totals[i],color:category.colors[i]}));
if(section.id==='ovgp')return groupNames.map((name,i)=>({name:groupLabel(name),value:D.sum(current.rows.map(r=>r.groups[name]?.[0]??null)),color:palette[i%palette.length]}));
return tableRows.filter(r=>r.summary).map((r,i)=>({name:groupLabel(r.name),value:r.values[distributionIndex],color:palette[i%palette.length]}));
}
function renderTable(){const cols=category.labels;const first=section.id==='ovgp'?'Засіб':['compare','personnel'].includes(section.id)?'Дата':'Угруповання';$('#details-title').textContent=section.id==='ovgp'?'Облік за засобами':['compare','personnel'].includes(section.id)?'Поденний облік':'Облік за угрупованнями';$('#details-subtitle').textContent=category.name+' · '+fullDate(from)+' — '+fullDate(to);
$('#table-head').innerHTML=`<tr><th>${first}</th>${cols.map((c,i)=>`<th style="color:${category.colors[i]}">${esc(c)}</th>`).join('')}<th>Профіль</th></tr>`;
const max=Math.max(...tableRows.map(r=>r.values[0]||0),1);
$('#table-body').innerHTML=tableRows.map((r,i)=>`<tr><td><button class="row-button" data-row="${i}" aria-label="Деталі: ${esc(r.name)}"><span class="row-index">${String(i+1).padStart(2,'0')}</span><span class="row-name">${esc(r.name)}</span></button></td>${r.values.map((v,j)=>`<td style="color:${category.colors[j]}">${fmt(v)}</td>`).join('')}<td><div class="table-bar" aria-hidden="true"><i style="width:${(r.values[0]||0)/max*100}%"></i></div></td></tr>`).join('')||`<tr><td colspan="${cols.length+2}">Немає записів за обраний період</td></tr>`;
$('#table-foot').textContent=section.id==='ops'?'Підсумкові угруповання та підпорядковані підрозділи показані окремо. Рядки не слід додавати між собою.':section.id==='ovgp'?'ВЗ — вогневі завдання. БП — боєприпаси. Підсумки взято зі стовпців «ВСЬОГО за СО».':'Пропуски позначені «—». Кожен рядок відповідає одній даті.';
$$('[data-row]').forEach(b=>b.onclick=()=>showDetail(tableRows[Number(b.dataset.row)]));}
function focus(){
if(splitCategory(category)){
const previous=D.aggregate(data,section,category,D.shift(from,-current.days.length),D.shift(from,-1));
$('#focus-content').innerHTML=category.labels.map((label,i)=>{const vals=current.series[i].filter(v=>v!==null),peak=vals.length?Math.max(...vals):null,day=peak===null?null:current.days[current.series[i].indexOf(peak)],delta=current.complete&&previous.complete&&current.totals[i]!==null&&previous.totals[i]!==null?current.totals[i]-previous.totals[i]:null;return `<div class="paired-focus" style="--series-color:${category.colors[i]}"><h4>${esc(label)}</h4><div class="context-row"><span>За період</span><strong>${fmt(current.totals[i])}</strong></div><div class="context-row"><span>Максимум за добу</span><strong>${fmt(peak)} <small>${fullDate(day)}</small></strong></div><div class="context-row"><span>Середнє за наявні дні</span><strong>${fmt(vals.length?D.sum(vals)/vals.length:null)}</strong></div>${category.id==='territory'?'':`<div class="context-row"><span>До попереднього періоду</span><strong>${percentNote(current,previous,i)}</strong></div>`}</div>`}).join('')+`<p class="focus-note">${category.id==='territory'?'Баланс: '+signed(current.totals.every(v=>v!==null)?current.totals[0]-current.totals[1]:null)+'. Відновлено мінус втрачено. Одиниця площі в заголовках джерела не вказана. ':''}${category.id==='territory'?'Додатний баланс — відновлено більше, ніж втрачено.':'Зміна порівнює повні періоди однакової тривалості.'}</p>`;return;
}
const vals=current.series[0].filter(v=>v!==null),max=vals.length?Math.max(...vals):null;const maxDate=max===null?null:current.days[current.series[0].indexOf(max)];const avg=vals.length?D.sum(vals)/vals.length:null;const previous=D.aggregate(data,section,category,D.shift(from,-current.days.length),D.shift(from,-1));const delta=current.complete&&previous.complete&&current.totals[0]!==null&&previous.totals[0]!==null?current.totals[0]-previous.totals[0]:null;
$('#focus-content').innerHTML=`<div class="focus-label">Максимум за добу · ${esc(category.labels[0])}</div><div class="focus-value">${fmt(max)}<small>${esc(category.unit)}</small></div><div class="focus-date">${fullDate(maxDate)}</div><div class="focus-rule"></div><div class="context-row"><span>Середнє за наявні дні</span><strong>${fmt(avg)}</strong></div><div class="context-row"><span>Зміна до попереднього періоду</span><strong>${delta!==null&&delta>0?'+':''}${fmt(delta)}</strong></div><div class="context-row"><span>Повнота періоду</span><strong>${current.present} / ${current.days.length} днів</strong></div><p class="focus-note">${delta===null?'Порівняння доступне, коли обидва періоди повністю забезпечені даними.':'Порівняння з попереднім періодом такої самої тривалості.'} ${category.id==='territory'?'Баланс: '+signed(current.totals.every(v=>v!==null)?current.totals[0]-current.totals[1]:null)+'. Відновлено мінус втрачено. Одиниця площі в заголовках джерела не вказана.':''}</p>`;
}
async function render(){if(!data||!category)return;hideMiniTip();mainPeriodDispose?.();mainPeriodDispose=null;const epoch=++generation;charts.forEach(c=>c.destroy());charts=[];navigation();metrics();current=D.aggregate(data,section,category,from,to);tableRows=detailRows();$('#page-title').innerHTML=esc(section.name)+'<span>.</span>';$('#section-code').textContent=String(sections.indexOf(section)+1).padStart(2,'0');$('#category-title').textContent=category.name;$('#page-subtitle').textContent=section.id==='ovgp'?'Вогневі завдання та боєприпаси за даними обліку':'Динаміка показників за обраний період';$('#period-note').textContent='Дані до '+fullDate(data.sheets[section.sheet].dates.at(-1));$('#coverage').hidden=current.complete;$('#coverage').textContent='Дані за '+current.present+' із '+current.days.length+' днів';$('.analysis-heading .eyebrow').textContent='Категорія '+(section.categories.findIndex(c=>c.id===category.id)+1)+' із '+section.categories.length;
let notice='';if(!current.present)notice='За обраний період немає даних. Оберіть інший діапазон дат.';else if(!current.complete)notice=`Неповний період: дані є за ${current.present} з ${current.days.length} днів. Підсумки враховують наявні записи.`;if(section.id==='ovgp'&&data.quality.find(q=>q.name==='ОВгП')?.errors)notice+=(notice?' ':'')+'У джерелі є помилки формул вартості. Вартість не включена до аналітики.';if(data.validation?.warnings?.length)notice+=(notice?' ':'')+`Перевірка структури книги: ${data.validation.warnings.length} попереджень. Деталі — «Про джерело».`;$('#notice').textContent=notice;$('#notice').hidden=!notice;
$('#chart-subtitle').textContent=fullDate(from)+' — '+fullDate(to)+' · '+category.unit;$('#chart-foot').innerHTML=category.labels.map((l,i)=>`<span><span style="color:${category.colors[i]}">●</span> ${esc(l)} <b>${fmt(current.totals[i])}</b></span>`).join('');renderTable();focus();renderDroneTypes();
$('#distribution-controls').innerHTML=splitCategory(category)?category.labels.map((label,i)=>`<button data-distribution="${i}" aria-pressed="${distributionIndex===i}" style="--series-color:${category.colors[i]}">${esc(label)}</button>`).join(''):'';
$$('[data-distribution]').forEach(b=>b.onclick=()=>{distributionIndex=Number(b.dataset.distribution);render();$('[data-distribution="'+distributionIndex+'"]').focus({preventScroll:true})});
$('#trend-chart').innerHTML='';const tasks=[];
const plot=plotData(undefined,mainPlotWindow),balance=['territory','positions'].includes(category.id)&&graphMode==='balance';
$('.trend-panel h3').textContent='Динаміка за період';
$('#chart-subtitle').textContent=fullDate(plot.days[0])+' — '+fullDate(plot.days.at(-1))+' · '+category.unit+' · Автомасштаб'+(!balance?' (вісь не обов’язково від 0)':'')+(from===to?' · контекст '+plot.days.length+' днів; обрану добу виділено':'');
let tabs=$('#graph-tabs');if(!tabs){$('.chart-controls').insertAdjacentHTML('afterbegin','<div id="graph-tabs" class="graph-tabs" role="group" aria-label="Категорія графіка"></div>');tabs=$('#graph-tabs')}
tabs.hidden=!['territory','positions'].includes(category.id);tabs.innerHTML=['dynamics','balance'].map(m=>`<button data-graph="${m}" aria-pressed="${graphMode===m}">${m==='balance'?'Баланс · Δ':'Динаміка'}</button>`).join('');
$$('[data-graph]').forEach(b=>b.onclick=()=>{graphMode=b.dataset.graph;render()});$('.trend-panel .segmented').hidden=false;$$('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chart===chartType)));
const host=$('#trend-chart');let visiblePlot=plot;const options=temporalOptions(plot,category.labels,category.colors,260,balance);
options.chart.events={click:(event,ctx,point)=>{const i=point.dataPointIndex;if(i>=0&&visiblePlot.days[i]&&visiblePlot.series.some(series=>series[i]!==null))applyAccountingPeriod(visiblePlot.days[i],visiblePlot.days[i]);}};
const mainChart=new ApexCharts(host,options);charts.push(mainChart);
let mainPending=mainChart.render().catch(error=>{if(epoch===generation)chartError(host,error)});tasks.push(mainPending);
const initial=D.contextRange(data.sheets[section.sheet].dates,from,to);
mainPeriodDispose=mountPlotPeriod(host,initial,range=>{
 mainPlotWindow=range;const next=plotData(undefined,range);visiblePlot=next;
 $('#chart-subtitle').textContent=fullDate(range.from)+' — '+fullDate(range.to)+' · '+category.unit+' · Період графіка; підсумки за фільтром';
 mainPending=mainPending.then(()=>{if(epoch!==generation)return;return mainChart.updateOptions(temporalOptions(next,category.labels,category.colors,260,balance),true,false)}).catch(error=>{if(epoch===generation)chartError(host,error)});
},mainPlotWindow||initial);
if(['territory','positions'].includes(category.id))$('#chart-foot').insertAdjacentHTML('beforeend',`<span class="balance-total">Баланс <b>${signed(current.totals.every(v=>v!==null)?(category.id==='positions'?current.totals[1]-current.totals[0]:current.totals[0]-current.totals[1]):null)}</b> · відновлено − втрачено</span>`);
const distributionRows=distribution(),hasMissingDistribution=distributionRows.some(r=>r.value===null),dist=distributionRows.filter(r=>r.value!==null&&r.value>=0).sort((a,b)=>b.value-a.value),total=D.sum(dist.map(r=>r.value)),max=Math.max(...dist.map(r=>r.value),1);
$('#distribution-donut').hidden=distributionView!=='donut';$('#distribution-legend').hidden=distributionView==='donut';$('#distribution-donut').innerHTML=H.distributionDonut(dist,{fmt,esc});$$('[data-distribution-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.distributionView===distributionView));
$('#distribution-subtitle').textContent=section.id==='compare'?'СОУ та противник':section.id==='personnel'?'Розподіл за днями':category.id==='drones'&&category.droneType==='other'?'Інші БпС · без FPV':category.labels[distributionIndex]+' · за угрупованнями';
$('#distribution-legend').innerHTML=(dist.length?dist.map(r=>`<div class="distribution-item"><div><span>${esc(r.name)}</span><strong>${fmt(r.value)}</strong><small>${total?fmt(r.value/total*100)+'%':'0%'}</small></div><div class="distribution-track"><i style="--bar:${r.color};width:${r.value/max*100}%"></i></div></div>`).join(''):'<p class="focus-note">Немає даних для розподілу</p>')+(hasMissingDistribution?'<p class="focus-note">Частки розраховано лише за наявними числовими значеннями; пропуски не прирівнюються до нуля.</p>':'');
if(section.id==='personnel'&&current.rows.length){const latest=[...current.rows].sort((a,b)=>a.date.localeCompare(b.date)).at(-1),key=category.fields[0].replace('_доба','');$('#focus-content').insertAdjacentHTML('beforeend',`<div class="focus-rule"></div><div class="focus-label">Станом на ${fullDate(latest.date)}</div><div class="context-row"><span>З початку року</span><strong>${fmt(D.number(latest[key+'_рік']))}</strong></div><div class="context-row"><span>Накопичений підсумок</span><strong>${fmt(D.number(latest[key+'_всього']))}</strong></div>`)}
await Promise.allSettled(tasks);if(epoch!==generation)return;dockScroll();
}
function showSource(){if(!data)return;const warnings=data.validation?.warnings||[];$('#source-content').innerHTML=`<p class="source-intro"><strong>${esc(source.name)}</strong><br>Тип джерела: ${source.kind===C.APP_CONFIG.sourceKinds.BUNDLED?'вбудована тестова книга':'імпортована користувачем книга'}. Книга опрацьовується у вашому браузері. Показники побудовані на збережених у файлі значеннях.</p>${warnings.map(w=>`<div class="source-card"><h3>Попередження структури · ${esc(w.sheet||'книга')}</h3><p class="warning">${esc(w.message)}</p></div>`).join('')}${data.quality.map(q=>`<div class="source-card"><h3>${esc(q.name)}</h3><p>${fmt(q.rows)} записів · ${fullDate(q.from)} — ${fullDate(q.to)}</p>${q.errors?`<p class="warning">${fmt(q.errors)} клітинок із помилками Excel.</p>`:''}${q.duplicates?`<p class="warning">${q.duplicates} повторів ключа. Перевірте первинні записи.</p>`:''}</div>`).join('')}<p class="source-method">Зведені показники ГОЧ беруться лише з рядків «${esc(C.WORKBOOK_SCHEMA.rows.opsSummary)}», щоб не дублювати підсумки угруповань. В ОВгП використовуються однойменні підсумкові стовпці. Нуль є значенням; пропуск або помилка позначаються «—». Накопичувальні колонки не підсумовуються за дні. Різні аркуші можуть мати різні останні дати. Зміна розділу відкриває його останні сім днів.</p><p class="source-method">Проведіть пальцем по заголовку детального огляду, щоб змінити категорію. Таблиці та картки прокручуються окремо.</p>`;$('#source-dialog').showModal()}
function mountDetailTrend(a,labels,colors,selected=null,detailCategory=category,group){
 detailPeriodDispose?.();detailPeriodDispose=null;
 let mode=chartType;const active=selected===null?null:new Set(selected);
 const host=$('#detail-trend-chart');host.insertAdjacentHTML('beforebegin',`<div class="detail-chart-controls" role="group" aria-label="Тип графіка деталізації">${['area','bar'].map(m=>`<button data-detail-mode="${m}" aria-label="${modeLabel(m)}" aria-pressed="${mode===m}">${icon(m==='area'?'trend':'bars')}</button>`).join('')}</div>${active?`<div class="detail-chart-legend" role="group" aria-label="Типи БпС на графіку">${labels.map((l,i)=>`<button data-detail-type="${i}" style="--type-color:${colors[i]}" aria-pressed="${active.has(i)}">${esc(l)}</button>`).join('')}</div><p id="detail-legend-hint" class="detail-drone-note"></p>`:''}`);
 const chartHeight=()=>{const summary=host.closest('.detail-summary'),values=summary?.querySelector('.detail-values'),trend=host.closest('.detail-trend');return values&&innerWidth>650?Math.max(280,Math.round(values.getBoundingClientRect().height-(host.getBoundingClientRect().top-trend.getBoundingClientRect().top))):320};
 const options=()=>{const indices=active?labels.map((_,i)=>i).filter(i=>active.has(i)):labels.map((_,i)=>i),visible={...a,series:indices.map(i=>a.series[i])},names=indices.map(i=>labels[i]),options=temporalOptions(visible,names,indices.map(i=>colors[i]),260,false,mode);
 if(active){options.legend={show:false};const split=active.has(0)&&indices.some(i=>i!==0),other=D.integerAxis(indices.filter(i=>i!==0).flatMap(i=>a.series[i])),fpv=D.integerAxis(a.series[0]),firstOther=indices.find(i=>i!==0);options.yaxis=indices.map(i=>({...((split&&i===0)?fpv:(split?other:D.integerAxis(visible.series.flat()))),seriesName:labels[i],show:split?(i===0||i===firstOther):i===indices[0],opposite:split&&i===0,forceNiceScale:false,title:{text:split?(i===0?'FPV':'Інші типи БпС'):''},labels:{formatter:v=>fmt(Math.round(v))}}));if(!indices.length)options.yaxis=[{show:false}];options.tooltip={...options.tooltip,shared:true,intersect:false};$('#detail-legend-hint').textContent=indices.length?'Увімкніть потрібні типи легендою. '+(split?'FPV — права вісь; інші типи — ліва.':'Вибрані типи мають спільну шкалу.'):'Оберіть хоча б один тип БпС у легенді.';}
 options.chart.height=chartHeight();options.chart.animations={enabled:false};return options};
 let chart=new ApexCharts(host,options());detailChart=chart;let pending=chart.render();
 const detailFailure=message=>{chartError(host,new Error(message));notify(message)};
 const refresh=()=>{pending=pending.then(()=>{if(detailChart!==chart||!$('#detail-dialog').open)return;chart.destroy();chart=new ApexCharts(host,options());detailChart=chart;return chart.render()}).catch(()=>detailFailure('Не вдалося оновити графік деталізації.'))};
 $$('[data-detail-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.detailMode;$$('[data-detail-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));refresh()});
 $$('[data-detail-type]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.detailType);active.has(i)?active.delete(i):active.add(i);b.setAttribute('aria-pressed',active.has(i));refresh()});
 detailPeriodDispose=mountPlotPeriod(host,{from:a.days[0],to:a.days.at(-1)},range=>{
  a=D.aggregate(data,section,detailCategory,range.from,range.to,group);
  host.closest('.detail-trend').querySelector('p:not(.detail-drone-note)').textContent=fullDate(range.from)+' — '+fullDate(range.to);
  refresh();
 });
 pending=pending.catch(()=>detailFailure('Не вдалося відобразити графік деталізації.'));
 const values=host.closest('.detail-summary')?.querySelector('.detail-values');if(values){detailObserver?.disconnect();detailObserver=new ResizeObserver(()=>{pending=pending.then(()=>{if(detailChart===chart&&$('#detail-dialog').open)return chart.updateOptions({chart:{height:chartHeight()}},false,false)}).catch(()=>{});});detailObserver.observe(values)}
}
function showDroneDetail(row){
 const types=[D.droneTypes.find(t=>t.id==='fpv'),...D.droneTypes.filter(t=>t.id!=='fpv')],cat={...category,fields:types.map(t=>t.field),labels:types.map(t=>t.name),colors:types.map(t=>t.color)},a=D.aggregate(data,section,cat,from,to,row.name),range=D.contextRange(data.sheets[section.sheet].dates,from,to),plot=D.aggregate(data,section,cat,range.from,range.to,row.name);
 $('#detail-content').innerHTML=`<p class="source-intro">Типи БпС · ${fullDate(from)} — ${fullDate(to)}</p><div class="detail-summary detail-drone-summary"><div class="detail-values">${types.map((t,i)=>`<div><span>${esc(t.name)}</span><strong style="color:${t.color}">${fmt(a.totals[i])}</strong></div>`).join('')}</div><div class="detail-trend"><h3>Тенденція за типами БпС</h3><p>${fullDate(plot.days[0])} — ${fullDate(plot.days.at(-1))}${from===to?' · обрану добу виділено':''}</p><div id="detail-trend-chart"></div></div></div><div class="table-wrap detail-drone-table" tabindex="0" role="region" aria-label="Поденні дані за типами БпС"><table><thead><tr><th scope="col">Дата</th>${types.map(t=>`<th scope="col">${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${a.days.map((d,j)=>`<tr><th scope="row">${fullDate(d)}</th>${a.series.map(series=>`<td>${fmt(series[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 $('#detail-dialog').showModal();mountDetailTrend(plot,cat.labels,cat.colors,category.droneType&&category.droneType!=='other'?[types.findIndex(t=>t.id===category.droneType)]:types.map((_,i)=>i).filter(i=>i!==0),cat,row.name);
}
function showDetail(row){detailPeriodDispose?.();detailPeriodDispose=null;if(detailChart){detailChart.destroy();detailChart=null;}$('#detail-name').textContent=row.name;if(section.id==='ops'&&category.id==='drones'){showDroneDetail(row);return}$('#detail-content').innerHTML=`<p class="source-intro">${esc(category.name)} · ${fullDate(from)} — ${fullDate(to)}</p><div class="detail-values">${category.labels.map((l,i)=>`<div><span>${esc(l)}</span><strong style="color:${category.colors[i]}">${fmt(row.values[i])}</strong></div>`).join('')}</div>`;
if(section.id==='ops'){const a=D.aggregate(data,section,category,from,to,row.name);$('#detail-content').innerHTML+=`<div class="table-wrap"><table><thead><tr><th>Дата</th>${category.labels.map(l=>`<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${a.days.map((d,j)=>`<tr><td>${fullDate(d)}</td>${a.series.map(s=>`<td>${fmt(s[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}else if(section.id==='ovgp'){const records=current.rows.filter(r=>r.name===row.name);$('#detail-content').innerHTML+=`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>ВЗ</th><th>БП</th></tr></thead><tbody>${records.map(r=>`<tr><td>${fullDate(r.date)}</td>${D.values(r,category,section).map(v=>`<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}$('#detail-dialog').showModal();if(section.id==='ops'){const a=plotData(row.name);$('.detail-values').insertAdjacentHTML('afterend','<div class="detail-trend"><h3>Тенденція</h3><p>'+fullDate(a.days[0])+' — '+fullDate(a.days.at(-1))+(from===to?' · обрану добу виділено':'')+'</p><div id="detail-trend-chart"></div></div>');const wrap=document.createElement('div');wrap.className='detail-summary';$('.detail-values').before(wrap);wrap.append($('.detail-values'),$('.detail-trend'));mountDetailTrend(a,category.labels,category.colors,null,category,row.name);}}
async function load(readBuffer,name,kind=C.APP_CONFIG.sourceKinds.USER){const accepted=await S.load(readBuffer,name,kind);if(!accepted)return false;data=accepted.data;source=accepted.source;ContourUnits.setData(data);sections=D.sections(data);section=sections[0];category=section.categories[0];const bundled=source.kind===C.APP_CONFIG.sourceKinds.BUNDLED,warnings=data.validation?.warnings?.length||0;$('#source-label').textContent=(bundled?'Тестова книга підключена':'Книгу підключено')+(warnings?' · є попередження':'');$('.demo-badge').textContent=bundled?'ТЕСТОВІ ДАНІ':'ІМПОРТОВАНІ ДАНІ';$('#footer-source').textContent='Джерело: '+source.name;setRange(7);window.ContourCompare?.setSource(accepted);await render();return true}
$('#import-button').onclick=()=>$('#file-input').click();$('#file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>C.APP_CONFIG.maxImportBytes){notify(`Оберіть книгу розміром до ${Math.round(C.APP_CONFIG.maxImportBytes/1024/1024)} МБ.`);return}try{if(!await load(()=>file.arrayBuffer(),file.name,C.APP_CONFIG.sourceKinds.USER))return;notify(data.validation?.warnings?.length?'Книгу підключено з попередженнями':'Книгу підключено')}catch(err){notify('Не вдалося прочитати книгу: '+err.message)}finally{e.target.value=''}};
$$('[data-days]').forEach(b=>b.onclick=()=>{if(!data)return;setRange(b.dataset.days);render()});
function updateDates(event){
 if(!data)return;
 const next=D.alignDateRange($('#from').value,$('#to').value,event.target.id);
 const validation=D.validateDateRange(next.from,next.to);
 if(!validation.valid){notify(validation.reason);$('#from').value=from;$('#to').value=to;return}
 from=next.from;to=next.to;$('#from').value=from;$('#to').value=to;mainPlotWindow=null;
 $$('[data-days]').forEach(b=>b.classList.remove('active'));render();
}
$('#from').onchange=updateDates;$('#to').onchange=updateDates;
function syncPeriodLabel(){$('#period-label').textContent=from===to?fullDate(from):fullDate(from)+' — '+fullDate(to)}
function applyAccountingPeriod(start,end){const validation=D.validateDateRange(start,end);if(!validation.valid)return validation.reason;from=start;to=end;$('#from').value=from;$('#to').value=to;mainPlotWindow=null;syncPeriodLabel();$$('[data-days]').forEach(b=>b.classList.remove('active'));render();return null}
let periodMode='day';
function setPeriodMode(mode){periodMode=mode;$('#period-end-field').hidden=mode==='day';$('#period-title').textContent=mode==='day'?'Обрати дату':'Обрати період';$('#period-start-label').textContent=mode==='day'?'Дата':'Початок періоду';$$('[data-period-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.periodMode===mode))}
$('#period-open').onclick=()=>{if(!data)return;setPeriodMode('day');$('#period-start').value=to;$('#period-end').value=to;$('#period-error').hidden=true;$('#period-dialog').showModal();$('#period-start').focus()};
$$('[data-period-mode]').forEach(b=>b.onclick=()=>{setPeriodMode(b.dataset.periodMode);if(periodMode==='range'){$('#period-start').value=from;$('#period-end').value=to}});
for(const key of ['start','end'])$('#period-'+key).onchange=()=>{if(periodMode==='day')return;const next=D.alignDateRange($('#period-start').value,$('#period-end').value,key==='start'?'from':'to');$('#period-start').value=next.from;$('#period-end').value=next.to};
function applyPeriodSelection(){const start=$('#period-start').value,end=periodMode==='day'?start:$('#period-end').value,error=applyAccountingPeriod(start,end);if(error){$('#period-error').textContent=error;$('#period-error').hidden=false;return}$('#period-dialog').close()};
$('#period-dialog form').addEventListener('submit',event=>{event.preventDefault();applyPeriodSelection()});
$$('[data-period-cancel]').forEach(b=>b.onclick=()=>$('#period-dialog').close());
$$('[data-distribution-view]').forEach(b=>b.onclick=()=>{distributionView=b.dataset.distributionView;render()});

$$('[data-chart]').forEach(b=>b.onclick=()=>{chartType=b.dataset.chart;$$('[data-chart]').forEach(x=>x.classList.toggle('active',x===b));render()});
const step=n=>{if(!category)return;const c=section.categories;selectCategory(c[(c.findIndex(x=>x.id===category.id)+n+c.length)%c.length].id)};$('#previous').onclick=()=>step(-1);$('#next').onclick=()=>step(1);
const openNav=()=>{if(data)$('#navigation-dialog').showModal()};$('#mobile-menu').onclick=openNav;$('#source-button').onclick=showSource;$('#mobile-source').onclick=showSource;$('#mobile-overview').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('#mobile-dates').onclick=()=>{$('#period-open').click()};
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
let touch;$('.analysis-heading').addEventListener('touchstart',e=>{touch=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});$('.analysis-heading').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch[0],dy=e.changedTouches[0].clientY-touch[1];if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);touch=null},{passive:true});
$('#export-button').onclick=()=>{if(!current?.present){notify('Немає даних для експорту.');return}const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const rows=[['Категорія',category.name],['Період',from,to],['Назва',...category.labels],...tableRows.map(r=>[r.name,...r.values.map(v=>v===null?'':v)])];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Контур_${category.droneType||category.id}_${from}_${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV підготовлено')};
$('#detail-dialog').addEventListener('close',()=>{detailPeriodDispose?.();detailPeriodDispose=null;detailObserver?.disconnect();detailObserver=null;detailChart?.destroy();detailChart=null});
let scrolling=false,droneFrame=0,droneProgress=0,droneTarget=0;
function arrangeDroneRow(panel,singleRow){
 if(panel.classList.contains('drone-row')===singleRow)return;
 const cards=[...panel.querySelectorAll('.drone-type')],oldHeight=panel.getBoundingClientRect().height,before=cards.map(el=>({box:el.getBoundingClientRect(),badge:el.querySelector('.change-badge').getBoundingClientRect()}));
 panel.getAnimations().forEach(a=>a.cancel());panel.classList.remove('drone-reflow');cards.forEach(el=>{el.getAnimations().forEach(a=>a.cancel());el.querySelector('.change-badge').getAnimations().forEach(a=>a.cancel())});panel.classList.toggle('drone-row',singleRow);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const timing={duration:460,easing:'cubic-bezier(.22,1,.36,1)'};
 const movement=panel.animate([{height:oldHeight+'px'},{height:panel.getBoundingClientRect().height+'px'}],timing);panel.classList.add('drone-reflow');movement.finished.catch(()=>{}).finally(()=>{if(!panel.getAnimations().length)panel.classList.remove('drone-reflow')});
 cards.forEach((el,i)=>{const box=el.getBoundingClientRect(),old=before[i].box,badge=el.querySelector('.change-badge'),next=badge.getBoundingClientRect(),prev=before[i].badge;el.animate([{transformOrigin:'top left',transform:`translate(${old.left-box.left}px,${old.top-box.top}px) scale(${old.width/box.width},${old.height/box.height})`},{transformOrigin:'top left',transform:'none'}],timing);badge.animate([{transform:`translate(${prev.left-next.left-(old.left-box.left)}px,${prev.top-next.top-(old.top-box.top)}px)`},{transform:'none'}],timing)});
}
function compressDrones(target){
 droneTarget=target;if(droneFrame)return;
 const tick=()=>{const panel=$('#drone-types'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,wasComplete=droneProgress===1;droneProgress=reduced?droneTarget:droneProgress+(droneTarget-droneProgress)*.18;if(Math.abs(droneTarget-droneProgress)<.001)droneProgress=droneTarget;panel.style.setProperty('--drone-collapse',droneProgress);panel.classList.toggle('drone-compact',droneProgress>=.995);arrangeDroneRow(panel,droneTarget>=.995&&droneProgress>=.98);panel.querySelectorAll('.drone-chart-modes').forEach(el=>el.inert=droneProgress>=.95);
 // Keep the following panels below the moving sticky card until folding finishes.
 // Once folded, the retained flow offset lets subsequent scrolling pass underneath.
 if(!wasComplete||droneTarget<1){const offset=Math.max(0,panel.getBoundingClientRect().top-$('#drone-anchor').getBoundingClientRect().top);panel.style.marginBottom=(16+offset)+'px'}
 droneFrame=droneProgress===droneTarget?0:requestAnimationFrame(tick)};
 droneFrame=requestAnimationFrame(tick);
}
function dockScroll(){
 document.body.classList.toggle('is-scrolled',scrollY>70);
 const pinned=$('#dock-anchor').getBoundingClientRect().top<=$('.topbar').getBoundingClientRect().bottom+1;
 if(scrollY<=1)returningToTop=false;if(!returningToTop&&categorySizeLock===pinned)categorySizeLock=null;
 document.body.classList.toggle('cards-away',categorySizeLock??pinned);
 const dockBottom=$('#workspace-dock').getBoundingClientRect().bottom;document.documentElement.style.setProperty('--dock-bottom',dockBottom+'px');
 const panel=$('#drone-types');if(!panel.hidden){const distance=dockBottom+2-$('#drone-anchor').getBoundingClientRect().top;compressDrones(Math.max(0,Math.min(1,distance/180)))}
 scrolling=false;
}
addEventListener('scroll',()=>{if(!scrolling){scrolling=true;requestAnimationFrame(dockScroll)}},{passive:true});
addEventListener('scrollend',e=>{if(e.target===document){returningToTop=false;dockScroll()}});
addEventListener('wheel',()=>{returningToTop=false},{passive:true});
addEventListener('touchmove',()=>{returningToTop=false},{passive:true});
addEventListener('resize',()=>{dockScroll()});new ResizeObserver(()=>dockScroll()).observe($('#workspace-dock'));dockScroll();

const clock=()=>$('#clock').textContent=new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date());clock();setInterval(clock,30000);
try{await load(async()=>{const response=await fetch(encodeURI(C.APP_CONFIG.defaultWorkbook));if(!response.ok)throw new Error('Файл недоступний');return response.arrayBuffer()},C.APP_CONFIG.defaultWorkbook,C.APP_CONFIG.sourceKinds.BUNDLED)}catch(e){$('#source-label').textContent='Книгу не підключено';empty($('#metrics'),'Підключіть книгу Excel',`Натисніть «Імпорт Excel» і виберіть «${C.APP_CONFIG.defaultWorkbook}».`);$('#notice').hidden=false;$('#notice').textContent='Автоматичне завантаження недоступне. Скористайтеся імпортом Excel.';console.error(e)}
})();
