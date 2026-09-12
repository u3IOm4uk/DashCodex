(function(root){
'use strict';

let compactCategoryNavigation=false,resetTimer=0;
const nativeScrollTo=root.scrollTo.bind(root);
const isCompact=()=>document.body.classList.contains('cards-away');
const categoryTrigger=target=>target?.closest?.('[data-metric],[data-category],#previous,#next');

function armCompactNavigation(){
 if(!isCompact())return;
 compactCategoryNavigation=true;
 clearTimeout(resetTimer);
 resetTimer=setTimeout(()=>{compactCategoryNavigation=false},0);
}

document.addEventListener('click',event=>{if(categoryTrigger(event.target))armCompactNavigation()},true);
document.addEventListener('touchend',event=>{if(event.target?.closest?.('.analysis-heading'))armCompactNavigation()},true);

root.scrollTo=function(first,second){
 const options=first&&typeof first==='object'?first:null;
 if(!compactCategoryNavigation||!options||Number(options.top)!==0||!isCompact())return nativeScrollTo(first,second);
 compactCategoryNavigation=false;
 clearTimeout(resetTimer);
 const dock=document.querySelector('#workspace-dock');
 const content=document.querySelector('#notice:not([hidden])')||document.querySelector('.analysis-heading');
 if(!dock||!content)return nativeScrollTo(first,second);
 const gap=12;
 const top=Math.max(0,root.scrollY+content.getBoundingClientRect().top-dock.getBoundingClientRect().bottom-gap);
 return nativeScrollTo({...options,top});
};
})(window);
