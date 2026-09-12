const assert=require('node:assert/strict');
const fs=require('node:fs');
const X=require('../js/xlsx.full.min.js');
const D=require('../js/contour-data.js');
const data=D.parse(X.read(fs.readFileSync('Накопичення.xlsx'),{cellDates:true}),X);
const sections=D.sections(data),ops=sections.find(s=>s.id==='ops'),ov=sections.find(s=>s.id==='ovgp');
assert.equal(sections.length,4);
assert.equal(D.aggregate(data,ops,ops.categories[0],'2026-09-01','2026-09-07').totals[0],2826);
assert.equal(D.aggregate(data,ops,ops.categories[0],'2026-09-07','2026-09-07').totals[0],406);
assert.equal(D.aggregate(data,ops,ops.categories[0],'2020-01-01','2020-01-07').totals[0],null);
assert.equal(D.aggregate(data,ops,ops.categories[0],'2026-09-07','2026-09-08').complete,false);
assert.equal(D.aggregate(data,ops,ops.categories[0],'2026-09-07','2026-09-07','12 АК').totals[0],0);
assert.equal(D.sum([1,null]),null);assert.equal(D.sum([0,0]),0);
assert(data.quality.find(q=>q.name==='ОВгП').errors>0);
for(const s of sections)for(const cat of s.categories){const dates=data.sheets[s.sheet].dates,a=D.aggregate(data,s,cat,D.shift(dates.at(-1),-6),dates.at(-1));for(let i=0;i<cat.fields.length;i++)assert.equal(a.series[i].filter(v=>v!==null).reduce((a,b)=>a+b,0).toFixed(5), (a.totals[i]??0).toFixed(5));}
const ovResult=D.aggregate(data,ov,ov.categories[0],'2026-09-02','2026-09-08');
for(const [id,expected] of [['assault',[150,154]],['ongoing',[140,155]],['territory',[115.1,113.3]]]){
const actual=D.aggregate(data,ops,ops.categories.find(c=>c.id===id),'2026-09-01','2026-09-07').totals;
assert.deepEqual(actual.map(v=>Number(v.toFixed(2))),expected);
}
const allDrones=ops.categories.find(c=>c.id==='drones');
const otherDrones={...allDrones,fields:['БпС без FPV']};
assert.equal(D.aggregate(data,ops,otherDrones,'2026-09-01','2026-09-07').totals[0],4196);
const sample={date:'2026-09-01',group:'ВСЬОГО за СО:','FPV-дрони':90000};
for(const t of D.droneTypes.filter(t=>t.id!=='fpv'))sample[t.field]=100;
const synthetic={sheets:{'ГОЧ':{records:[sample]}}};
assert.equal(D.aggregate(synthetic,ops,otherDrones,'2026-09-01','2026-09-01').totals[0],600);
sample['FPV-дрони']=900000;
assert.equal(D.aggregate(synthetic,ops,otherDrones,'2026-09-01','2026-09-01').totals[0],600);
sample['Ланцет']=null;
assert.equal(D.aggregate(synthetic,ops,otherDrones,'2026-09-01','2026-09-01').totals[0],null);
assert.deepEqual(ops.categories.find(c=>c.id==='positions').labels,['Втрачено','Відновлено']);
const typeTotals=D.droneTypes.map(t=>D.aggregate(data,ops,{...allDrones,fields:[t.field]},'2026-09-01','2026-09-07').totals[0]);
assert.deepEqual(typeTotals,[663,698,740,812,602,681,908]);
assert.equal(D.sum(typeTotals),D.aggregate(data,ops,allDrones,'2026-09-01','2026-09-07').totals[0]);
for(const day of data.sheets['ГОЧ'].dates){const t=D.droneTypes.map(type=>D.aggregate(data,ops,{...allDrones,fields:[type.field]},day,day).totals[0]);assert.equal(D.sum(t),D.aggregate(data,ops,allDrones,day,day).totals[0]);}
console.log(JSON.stringify({status:'PASS',checks:'all categories: daily totals, missing periods, zero values, Excel error detection',quality:data.quality,ovFirst:ovResult.totals},null,2));

// Context window shifts at boundaries and never fabricates extra source dates.
const dates=Array.from({length:90},(_,i)=>D.shift('2026-06-01',i));
assert.deepEqual(D.contextRange(dates,'2026-07-15','2026-07-15'),{from:'2026-07-01',to:'2026-07-30'});
assert.deepEqual(D.contextRange(dates,dates.at(-1),dates.at(-1)),{from:D.shift(dates.at(-1),-29),to:dates.at(-1)});
assert.deepEqual(D.contextRange(dates,dates[0],dates[0]),{from:dates[0],to:D.shift(dates[0],29)});
assert.deepEqual(D.contextRange(data.sheets['ГОЧ'].dates,'2026-09-07','2026-09-07'),{from:'2026-08-20',to:'2026-09-07'});
assert.deepEqual(D.change(120,100),{delta:20,percent:20});
assert.deepEqual(D.change(0,0),{delta:0,percent:0});
assert.deepEqual(D.change(12,0),{delta:12,percent:null});
assert.deepEqual(D.change(12,null),{delta:null,percent:null});
assert.deepEqual(D.change(12,10,false),{delta:null,percent:null});
console.log('PASS: contextual windows, zero baselines and incomplete comparisons');
const tight=D.axisRange([398,402,410]);assert(tight.min>350&&tight.max<450);
const zero=D.axisRange([0,0]);assert(zero.min===0&&zero.max>0);
const flat=D.axisRange([50,50]);assert(flat.min<50&&flat.max>50);
const signedAxis=D.axisRange([-10,20],true);assert(signedAxis.min<-10&&signedAxis.max>20);

for(const values of [[.1,.9],[398,402,410],[-.3,.2],[0,0],[50,50]]){const a=D.integerAxis(values,values.some(v=>v<0)),step=(a.max-a.min)/a.tickAmount;assert(Number.isInteger(a.min));assert(Number.isInteger(a.max));assert(Number.isInteger(step));assert(a.min<=Math.min(...values)&&a.max>=Math.max(...values));}
console.log('PASS: adaptive axes with integer ticks, constant and fractional data');
