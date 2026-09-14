const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/');await expect(page.locator('#source-label')).toContainText('підключена')}
test('period picker starts with one date and can apply a range',async({page})=>{
 await open(page);await page.locator('#period-open').click();await expect(page.locator('#period-end-field')).toBeHidden();
 await page.locator('#period-start').fill('2026-09-05');await page.locator('#period-start').press('Enter');
 await expect(page.locator('#from')).toHaveValue('2026-09-05');await expect(page.locator('#to')).toHaveValue('2026-09-05');
 await page.locator('#period-open').click();await page.locator('[data-period-mode="range"]').click();
 await page.locator('#period-start').fill('2026-09-01');await page.locator('#period-end').fill('2026-09-07');await page.locator('#period-apply').click();
 await expect(page.locator('#period-open')).toContainText('01.09.2026 — 07.09.2026');
});
test('requested navigation, hidden units and distribution view',async({page})=>{
 await open(page);await expect(page.locator('#rail-prev,#rail-next,#all-categories,.rail-explainer,#distribution-coverage')).toHaveCount(0);
 await expect(page.locator('.rail-heading #inline-sections')).toBeVisible();await expect(page.locator('#previous')).toBeHidden();
 const unknown=page.locator('#table-body tr').filter({hasText:'Курськ'});await expect(unknown).toBeHidden();
 await page.locator('#unit-hidden-toggle').click();await expect(unknown).toBeVisible();await unknown.locator('.row-button').click();await expect(page.locator('#detail-name')).toContainText('Курськ');
 await page.locator('#detail-dialog .close-dialog').click();await page.locator('#unit-hidden-toggle').click();await expect(unknown).toBeHidden();
 await page.locator('[data-distribution-view="donut"]').click();await expect(page.locator('#distribution-donut svg')).toBeVisible();await expect(page.locator('#distribution-donut')).toContainText('%');
});
test('drone chart surface selects type and positions expose correct balance',async({page})=>{
 await open(page);await page.locator('[data-metric="drones"]').click();await page.locator('[data-drone-card="fpv"] .drone-mini').click();await expect(page.locator('#category-title')).toContainText('FPV');
 await expect(page.locator('.drone-heading')).not.toContainText('FPV має окремий масштаб');
 await page.locator('[data-metric="positions"]').click();await page.locator('[data-graph="balance"]').click();
 await expect(page.locator('#chart-foot .balance-total')).toContainText('-291');
});
test('clicking an actual chart value selects its accounting day',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await page.locator('#trend-chart').scrollIntoViewIfNeeded();
 await expect(page.locator('#trend-chart .apexcharts-svg')).toBeVisible();
 const point=await page.evaluate(()=>{
  const series=document.querySelector('#trend-chart .apexcharts-series');
  const path=series.querySelector('path[fill="none"]'),commands=path.getAttribute('d').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),svg=path.ownerSVGElement,p=svg.createSVGPoint();
  p.x=commands[4];p.y=commands[5];const screen=p.matrixTransform(path.getScreenCTM());
  return {x:screen.x,y:screen.y,day:'2026-09-03'};
 });
 await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
 await expect(page.locator('#from')).toHaveValue(point.day);await expect(page.locator('#to')).toHaveValue(point.day);
 await expect(page.locator('#period-open')).not.toContainText(' — ');
});
test('folding drone cards keeps following content below, then allows scrolling beneath',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page);await page.locator('[data-metric="drones"]').click();
 await page.evaluate(()=>window.scrollTo(0,550));await expect(page.locator('#drone-types')).toHaveClass(/drone-compact/);
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#analysis-grid').getBoundingClientRect().top-document.querySelector('#drone-types').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(12);
 await page.evaluate(()=>window.scrollBy(0,100));
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#analysis-grid').getBoundingClientRect().top-document.querySelector('#drone-types').getBoundingClientRect().bottom)).toBeLessThan(0);
});
