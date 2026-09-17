(function(){
'use strict';

const dialog=document.querySelector('#compare-dialog');
const from=document.querySelector('#compare-from');
const to=document.querySelector('#compare-to');
const presets=dialog?.querySelector('.compare-presets');
const rangeNote=document.querySelector('#compare-range-note');
const workspace=dialog?.querySelector('.compare-workspace');
const toolbar=workspace?.querySelector('.compare-toolbar');
const pickers=dialog?.querySelector('.compare-mobile-pickers');
if(!dialog||!from||!to||!presets)return;

const quickField=presets.closest('.compare-field');
quickField?.classList.add('compare-quick-period-field');

const field=document.createElement('div');
field.className='compare-field compare-mobile-range-field';
field.innerHTML='<div class="compare-mobile-range-control"><div class="compare-mobile-range-track" aria-hidden="true"><span class="compare-mobile-range-selection"></span></div><input type="range" data-range-start min="0" max="0" value="0" step="1" aria-label="Початкова дата періоду"><input type="range" data-range-end min="0" max="0" value="0" step="1" aria-label="Кінцева дата періоду"></div>';
quickField?.after(field);

let settings=null,settingsToggle=null,settingsBody=null;
if(workspace&&toolbar&&pickers){
 settings=document.createElement('section');
 settings.className='compare-mobile-settings is-open';
 settingsToggle=document.createElement('button');
 settingsToggle.type='button';
 settingsToggle.className='compare-mobile-settings-toggle';
 settingsToggle.setAttribute('aria-expanded','true');
 settingsToggle.innerHTML='<span>Налаштування</span><span class="compare-mobile-settings-chevron" aria-hidden="true">⌄</span>';
 settingsBody=document.createElement('div');
 settingsBody.className='compare-mobile-settings-body';
 toolbar.before(settings);
 settings.append(settingsToggle,settingsBody);
 settingsBody.append(pickers,toolbar);
}

const mobileSettings=()=>matchMedia('(max-width:950px)').matches;
function syncSettingsHeight(){
 if(!settingsBody)return;
 settingsBody.style.setProperty('--compare-settings-height',settingsBody.scrollHeight+'px');
}
function setSettingsOpen(open){
 if(!settings||!settingsToggle||!settingsBody)return;
 syncSettingsHeight();
 settings.classList.toggle('is-open',open);
 settingsToggle.setAttribute('aria-expanded',String(open));
 settingsBody.inert=mobileSettings()&&!open;
}
if(settingsToggle){
 settingsToggle.addEventListener('click',()=>setSettingsOpen(!settings.classList.contains('is-open')));
 let previousScroll=workspace.scrollTop;
 workspace.addEventListener('scroll',()=>{
  const current=workspace.scrollTop;
  if(mobileSettings()&&settings.classList.contains('is-open')&&current>8&&Math.abs(current-previousScroll)>1)setSettingsOpen(false);
  previousScroll=current;
 },{passive:true});
 addEventListener('resize',()=>{
  if(!settingsBody)return;
  syncSettingsHeight();
  settingsBody.inert=mobileSettings()&&!settings.classList.contains('is-open');
 });
 new ResizeObserver(()=>syncSettingsHeight()).observe(settingsBody);
}

const start=field.querySelector('[data-range-start]');
const end=field.querySelector('[data-range-end]');
const control=field.querySelector('.compare-mobile-range-control');
const DAY=86400000;
const formatter=new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
const stamp=value=>Date.parse(value+'T12:00:00Z');
const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(stamp(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const dateAt=(min,index)=>new Date(stamp(min)+index*DAY).toISOString().slice(0,10);
const indexOf=(min,value)=>Math.round((stamp(value)-stamp(min))/DAY);
const label=value=>valid(value)?formatter.format(new Date(value+'T12:00:00Z')):'—';

function rangeState(){
 const mins=[from.min,to.min].filter(valid).sort();
 const maxes=[from.max,to.max].filter(valid).sort();
 const min=mins[0],max=maxes.at(-1);
 if(!min||!max||stamp(min)>stamp(max))return null;
 const total=Math.max(0,indexOf(min,max));
 return {min,max,total};
}

function paint(state){
 const left=clamp(Number(start.value)||0,0,state.total),right=clamp(Number(end.value)||0,left,state.total);
 const denominator=Math.max(1,state.total);
 control.style.setProperty('--range-left',(left/denominator*100)+'%');
 control.style.setProperty('--range-right',(right/denominator*100)+'%');
 const fromValue=dateAt(state.min,left),toValue=dateAt(state.min,right);
 start.setAttribute('aria-valuetext',label(fromValue));
 end.setAttribute('aria-valuetext',label(toValue));
}

function syncFromDates(){
 const state=rangeState();
 if(!state||!valid(from.value)||!valid(to.value)){field.classList.add('is-unavailable');return}
 field.classList.remove('is-unavailable');
 start.min=end.min='0';start.max=end.max=String(state.total);
 start.value=String(clamp(indexOf(state.min,from.value),0,state.total));
 end.value=String(clamp(indexOf(state.min,to.value),Number(start.value),state.total));
 paint(state);
 syncSettingsHeight();
}

function preview(boundary){
 const state=rangeState();if(!state)return;
 let left=Number(start.value)||0,right=Number(end.value)||0;
 if(boundary==='from'&&left>right){left=right;start.value=String(left)}
 if(boundary==='to'&&right<left){right=left;end.value=String(right)}
 const input=boundary==='from'?from:to;
 input.value=dateAt(state.min,boundary==='from'?left:right);
 paint(state);
}

function commit(boundary){
 preview(boundary);
 const input=boundary==='from'?from:to;
 input.dispatchEvent(new Event('change',{bubbles:true}));
 requestAnimationFrame(syncFromDates);
}

const syncSoon=()=>requestAnimationFrame(syncFromDates);
start.addEventListener('input',()=>preview('from'));
end.addEventListener('input',()=>preview('to'));
start.addEventListener('change',()=>commit('from'));
end.addEventListener('change',()=>commit('to'));
from.addEventListener('change',syncSoon);
to.addEventListener('change',syncSoon);
new MutationObserver(()=>{if(dialog.open){syncSoon();requestAnimationFrame(syncSettingsHeight)}}).observe(dialog,{attributes:true,attributeFilter:['open']});
const boundsObserver=new MutationObserver(syncSoon);
boundsObserver.observe(from,{attributes:true,attributeFilter:['min','max']});
boundsObserver.observe(to,{attributes:true,attributeFilter:['min','max']});
if(rangeNote)new MutationObserver(syncSoon).observe(rangeNote,{childList:true,subtree:true,characterData:true});
addEventListener('resize',()=>{if(dialog.open)syncSoon()});

if(settingsBody){syncSettingsHeight();settingsBody.inert=mobileSettings()&&!settings.classList.contains('is-open')}
syncFromDates();
})();