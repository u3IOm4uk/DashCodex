(function(root){
'use strict';

const isCompact=()=>document.body.classList.contains('cards-away');

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

const metrics=document.querySelector('#metrics');
if(metrics){
 new MutationObserver(syncCategoryStepper).observe(metrics,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 syncCategoryStepper();
}

function scrollCategory(){
 const options={top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'};
 if(!isCompact())return root.scrollTo(options);
 const dock=document.querySelector('#workspace-dock');
 const content=document.querySelector('#notice:not([hidden])')||document.querySelector('.analysis-heading');
 if(!dock||!content)return root.scrollTo(options);
 const gap=12;
 const top=Math.max(0,root.scrollY+content.getBoundingClientRect().top-dock.getBoundingClientRect().bottom-gap);
 return root.scrollTo({...options,top});
}
root.ContourNavigation={scrollCategory};
})(window);
