const {test}=require('node:test'),assert=require('node:assert/strict');
const {scopeFor}=require('../../scripts/quality-scope.cjs');
const specs=['core','sticky','bps','charts','units','compare-actions','compare-tablet','compare-audit'].map(name=>'tests/browser/'+name+'.spec.cjs');
test('comparison edits include all comparison specs and chart dependencies',()=>{
 for(const file of ['js/contour-compare.js','css/contour-compare.css','js/contour-source.js','tests/browser/compare-tablet.spec.cjs']){
  const scope=scopeFor([file],'',specs);
  for(const name of specs.filter(name=>name.includes('/compare-')))assert.ok(scope.browserFiles.includes(name),file+': '+name);
 }
 assert.ok(scopeFor(['js/contour-compare.js'],'',specs).browserCharts);
});
test('infrastructure runs every spec; a new spec runs itself; docs run no runtime checks',()=>{
 assert.deepEqual(scopeFor(['package-lock.json'],'',specs).browserFiles,[...specs].sort());
 const extra='tests/browser/new-feature.spec.cjs';assert.ok(scopeFor([extra],'',[...specs,extra]).browserFiles.includes(extra));
 const docs=scopeFor(['docs/TODO.md'],'',specs);assert.equal(docs.syntax,false);assert.equal(docs.regression,false);assert.deepEqual(docs.browserFiles,[]);
 assert.equal(scopeFor(['index.html'],'',specs).inlineSyntax,true);
 assert.equal(scopeFor(['scripts/verify-contour.cjs'],'',specs).regression,true);
});
