(function(root){
'use strict';
const C=root.ContourConfig||(typeof module!=='undefined'&&module.exports?require('./contour-config.js'):null);
if(!C)throw new Error('ContourConfig має бути завантажений перед ContourData.');
const S=C.WORKBOOK_SCHEMA,F=S.fields,P=C.APP_CONFIG.datePolicy,PERF=C.APP_CONFIG.performance;
const colors={blue:'#008FFB',red:'#FF4560',gold:'#c2bd51',green:'#10B981',violet:'#aa91de',cyan:'#5dc9d8'};
const metric=(id,name,fields,labels,ink,unit='од.')=>({id,name,fields:[...fields],labels,colors:ink,unit});
const operational=[
metric('shells','Обстріли',F.ops.shells,['Обстріли'],[colors.red]),
metric('rockets','Ракетні удари',F.ops.rockets,['Удари','Застосовано ракет'],[colors.red,colors.gold]),
metric('air','АУ / КАБ / КАР',F.ops.air,['Авіаудари','КАБ','КАР'],[colors.red,colors.gold,colors.violet]),
metric('assault','Штурмові дії',F.ops.assault,['СОУ','Противник'],[colors.blue,colors.red]),
metric('ongoing','Тривають зіткнення',F.ops.ongoing,['СОУ','Противник'],[colors.blue,colors.red]),
metric('positions','Позиції',F.ops.positions,['Втрачено','Відновлено'],[colors.red,colors.green]),
metric('territory','Території',F.ops.territory,['Відновлено','Втрачено'],[colors.blue,colors.red],'од. джерела'),
metric('losses','Втрати особового складу',F.ops.losses,['СОУ','Противник'],[colors.blue,colors.red],'осіб'),
metric('drones','БпС противника',F.ops.drones,['Удари БпЛА'],[colors.red])];
const comparative=[metric('ammo','Застосування БК',F.compare.ammo,['СОУ','Противник'],[colors.blue,colors.red]),metric('fpv','Застосування FPV',F.compare.fpv,['СОУ','Противник'],[colors.blue,colors.red])];
const droneTypes=S.droneTypes.map(t=>({...t}));
const personnel=[metric('personnel-total','Загальний облік',F.personnel.total,['Втрати за добу'],[colors.blue],'осіб'),metric('irreversible','Безповоротні',F.personnel.irreversible,['Безповоротні'],[colors.blue],'осіб'),metric('medical','Санітарні',F.personnel.medical,['Санітарні'],[colors.cyan],'осіб'),metric('missing','Зниклі безвісти',F.personnel.missing,['Зниклі безвісти'],[colors.gold],'осіб'),metric('captured','Полонені',F.personnel.captured,['Полонені'],[colors.violet],'осіб')];
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const sum=values=>!values.length||values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0);
function date(v){if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*864e5).toISOString().slice(0,10);if(typeof v==='string'){if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);const m=v.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`}return null}
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
function inclusiveDays(from,to){const a=Date.parse(from+'T12:00:00Z'),b=Date.parse(to+'T12:00:00Z');return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?Math.floor((b-a)/864e5)+1:null}
function validateDateRange(from,to,maxDays=P.maxManualRangeDays){const days=inclusiveDays(from,to);if(days===null)return {valid:false,days:null,reason:'Некоректний діапазон дат.'};if(days>maxDays)return {valid:false,days,reason:`Оберіть період тривалістю до ${maxDays} днів.`};return {valid:true,days,reason:null}}
const issue=(code,sheet,message)=>({code,sheet,message});
const fieldList=group=>[...new Set(Object.values(group).flatMap(v=>Array.isArray(v)?v:[]))];
function validateWorkbook(wb,XLSX){
const errors=[],warnings=[],rawSheets={};
if(!wb||!Array.isArray(wb.SheetNames)||!wb.SheetNames.length||!wb.Sheets){errors.push(issue('workbook-empty',null,'Книга Excel не містить доступних аркушів.'));return {valid:false,errors,warnings,rawSheets}}
for(const name of wb.SheetNames){const sheet=wb.Sheets[name];if(!sheet)continue;rawSheets[name]=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true})}
const usable=S.acceptance.atLeastOne.filter(name=>{const raw=rawSheets[name]||[],start=name===S.sheets.ovgp?2:1;return raw.slice(start).some(row=>date(row?.[0]))});
if(!usable.length)errors.push(issue('required-data',null,'У книзі немає заповненого аркуша «ГОЧ» або «ОВгП».'));
const ops=rawSheets[S.sheets.ops];if(ops?.length){const headers=(ops[0]||[]).map(clean);if(headers.length<2)errors.push(issue('ops-structure',S.sheets.ops,'Аркуш «ГОЧ» не містить очікуваних колонок дати та угруповання.'));const records=ops.slice(1).filter(row=>date(row?.[0]));if(records.length&&!records.some(row=>clean(row?.[1])===S.rows.opsSummary))errors.push(issue('ops-summary',S.sheets.ops,`Не знайдено підсумковий рядок «${S.rows.opsSummary}».`));const expected=[...fieldList(F.ops),...droneTypes.map(t=>t.field)];const missing=expected.filter(field=>!headers.includes(field));if(missing.length)warnings.push(issue('ops-fields',S.sheets.ops,`Не знайдено поля: ${missing.join(', ')}.`))}
const ovgp=rawSheets[S.sheets.ovgp];if(ovgp?.length){const headers=(ovgp[0]||[]).map(clean),records=ovgp.slice(2).filter(row=>date(row?.[0]));if(records.length&&headers.length<6)errors.push(issue('ovgp-structure',S.sheets.ovgp,'Аркуш «ОВгП» не відповідає очікуваній парній структурі колонок.'));if(records.length&&!headers.includes(S.rows.ovgpTotal))errors.push(issue('ovgp-total',S.sheets.ovgp,`Не знайдено підсумкові колонки «${S.rows.ovgpTotal}».`))}
for(const [sheetName,fields] of [[S.sheets.compare,fieldList(F.compare)],[S.sheets.personnel,fieldList(F.personnel)]]){const raw=rawSheets[sheetName];if(!raw?.length)continue;const headers=(raw[0]||[]).map(clean),missing=fields.filter(field=>!headers.includes(field));if(missing.length)warnings.push(issue('optional-fields',sheetName,`Не знайдено поля: ${missing.join(', ')}.`))}
return {valid:errors.length===0,errors,warnings,rawSheets};
}

const cacheableModels=new WeakSet(),runtimeCaches=new WeakMap();
function runtimeFor(data){let runtime=runtimeCaches.get(data);if(!runtime){runtime={sheets:new Map(),aggregates:new Map(),stats:{indexBuilds:0,aggregateHits:0,aggregateMisses:0}};runtimeCaches.set(data,runtime)}return runtime}
function markCacheable(data){cacheableModels.add(data);runtimeFor(data);return data}
function nestedPush(map,key,subkey,row){let nested=map.get(key);if(!nested){nested=new Map();map.set(key,nested)}let rows=nested.get(subkey);if(!rows){rows=[];nested.set(subkey,rows)}rows.push(row)}
function sheetIndex(data,sheetName){const runtime=runtimeFor(data);if(runtime.sheets.has(sheetName))return runtime.sheets.get(sheetName);const byDate=new Map(),byDateGroup=new Map(),byDateType=new Map(),records=data.sheets[sheetName]?.records||[];for(const row of records){let rows=byDate.get(row.date);if(!rows){rows=[];byDate.set(row.date,rows)}rows.push(row);if(row.group)nestedPush(byDateGroup,row.date,row.group,row);if(row.type)nestedPush(byDateType,row.date,row.type,row)}const index={byDate,byDateGroup,byDateType};runtime.sheets.set(sheetName,index);runtime.stats.indexBuilds++;return index}
function rawRowsForDay(index,cat,day){if(cat.type)return index.byDateType.get(day)?.get(cat.type)||[];return index.byDate.get(day)||[]}
function selectedRowsForDay(index,section,cat,day,group){if(section.id==='ops')return index.byDateGroup.get(day)?.get(group||S.rows.opsSummary)||[];return rawRowsForDay(index,cat,day)}
function aggregateKey(section,cat,from,to,group){return [section.id,section.sheet,cat.id||'',cat.type||'',cat.fields.join('\u001f'),from,to,group||''].join('\u001e')}
function cachedAggregate(data,key){if(!cacheableModels.has(data))return undefined;const runtime=runtimeFor(data);if(!runtime.aggregates.has(key)){runtime.stats.aggregateMisses++;return undefined}const value=runtime.aggregates.get(key);runtime.aggregates.delete(key);runtime.aggregates.set(key,value);runtime.stats.aggregateHits++;return value}
function storeAggregate(data,key,value){if(!cacheableModels.has(data))return value;const runtime=runtimeFor(data),limit=Math.max(1,Number(PERF?.aggregateCacheEntries)||384);if(runtime.aggregates.has(key))runtime.aggregates.delete(key);while(runtime.aggregates.size>=limit)runtime.aggregates.delete(runtime.aggregates.keys().next().value);runtime.aggregates.set(key,value);return value}
function clearPerformanceCaches(data){const runtime=runtimeCaches.get(data);if(!runtime)return;runtime.sheets.clear();runtime.aggregates.clear();runtime.stats={indexBuilds:0,aggregateHits:0,aggregateMisses:0}}
function performanceStats(data){const runtime=runtimeCaches.get(data);if(!runtime)return {cacheable:false,indexedSheets:0,aggregateEntries:0,indexBuilds:0,aggregateHits:0,aggregateMisses:0};return {cacheable:cacheableModels.has(data),indexedSheets:runtime.sheets.size,aggregateEntries:runtime.aggregates.size,...runtime.stats}}

function parse(wb,XLSX){const inspection=validateWorkbook(wb,XLSX);if(!inspection.valid){const error=new Error(inspection.errors.map(x=>x.message).join(' '));error.name='WorkbookValidationError';error.validation={errors:inspection.errors,warnings:inspection.warnings};throw error}const sheets={},quality=[];
for(const name of wb.SheetNames){const raw=inspection.rawSheets[name]||[];if(!raw.length)continue;const headers=raw[0].map(clean),records=[];let errors=Object.values(wb.Sheets[name]).filter(c=>c&&(c.t==='e'||(typeof c.v==='string'&&/^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/.test(c.v)))).length,blankRows=0;
for(let i=name===S.sheets.ovgp?2:1;i<raw.length;i++){const row=raw[i],d=date(row[0]);if(!d){blankRows++;continue}
if(name===S.sheets.ovgp){if(!row[1]||!row[2])continue;const groups={};for(let c=4;c<headers.length;c+=2){if(!headers[c]||/вартість|артість/i.test(headers[c]))continue;groups[headers[c]]=[number(row[c]),number(row[c+1])]}records.push({date:d,name:clean(row[1]),type:clean(row[2]),kind:clean(row[3]),groups,row:i+1})}
else{if(name===S.sheets.ops&&!row[1]){blankRows++;continue}const item={date:d,row:i+1};headers.forEach((h,c)=>{if(h)item[h]=row[c]});item.group=clean(row[1]);records.push(item)}}
const dates=[...new Set(records.map(r=>r.date))].sort();const keys=new Set();let duplicates=0;for(const r of records){const k=[r.date,r.name||r.group,r.type||''].join('|');if(keys.has(k))duplicates++;keys.add(k)}
sheets[name]={records,dates,headers};quality.push({name,rows:records.length,from:dates[0],to:dates.at(-1),errors,blankRows,duplicates})}
return markCacheable({sheets,quality,validation:{errors:[],warnings:inspection.warnings}})}
function sections(data){const ov=data.sheets[S.sheets.ovgp];return [
{id:'ops',name:'Оперативна обстановка',short:'Обстановка',icon:'grid',sheet:S.sheets.ops,categories:operational},
{id:'ovgp',name:'ОВгП',short:'ОВгП',icon:'layers',sheet:S.sheets.ovgp,categories:ov?[...new Set(ov.records.map(r=>r.type))].map((t,i)=>({...metric('ov'+i,t[0].toUpperCase()+t.slice(1),['ВЗ','БП'],['Вогневі завдання','Боєприпаси'],[colors.green,colors.gold]),type:t})):[]},
{id:'compare',name:'БК та FPV',short:'БК та FPV',icon:'activity',sheet:S.sheets.compare,categories:comparative},
{id:'personnel',name:'Облік персоналу',short:'Персонал',icon:'database',sheet:S.sheets.personnel,categories:personnel}].filter(s=>data.sheets[s.sheet]?.records.length)}
function values(r,cat,section,group){if(section.id==='ovgp')return r.groups[group||S.rows.ovgpTotal]||[null,null];return cat.fields.map(f=>f===F.ops.dronesOther?sum(droneTypes.filter(t=>t.id!=='fpv').map(t=>number(r[t.field]))):number(r[f]))}
function aggregate(data,section,cat,from,to,group){const key=aggregateKey(section,cat,from,to,group),cached=cachedAggregate(data,key);if(cached!==undefined)return cached;const days=[];for(let d=from;d<=to&&days.length<P.maxAggregateDays;d=shift(d,1))days.push(d);const index=sheetIndex(data,section.sheet),rawByDay=days.map(day=>rawRowsForDay(index,cat,day)),selectedByDay=days.map(day=>selectedRowsForDay(index,section,cat,day,group)),raw=rawByDay.flat(),rows=selectedByDay.flat();const series=cat.fields.map((_,i)=>selectedByDay.map(dayRows=>sum(dayRows.map(r=>values(r,cat,section,group)[i]))));const present=days.filter((_,i)=>series.some(s=>s[i]!==null)).length;const totals=cat.fields.map((_,i)=>sum(rows.map(r=>values(r,cat,section,group)[i])));const requestedDays=inclusiveDays(from,to),result={rows,raw,days,series,totals,present,complete:present===days.length,truncated:requestedDays!==null&&requestedDays>days.length};return storeAggregate(data,key,result)}
function contextRange(dates,from,to){
if(from!==to||!dates.length)return {from,to};
const first=dates[0],last=dates.at(-1);let start=shift(from,-P.contextBeforeDays),end=shift(from,P.contextAfterDays);
if(end>last&&from<=last){end=last;start=shift(end,-P.contextWindowDays+1)}
if(start<first&&from>=first){start=first;end=shift(start,P.contextWindowDays-1);if(end>last)end=last}
return {from:start,to:end};
}
function change(value,previous,complete=true){if(!complete||value===null||previous===null)return {delta:null,percent:null};return {delta:value-previous,percent:previous===0?(value===0?0:null):(value-previous)/Math.abs(previous)*100}}
function axisRange(values,includeZero=false){const finite=values.filter(v=>typeof v==='number'&&Number.isFinite(v));if(!finite.length)return {min:0,max:1};let lo=Math.min(...finite),hi=Math.max(...finite);if(includeZero){lo=Math.min(0,lo);hi=Math.max(0,hi)}const pad=(hi-lo)*.12||Math.max(Math.abs(hi)*.05,1);return {min:lo>=0?Math.max(0,lo-pad):lo-pad,max:hi+pad}}
function integerAxis(values,includeZero=false){const range=axisRange(values,includeZero),rough=Math.max(1,(range.max-range.min)/4),power=10**Math.floor(Math.log10(rough)),step=[1,2,5,10].find(n=>n*power>=rough)*power,min=Math.floor(range.min/step)*step,max=Math.ceil(range.max/step)*step;return {min,max:max>min?max:min+step,tickAmount:Math.max(1,Math.round((max-min)/step))}}
root.ContourData={config:C,colors,operational,comparative,droneTypes,clean,number,sum,date,shift,inclusiveDays,validateDateRange,validateWorkbook,parse,sections,values,aggregate,clearPerformanceCaches,performanceStats,contextRange,change,axisRange,integerAxis};if(typeof module!=='undefined')module.exports=root.ContourData;
})(typeof window!=='undefined'?window:globalThis);
