const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../../js/contour-config.js');
const D=require('../../js/contour-data.js'),XLSX=require('../../js/xlsx.full.min.js');

test('calendar dates reject impossible components and preserve valid formats',()=>{
 for(const value of ['2026-02-31','2026-99-99','2025-02-29','31.04.2026','2026-01-01junk',new Date(NaN),Infinity,1e20])assert.equal(D.date(value),null,String(value));
 for(const value of ['2024-02-29','29.02.2024','29/02/2024'])assert.equal(D.date(value),'2024-02-29');
 assert.equal(D.date(new Date(2024,1,29)),'2024-02-29');
 assert.equal(D.validateDateRange('2026-02-31','2026-03-04').valid,false);
});
test('invalid source dates fail validation before a dataset is accepted',()=>{
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Дата','Угруповання','Обстріли'],['2026-02-31','ВСЬОГО за СО:',1]]),'ГОЧ');
 assert.throws(()=>D.parse(book,XLSX),error=>error.name==='WorkbookValidationError'&&error.validation.errors.some(x=>x.code==='invalid-date'&&x.row===2&&x.sheet==='ГОЧ'));
});
test('changed boundary takes precedence in both directions',()=>{
 assert.deepEqual(D.alignDateRange('2026-09-10','2026-09-07','from'),{from:'2026-09-10',to:'2026-09-10'});
 assert.deepEqual(D.alignDateRange('2026-09-10','2026-09-07','to'),{from:'2026-09-07',to:'2026-09-07'});
 assert.deepEqual(D.alignDateRange('2026-09-01','2026-09-07','from'),{from:'2026-09-01',to:'2026-09-07'});
});
