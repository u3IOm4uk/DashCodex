(function(root){
'use strict';

const modeLabel=m=>({area:'Лінійний графік',bar:'Стовпчиковий графік'}[m]);

function baseOptions(reducedMotion=false){return {chart:{fontFamily:'Exo,Arial,sans-serif',foreColor:'#8e9a9f',background:'transparent',toolbar:{show:false},animations:{enabled:!reducedMotion,speed:450},parentHeightOffset:0},theme:{mode:'dark'},grid:{borderColor:'#343b3e',strokeDashArray:3,padding:{left:8,right:17}},tooltip:{theme:'dark'},dataLabels:{enabled:false},legend:{fontSize:'11px',position:'top',horizontalAlign:'left',markers:{size:4},itemMargin:{horizontal:9,vertical:4}},stroke:{width:2.2,curve:'straight'},noData:{text:'Немає даних'},states:{hover:{filter:{type:'lighten',value:.12}}}}}

function temporalOptions({dataApi:D,aggregate:a,labels,colors,height=260,balance=false,mode='area',from,to,fmt,shortDate,fullDate,reducedMotion=false}){
 const o=baseOptions(reducedMotion),single=from===to,t=Date.parse(from+'T12:00:00Z');
 const series=balance?[{name:'Відновлено − втрачено',data:a.days.map((d,j)=>({x:Date.parse(d+'T12:00:00Z'),y:a.series.every(s=>s[j]!==null)?a.series[0][j]-a.series[1][j]:null}))}]:labels.map((name,i)=>({name,data:a.days.map((d,j)=>({x:Date.parse(d+'T12:00:00Z'),y:a.series[i][j]}))}));
 const limits=D.integerAxis(series.flatMap(s=>s.data.map(p=>p.y)),balance);
 return {...o,chart:{...o.chart,type:mode,height,zoom:{enabled:false}},series,colors:balance?[D.colors.green]:colors,
 xaxis:{type:'datetime',labels:{datetimeUTC:true,formatter:(v,stamp)=>shortDate(new Date(stamp).toISOString().slice(0,10))},axisBorder:{show:false},axisTicks:{show:false},tooltip:{enabled:false}},
 yaxis:{...limits,forceNiceScale:false,labels:{formatter:v=>fmt(Math.round(v))}},
 fill:mode==='area'?{type:'gradient',gradient:{opacityFrom:.26,opacityTo:.02}}:{type:'solid',opacity:.9},
 plotOptions:{bar:{columnWidth:'48%',borderRadius:2,colors:{ranges:balance?[{from:-1e15,to:-.000001,color:D.colors.red},{from:0,to:1e15,color:D.colors.green}]:[]}}},markers:{size:a.days.length===1?4:0},
 annotations:{yaxis:balance?[{y:0,borderColor:'#9ba8aa',strokeDashArray:0}]:[],xaxis:single?[{x:t-432e5,x2:t+432e5,fillColor:D.colors.gold,opacity:.10,label:{offsetX:from>=a.days.at(-3)?-65:from<=a.days[2]?65:0,text:'Обрана доба · '+shortDate(from),style:{background:'#c2bd51',color:'#111315'},orientation:'horizontal'}},{x:t,borderColor:D.colors.gold,strokeDashArray:4}]:[]},
 tooltip:{theme:'dark',x:{formatter:stamp=>fullDate(new Date(stamp).toISOString().slice(0,10))},y:{formatter:v=>fmt(v)}}};
}

function miniBar({dataApi:D,values,color,days,selectedDay=null,fmt,fullDate}){
 const limits=D.axisRange(values),width=220,height=48,y=v=>height-(v-limits.min)/(limits.max-limits.min)*height+4,zero=y(Math.max(limits.min,0)),step=width/Math.max(values.length,1),selectedIndex=selectedDay?days.indexOf(selectedDay):-1;
 return `<svg viewBox="0 0 220 58" preserveAspectRatio="none" role="img" aria-label="Динаміка стовпчиками"><line x1="0" x2="220" y1="${zero}" y2="${zero}" stroke="#65716c" opacity=".4"/>${values.map((v,i)=>v===null?'':`<rect x="${i*step+step*.15}" y="${Math.min(y(v),zero)}" width="${Math.max(1,step*.7)}" height="${Math.max(1,Math.abs(y(v)-zero))}" rx="1" fill="${color}"><title>${fullDate(days[i])}: ${fmt(v)}</title></rect>`).join('')}${selectedIndex>=0?`<line x1="${(selectedIndex+.5)*step}" x2="${(selectedIndex+.5)*step}" y1="0" y2="58" stroke="#c2bd51" stroke-dasharray="3 3"/>`:''}</svg>`;
}

// Resize the visible calendar window; never modify the accounting period.
function periodRange(dates,range,count,anchor=.5){
 const day=864e5,stamp=d=>Date.parse(d+'T12:00:00Z'),iso=t=>new Date(t).toISOString().slice(0,10);
 const min=stamp(dates[0]),max=stamp(dates.at(-1)),start=stamp(range.from),end=stamp(range.to);
 const length=Math.max(1,Math.min(4001,Math.round(count),Math.round((max-min)/day)+1));
 const pivot=start+(end-start)*Math.max(0,Math.min(1,anchor));
 const left=Math.max(min,Math.min(max-(length-1)*day,Math.round((pivot-min)/day-(length-1)*anchor)*day+min));
 return {from:iso(left),to:iso(left+(length-1)*day)};
}

function distributionDonut(rows,{fmt,esc}){
 const total=rows.reduce((sum,row)=>sum+row.value,0);
 if(!total)return '<p class="focus-note">Немає додатних значень для круглого розподілу.</p>';
 let angle=-Math.PI/2;const radius=70,cx=200;
 const slices=rows.filter(row=>row.value>0).map(row=>{const start=angle,end=angle+row.value/total*Math.PI*2;angle=end;return {...row,start,end,mid:(start+end)/2}});
 const sides=[slices.filter(s=>Math.cos(s.mid)<0),slices.filter(s=>Math.cos(s.mid)>=0)];
 const height=Math.max(280,Math.max(...sides.map(side=>side.length))*56+32),cy=height/2;
 const point=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
 const arcs=slices.map(row=>{const a=point(radius,row.start),b=point(radius,row.end),label=esc(row.name)+' · '+fmt(row.value)+' · '+fmt(row.value/total*100)+'%';return slices.length===1?`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${row.color}"><title>${label}</title></circle>`:`<path d="M${cx},${cy} L${a} A${radius},${radius} 0 ${row.end-row.start>Math.PI?1:0} 1 ${b} Z" fill="${row.color}" stroke="#191e20" stroke-width="2"><title>${label}</title></path>`}).join('');
 const callouts=sides.flatMap((side,right)=>side.sort((a,b)=>Math.sin(a.mid)-Math.sin(b.mid)).map((row,i)=>{
  const y=(height-side.length*56)/2+i*56+24,start=point(radius+3,row.mid),elbow=point(radius+15,row.mid),x=right?392:8,edge=right?300:100;
  const words=row.name.split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>15&&lines.at(-1))lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim()}
  return `<g class="donut-callout"><polyline points="${start} ${elbow} ${edge},${y} ${right?x-4:x+4},${y}" fill="none" stroke="${row.color}" stroke-width="1"/><text x="${x}" y="${y-8}" text-anchor="${right?'end':'start'}" fill="#d4dcde" font-size="12">${lines.map((line,j)=>`<tspan x="${x}" dy="${j?14:0}">${esc(line)}</tspan>`).join('')}<tspan x="${x}" dy="16" fill="${row.color}" font-weight="600">${fmt(row.value/total*100)}%</tspan></text></g>`;
 })).join('');
 return `<svg viewBox="0 0 400 ${height}" role="img" aria-label="Круглий розподіл показника"><g>${arcs}</g><circle cx="${cx}" cy="${cy}" r="43" fill="#191e20"/><text x="${cx}" y="${cy+5}" text-anchor="middle" fill="#b6c1c3" font-size="14">100%</text>${callouts}</svg>`;
}
root.ContourCharts={modeLabel,baseOptions,temporalOptions,miniBar,periodRange,distributionDonut};
if(typeof module!=='undefined')module.exports=root.ContourCharts;
})(typeof window!=='undefined'?window:globalThis);
