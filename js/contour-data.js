(function(root){
'use strict';
const colors={blue:'#008FFB',red:'#FF4560',gold:'#c2bd51',green:'#10B981',violet:'#aa91de',cyan:'#5dc9d8'};
const metric=(id,name,fields,labels,ink,unit='од.')=>({id,name,fields,labels,colors:ink,unit});
const operational=[
metric('shells','Обстріли',['Обстріли'],['Обстріли'],[colors.red]),
metric('rockets','Ракетні удари',['Ракетні удари','Застосовано ракет'],['Удари','Застосовано ракет'],[colors.red,colors.gold]),
metric('air','АУ / КАБ / КАР',['АУ','КАБ','КАР'],['Авіаудари','КАБ','КАР'],[colors.red,colors.gold,colors.violet]),
metric('assault','Штурмові дії',['Бойові зіткнення','Штурмові дії'],['СОУ','Противник'],[colors.blue,colors.red]),
metric('ongoing','Тривають зіткнення',['Тривають (бз)','Тривають (шд)'],['СОУ','Противник'],[colors.blue,colors.red]),
metric('positions','Позиції',['Всього втрачено позицій','Відновлено позицій'],['Втрачено','Відновлено'],[colors.red,colors.green]),
metric('territory','Території',['відновлено_територій','втрачено_територій'],['Відновлено','Втрачено'],[colors.blue,colors.red],'од. джерела'),
metric('losses','Втрати особового складу',['Втрати_всього_ЗСУ','Втрати_всього_рф'],['СОУ','Противник'],[colors.blue,colors.red],'осіб'),
metric('drones','БпС противника',['ВСЬОГО УДАРІВ БпЛА'],['Удари БпЛА'],[colors.red])];
const comparative=[metric('ammo','Застосування БК',['Наші війська_БК','Противник_БК'],['СОУ','Противник'],[colors.blue,colors.red]),metric('fpv','Застосування FPV',['Наші війська_FPV','Противник_FPV'],['СОУ','Противник'],[colors.blue,colors.red])];
const droneTypes=[
{id:'shahed',name:'Шахеди / Гербера / Пародія',field:'Шахеди/Гербера/Пародія',color:'#ff4560'},
{id:'italmas',name:'Італмас',field:'Італмас',color:'#e78e63'},
{id:'lancet',name:'Ланцет',field:'Ланцет',color:'#c2bd51'},
{id:'molniya',name:'Молнія',field:'Молнія',color:'#10b981'},
{id:'banderol',name:'Бандероль',field:'Бандероль',color:'#5dc9d8'},
{id:'privet',name:'Привіт / Куб',field:'Привіт/Куб',color:'#aa91de'},
{id:'fpv',name:'FPV-дрони',field:'FPV-дрони',color:'#e58caf'}];
const personnel=[metric('personnel-total','Загальний облік',['ВСЬОГО_доба'],['Втрати за добу'],[colors.blue],'осіб'),metric('irreversible','Безповоротні',['безповоротні_доба'],['Безповоротні'],[colors.blue],'осіб'),metric('medical','Санітарні',['санітарні_доба'],['Санітарні'],[colors.cyan],'осіб'),metric('missing','Зниклі безвісти',['зниклі_безвісті_доба'],['Зниклі безвісти'],[colors.gold],'осіб'),metric('captured','Полонені',['полон_доба'],['Полонені'],[colors.violet],'осіб')];
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const sum=values=>!values.length||values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0);
function date(v){if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*864e5).toISOString().slice(0,10);if(typeof v==='string'){if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);const m=v.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`}return null}
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
function parse(wb,XLSX){const sheets={},quality=[];
for(const name of wb.SheetNames){const raw=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});if(!raw.length)continue;const headers=raw[0].map(clean),records=[];let errors=Object.values(wb.Sheets[name]).filter(c=>c&&(c.t==='e'||(typeof c.v==='string'&&/^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/.test(c.v)))).length,blankRows=0;
for(let i=name==='ОВгП'?2:1;i<raw.length;i++){const row=raw[i],d=date(row[0]);if(!d){blankRows++;continue}
if(name==='ОВгП'){if(!row[1]||!row[2])continue;const groups={};for(let c=4;c<headers.length;c+=2){if(!headers[c]||/вартість|артість/i.test(headers[c]))continue;groups[headers[c]]=[number(row[c]),number(row[c+1])]}records.push({date:d,name:clean(row[1]),type:clean(row[2]),kind:clean(row[3]),groups,row:i+1})}
else{if(name==='ГОЧ'&&!row[1]){blankRows++;continue}const item={date:d,row:i+1};headers.forEach((h,c)=>{if(h)item[h]=row[c]});item.group=clean(row[1]);records.push(item)}}
const dates=[...new Set(records.map(r=>r.date))].sort();const keys=new Set();let duplicates=0;for(const r of records){const k=[r.date,r.name||r.group,r.type||''].join('|');if(keys.has(k))duplicates++;keys.add(k)}
sheets[name]={records,dates,headers};quality.push({name,rows:records.length,from:dates[0],to:dates.at(-1),errors,blankRows,duplicates})}
if(!sheets['ГОЧ']?.records.length&&!sheets['ОВгП']?.records.length)throw new Error('У книзі немає заповненого аркуша «ГОЧ» або «ОВгП».');return {sheets,quality}}
function sections(data){const ov=data.sheets['ОВгП'];return [
{id:'ops',name:'Оперативна обстановка',short:'Обстановка',icon:'grid',sheet:'ГОЧ',categories:operational},
{id:'ovgp',name:'ОВгП',short:'ОВгП',icon:'layers',sheet:'ОВгП',categories:ov?[...new Set(ov.records.map(r=>r.type))].map((t,i)=>({...metric('ov'+i,t[0].toUpperCase()+t.slice(1),['ВЗ','БП'],['Вогневі завдання','Боєприпаси'],[colors.green,colors.gold]),type:t})):[]},
{id:'compare',name:'БК та FPV',short:'БК та FPV',icon:'activity',sheet:'Застосування БК та FPV',categories:comparative},
{id:'personnel',name:'Облік персоналу',short:'Персонал',icon:'database',sheet:'Втрати ЗСУ',categories:personnel}].filter(s=>data.sheets[s.sheet]?.records.length)}
function values(r,cat,section,group){if(section.id==='ovgp')return r.groups[group||'ВСЬОГО за СО']||[null,null];return cat.fields.map(f=>f==='БпС без FPV'?sum(droneTypes.filter(t=>t.id!=='fpv').map(t=>number(r[t.field]))):number(r[f]))}
function aggregate(data,section,cat,from,to,group){const raw=(data.sheets[section.sheet]?.records||[]).filter(r=>r.date>=from&&r.date<=to&&(!cat.type||r.type===cat.type));const rows=section.id==='ops'?raw.filter(r=>r.group===(group||'ВСЬОГО за СО:')):raw;const days=[];for(let d=from;d<=to;d=shift(d,1)){if(days.length>4000)break;days.push(d)}const series=cat.fields.map((_,i)=>days.map(day=>sum(rows.filter(r=>r.date===day).map(r=>values(r,cat,section,group)[i]))));const present=days.filter((_,i)=>series.some(s=>s[i]!==null)).length;const totals=cat.fields.map((_,i)=>sum(rows.map(r=>values(r,cat,section,group)[i])));return {rows,raw,days,series,totals,present,complete:present===days.length}}
function contextRange(dates,from,to){
if(from!==to||!dates.length)return {from,to};
const first=dates[0],last=dates.at(-1);let start=shift(from,-14),end=shift(from,15);
if(end>last&&from<=last){end=last;start=shift(end,-29)}
if(start<first&&from>=first){start=first;end=shift(start,29);if(end>last)end=last}
return {from:start,to:end};
}
function change(value,previous,complete=true){if(!complete||value===null||previous===null)return {delta:null,percent:null};return {delta:value-previous,percent:previous===0?(value===0?0:null):(value-previous)/Math.abs(previous)*100}}
function axisRange(values,includeZero=false){const finite=values.filter(v=>typeof v==='number'&&Number.isFinite(v));if(!finite.length)return {min:0,max:1};let lo=Math.min(...finite),hi=Math.max(...finite);if(includeZero){lo=Math.min(0,lo);hi=Math.max(0,hi)}const pad=(hi-lo)*.12||Math.max(Math.abs(hi)*.05,1);return {min:lo>=0?Math.max(0,lo-pad):lo-pad,max:hi+pad}}
function integerAxis(values,includeZero=false){const range=axisRange(values,includeZero),rough=Math.max(1,(range.max-range.min)/4),power=10**Math.floor(Math.log10(rough)),step=[1,2,5,10].find(n=>n*power>=rough)*power,min=Math.floor(range.min/step)*step,max=Math.ceil(range.max/step)*step;return {min,max:max>min?max:min+step,tickAmount:Math.max(1,Math.round((max-min)/step))}}
root.ContourData={colors,operational,comparative,droneTypes,clean,number,sum,date,shift,parse,sections,values,aggregate,contextRange,change,axisRange,integerAxis};if(typeof module!=='undefined')module.exports=root.ContourData;
})(typeof window!=='undefined'?window:globalThis);

