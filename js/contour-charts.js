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

root.ContourCharts={modeLabel,baseOptions,temporalOptions,miniBar,periodRange};
if(typeof module!=='undefined')module.exports=root.ContourCharts;
})(typeof window!=='undefined'?window:globalThis);
