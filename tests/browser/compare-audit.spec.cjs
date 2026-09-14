const {test,expect}=require('@playwright/test');
const path=require('node:path'),XLSX=require('../../js/xlsx.full.min.js');

async function open(page,width=1366,height=768){
 await page.setViewportSize({width,height});await page.goto('/');
 await expect(page.locator('#source-label')).toContainText('підключена',{timeout:15000});
 await page.locator(width<=950?'#mobile-compare':'#compare-open').click();
 await expect(page.locator('#compare-chart .apexcharts-svg')).toBeVisible();
}
for(const [width,height] of [[1366,768],[1440,1000],[820,1180],[390,844]])test(`comparison content is reachable without clipping at ${width}x${height}`,async({page})=>{
 await open(page,width,height);
 const chart=page.locator('#compare-chart'),note=page.locator('#compare-data-note'),workspace=page.locator('.compare-workspace');
 const clipped=await chart.evaluate(host=>{
  const svg=host.querySelector('.apexcharts-svg').getBoundingClientRect(),failures=[];
  for(let node=host.parentElement;node&&!node.classList.contains('compare-workspace');node=node.parentElement){const style=getComputedStyle(node),box=node.getBoundingClientRect();if(['hidden','clip'].includes(style.overflowY)&&svg.bottom>box.bottom+1)failures.push(node.className)}
  return failures;
 });
 expect(clipped).toEqual([]);
 await note.scrollIntoViewIfNeeded();
 const [text,area]=await Promise.all([note.boundingBox(),workspace.boundingBox()]);
 expect(text.y).toBeGreaterThanOrEqual(area.y-1);expect(text.y+text.height).toBeLessThanOrEqual(area.y+area.height+1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);
 await page.locator('#compare-chart-toggle').scrollIntoViewIfNeeded();
 await expect(page.locator('#compare-chart .apexcharts-xaxis')).toBeAttached();
});

test('comparison keeps main expanded rows and uses one accepted parse',async({page})=>{
 await page.goto('/');await expect(page.locator('#table-body .unit-expand').first()).toBeVisible({timeout:15000});
 const toggle=page.locator('#table-body .unit-expand').first();await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.evaluate(()=>{const original=ContourData.parse;window.auditParseCalls=0;ContourData.parse=(...args)=>{auditParseCalls++;return original(...args)}});
 await page.locator('#compare-open').click();await expect(page.locator('#compare-selection .compare-series-chip')).toHaveCount(3);
 await page.locator('[data-compare-close]').click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(await page.evaluate(()=>auditParseCalls)).toBe(0);
 await page.locator('#file-input').setInputFiles(path.resolve(__dirname,'../../Накопичення.xlsx'));
 await expect(page.locator('#source-label')).toContainText('Книгу підключено');expect(await page.evaluate(()=>auditParseCalls)).toBe(1);
 await page.locator('#compare-open').click();await expect(page.locator('#compare-source-note')).toContainText('імпортована');
 expect(await page.evaluate(()=>auditParseCalls)).toBe(1);
});

test('crossed dates align to edited boundary and table remains absolute',async({page})=>{
 await open(page);await page.locator('#compare-from').fill('2026-09-10');await page.locator('#compare-from').press('Tab');
 await expect(page.locator('#compare-to')).toHaveValue('2026-09-10');
 await page.locator('#compare-to').fill('2026-09-07');await page.locator('#compare-to').press('Tab');
 await expect(page.locator('#compare-from')).toHaveValue('2026-09-07');
 const original=await page.locator('#compare-table-body').textContent();await page.locator('[data-compare-mode="absolute"]').click();
 expect(await page.locator('#compare-table-body').textContent()).toBe(original);
 await page.locator('[data-compare-close]').click();await page.locator('#period-open').click();await page.locator('[data-period-mode="range"]').click();await page.locator('#period-start').fill('2026-09-10');await page.locator('#period-start').press('Tab');await page.locator('#period-apply').click();
 await expect(page.locator('#to')).toHaveValue('2026-09-10');
});

test('keyboard filters, derived parent and bulk selection remain accessible',async({page})=>{
 await open(page,390,844);const metrics=page.locator('#compare-mobile-metrics-toggle'),units=page.locator('#compare-mobile-units-toggle');
 await page.locator('[data-compare-close]').focus();await page.keyboard.press('Tab');await expect(metrics).toBeFocused();await page.keyboard.press('Enter');
 await expect(metrics).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(metrics).toBeFocused();await expect(metrics).toHaveAttribute('aria-expanded','false');
 await page.keyboard.press('Tab');await expect(units).toBeFocused();await page.keyboard.press('Space');await expect(units).toHaveAttribute('aria-expanded','true');
 const contrast=await page.locator('.compare-unit-note').evaluate(el=>{
  const luminance=rgb=>{const values=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722};
  const a=luminance(getComputedStyle(el).color),b=luminance(getComputedStyle(el.closest('.compare-sidebar')).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });expect(contrast).toBeGreaterThanOrEqual(4.5);
 await page.evaluate(()=>{const original=ApexCharts.prototype.render;window.auditRenders=0;ApexCharts.prototype.render=function(...args){auditRenders++;return original.apply(this,args)}});
 await page.locator('#compare-units-select-all').click();expect(await page.evaluate(()=>auditRenders)).toBe(1);
 const name=await page.locator('[data-derived-selected="true"]').first().getAttribute('data-compare-unit');
 const parent=page.locator(`[data-compare-unit=${JSON.stringify(name)}]`);await expect(parent).toBeChecked();await parent.uncheck();await expect(parent).not.toBeChecked();
 await page.locator('#compare-units-all').click();await expect(page.locator('#compare-unit-count')).toHaveText('0');
});

test('series retain colors after removal and show their own normalization base',async({page})=>{
 await open(page);const chips=page.locator('.compare-series-chip');await expect(chips).toHaveCount(3);
 const colors=await chips.evaluateAll(nodes=>nodes.map(node=>({id:node.querySelector('button').dataset.removeSeries,color:node.style.getPropertyValue('--series-color')})));
 await expect(chips.first().locator('small')).toContainText('База');
 await chips.first().locator('button').click();
 expect(await chips.evaluateAll(nodes=>nodes.map(node=>({id:node.querySelector('button').dataset.removeSeries,color:node.style.getPropertyValue('--series-color')})))).toEqual(colors.slice(1));
});

test('an invalid import keeps the accepted source and its totals',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-metric="shells"] strong')).toContainText('2 826',{timeout:15000});
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Дата','Угруповання','Обстріли'],['2026-02-31','ВСЬОГО за СО:',1]]),'ГОЧ');
 await page.locator('#file-input').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))});
 await expect(page.locator('#toast')).toContainText('рядок 2');await expect(page.locator('#source-label')).toContainText('Тестова книга');
 await expect(page.locator('[data-metric="shells"] strong')).toContainText('2 826');
});
