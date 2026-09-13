(function(root){
'use strict';

let compactCategoryNavigation=false,resetTimer=0;
const nativeScrollTo=root.scrollTo.bind(root);
const forwardScrollTo=(first,second)=>second===undefined?nativeScrollTo(first):nativeScrollTo(first,second);
const isCompact=()=>document.body.classList.contains('cards-away');
const categoryTrigger=target=>target?.closest?.('[data-metric],[data-category],#previous,#next');

function syncCategoryStepper(){
 const cards=[...document.querySelectorAll('#metrics [data-metric]')];
 const index=cards.findIndex(card=>card.getAttribute('aria-pressed')==='true');
 const previous=document.querySelector('#previous'),next=document.querySelector('#next');
 if(index<0||!cards.length||!previous||!next)return;
 const label=card=>card.querySelector('.metric-top')?.textContent.trim()||'';
 const previousLabel=label(cards[(index-1+cards.length)%cards.length]);
 const nextLabel=label(cards[(index+1)%cards.length]);
 previous.dataset.targetLabel=previousLabel;
 next.dataset.targetLabel=nextLabel;
 previous.setAttribute('aria-label',`Попередня категорія: ${previousLabel}`);
 next.setAttribute('aria-label',`Наступна категорія: ${nextLabel}`);
}

function armCompactNavigation(){
 if(!isCompact())return;
 compactCategoryNavigation=true;
 clearTimeout(resetTimer);
 resetTimer=setTimeout(()=>{compactCategoryNavigation=false},0);
}

document.addEventListener('click',event=>{if(categoryTrigger(event.target))armCompactNavigation()},true);
document.addEventListener('touchend',event=>{if(event.target?.closest?.('.analysis-heading'))armCompactNavigation()},true);

const metrics=document.querySelector('#metrics');
if(metrics){
 new MutationObserver(syncCategoryStepper).observe(metrics,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 syncCategoryStepper();
}

root.scrollTo=function(first,second){
 const options=first&&typeof first==='object'?first:null;
 if(!compactCategoryNavigation||!options||Number(options.top)!==0||!isCompact())return forwardScrollTo(first,second);
 compactCategoryNavigation=false;
 clearTimeout(resetTimer);
 const dock=document.querySelector('#workspace-dock');
 const content=document.querySelector('#notice:not([hidden])')||document.querySelector('.analysis-heading');
 if(!dock||!content)return forwardScrollTo(first,second);
 const gap=12;
 const top=Math.max(0,root.scrollY+content.getBoundingClientRect().top-dock.getBoundingClientRect().bottom-gap);
 return nativeScrollTo({...options,top});
};
})(window);
