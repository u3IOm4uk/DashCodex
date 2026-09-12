const {test,expect}=require('@playwright/test');
const {periodRange}=require('../../js/contour-charts.js');

test('chart calendar windows clamp to source boundaries and retain calendar gaps',()=>{
 const dates=['2026-01-01','2026-02-28'];
 expect(periodRange(dates,{from:'2026-02-22',to:'2026-02-28'},30,1)).toEqual({from:'2026-01-30',to:'2026-02-28'});
 expect(periodRange(dates,{from:'2026-01-01',to:'2026-01-07'},30,0)).toEqual({from:'2026-01-01',to:'2026-01-30'});
 expect(periodRange(dates,{from:'2026-01-01',to:'2026-02-28'},10000)).toEqual({from:'2026-01-01',to:'2026-02-28'});
 expect(periodRange(['2026-01-01'],{from:'2026-01-01',to:'2026-01-01'},30)).toEqual({from:'2026-01-01',to:'2026-01-01'});
});

test('chart modes and territory balance work',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await page.locator('[data-chart="bar"]').click();
 await expect(page.locator('[data-chart="bar"]')).toHaveAttribute('aria-pressed','true');
 const territory=page.locator('#metrics [data-metric="territory"]');
 if(await territory.count()){
   await territory.click();
   await expect(page.locator('#graph-tabs')).toBeVisible();
   await page.locator('[data-graph="balance"]').click();
   await expect(page.locator('[data-graph="balance"]')).toHaveAttribute('aria-pressed','true');
 }
});

test('mini chart hover reports its date and value including missing and zero data',async({page})=>{
 await page.goto('/');
 const mini=page.locator('#metrics .mini-hover').first();await expect(mini).toBeVisible();
 await mini.hover();
 const expected=await mini.evaluate(el=>{const p=JSON.parse(el.dataset.miniPoints),i=Math.round((p.days.length-1)/2);return [ContourView.fullDate(p.days[i]),ContourView.fmt(p.values[i])];});
 for(const text of expected)await expect(page.locator('#mini-tooltip')).toContainText(text);
 // The UI must preserve zero/null rather than fabricating a value for missing days.
 await page.evaluate(()=>document.querySelector('#metrics .mini-hover').outerHTML='<span class="mini-hover" style="height:32px" data-mini-points=\'{"days":["2026-09-01","2026-09-02"],"values":[0,null],"label":"Перевірка","color":"#ff0000","mode":"area"}\'></span>');
 await mini.hover({position:{x:1,y:10}});await expect(page.locator('#mini-tooltip')).toContainText('01.09.2026');await expect(page.locator('#mini-tooltip strong')).toHaveText('0');
 const box=await mini.boundingBox();await mini.hover({position:{x:box.width-1,y:10}});await expect(page.locator('#mini-tooltip strong')).toHaveText('—');
 await page.keyboard.press('Escape');await expect(page.locator('#mini-tooltip')).toBeHidden();
});

test('wheel and presets resize only the chart, retain modes, and reset with filters',async({page})=>{
 await page.goto('/');const host=page.locator('#trend-chart');await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 const accounting=()=>page.evaluate(()=>({from:document.querySelector('#from').value,to:document.querySelector('#to').value,cards:document.querySelector('#metrics').textContent,table:document.querySelector('#table-body').textContent,foot:document.querySelector('#chart-foot').textContent}));
 const before=await accounting();await host.hover();await page.mouse.wheel(0,150);
 await expect(host).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await accounting()).toEqual(before);
 const controls=page.locator('.trend-panel .chart-period-controls');await controls.locator('[data-plot-days="30"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');await expect(host).toHaveAttribute('data-plot-to','2026-09-07');
 await page.locator('[data-chart="bar"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');
 await controls.locator('[data-plot-days="reset"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 await controls.locator('[data-plot-days="30"]').click();await controls.locator('[data-plot-days="7"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 await host.hover();await page.mouse.wheel(0,-150);await expect(host).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await accounting()).toEqual(before);
 await page.locator('[data-days="1"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');
 await controls.locator('[data-plot-days="7"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');await expect(page.locator('#from')).toHaveValue('2026-09-07');
 await page.locator('#table-body .row-button').first().click();const detail=page.locator('#detail-trend-chart');await expect(detail).toBeVisible();
 const table=await page.locator('#detail-content table').textContent();await page.locator('#detail-dialog [data-plot-days="7"]').click();await expect(detail).toHaveAttribute('data-plot-from','2026-09-01');await detail.hover();await page.mouse.wheel(0,120);await expect(detail).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await page.locator('#detail-content table').textContent()).toEqual(table);
});

test('cross-category comparison builds a shared analytical view',async({page})=>{
 await page.goto('/');await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await page.locator('#compare-open').click();await expect(page.locator('#compare-dialog')).toBeVisible();
 await expect(page.locator('#compare-catalog [data-compare-metric]').first()).toBeVisible({timeout:15000});
 await expect(page.locator('#compare-chart .apexcharts-canvas')).toBeVisible({timeout:15000});
 const checked=page.locator('#compare-catalog [data-compare-metric]:checked');expect(await checked.count()).toBeGreaterThanOrEqual(2);
 await expect(page.locator('#compare-data-note')).toContainText('не прирівнюються до нуля');
 await page.locator('[data-compare-mode="absolute"]').click();await expect(page.locator('[data-compare-mode="absolute"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-compare-chart="bar"]').click();await expect(page.locator('[data-compare-chart="bar"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#compare-table-body tr').first()).toBeVisible();
 const dashboardFrom=await page.locator('#from').inputValue(),dashboardTo=await page.locator('#to').inputValue();await page.locator('#compare-dashboard-period').click();await expect(page.locator('#compare-from')).toHaveValue(dashboardFrom);await expect(page.locator('#compare-to')).toHaveValue(dashboardTo);
});
