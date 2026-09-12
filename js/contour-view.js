(function(root){
'use strict';

const paths={
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  layers:'m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
  activity:'M2 12h4l3-8 6 16 3-8h4',
  upload:'M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6',
  download:'M12 3v13 m-5-5 5 5 5-5 M4 16v5h16v-5',
  calendar:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
  database:'M4 6c0-4 16-4 16 0s-16 4-16 0 M4 6v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0',
  sliders:'M3 6h18 M3 12h18 M3 18h18 M8 3v6 M16 9v6 M10 15v6',
  trend:'M3 17l6-6 4 3 8-10 M15 4h6v6',
  bars:'M4 20V12h3v8 M11 20V4h3v16 M18 20V8h3v12',
  donut:'M12 3v9h9 M9 3.5a9 9 0 1 0 11.5 11.5 M15 3.5a9 9 0 0 1 5.5 5.5'
};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined?'—':new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(v);
const shortDate=d=>d?d.slice(8)+'.'+d.slice(5,7):'—';
const fullDate=d=>d?shortDate(d)+'.'+d.slice(0,4):'—';
const icon=n=>`<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[n]||paths.grid}"/></svg>`;

root.ContourView={esc,fmt,shortDate,fullDate,icon};
if(typeof module!=='undefined')module.exports=root.ContourView;
})(typeof window!=='undefined'?window:globalThis);
