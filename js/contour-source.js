(function(root){
'use strict';

/** One accepted dataset; a newer import intent invalidates older asynchronous reads. */
function createSource(parseBuffer){
 let current=null,pending=null,generation=0;
 async function load(readBuffer,name,kind){
  const own=++generation;
  const request=(async()=>{
   let buffer;
   try{buffer=await readBuffer()}catch(error){if(own!==generation)return null;throw error}
   if(own!==generation)return null;
   const data=parseBuffer(buffer);
   current=Object.freeze({data,source:Object.freeze({name,kind})});
   return current;
  })();
  pending=request;
  try{return await request}finally{if(pending===request)pending=null}
 }
 return {load,get current(){return current},ready:()=>pending||Promise.resolve(current)};
}

const api=createSource(buffer=>root.ContourData.parse(root.XLSX.read(buffer,{type:'array',cellDates:true,cellText:false}),root.XLSX));
api.createSource=createSource;
root.ContourSource=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
