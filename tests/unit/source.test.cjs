const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSource}=require('../../js/contour-source.js');
test('new import wins over older reads and only accepted content is parsed',async()=>{
 let finishOld,parses=0;
 const source=createSource(buffer=>{parses++;return {buffer}});
 const old=source.load(()=>new Promise(resolve=>finishOld=resolve),'old','bundled');
 const latest=await source.load(async()=>'new','new','user');
 finishOld('old');
 assert.equal(await old,null);assert.equal(parses,1);assert.equal(source.current,latest);
 assert.equal(await source.ready(),latest);
});
test('failed validation preserves the last accepted model',async()=>{
 const source=createSource(buffer=>{if(buffer==='invalid')throw Error('invalid date');return {buffer}});
 const accepted=await source.load(async()=>'valid','valid','user');
 await assert.rejects(source.load(async()=>'invalid','invalid','user'));
 assert.equal(source.current,accepted);assert.equal(await source.ready(),accepted);
});
