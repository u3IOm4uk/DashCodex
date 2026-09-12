const {test,expect}=require('@playwright/test');

test('BpS cards and FPV selection remain functional',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#metrics [data-metric="drones"]')).toBeVisible({timeout:15000});
 await page.locator('#metrics [data-metric="drones"]').click();
 await expect(page.locator('#drone-types')).toBeVisible();
 expect(await page.locator('[data-drone-card]').count()).toBe(7);
 await page.locator('[data-drone="fpv"]').click();
 await expect(page.locator('#category-title')).toContainText(/FPV/i);
 await expect(page.locator('#trend-chart')).toBeVisible();
});

test('BpS hover, period controls and legend keep independent FPV scaling',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await page.locator('#metrics [data-metric="drones"]').click();
 const mini=page.locator('[data-drone-card="fpv"] .mini-hover');await mini.hover();await expect(page.locator('#mini-tooltip')).toContainText('FPV');
 await page.locator('[data-mini="fpv"][data-mode="bar"]').click();await mini.hover();await expect(page.locator('#mini-tooltip')).toContainText('FPV');
 await page.locator('#table-body .row-button').first().click();const host=page.locator('#detail-trend-chart'),legend=page.locator('.detail-chart-legend');
 await expect(legend.locator('button')).toHaveCount(7);await expect(legend.locator('button').first()).toHaveAttribute('aria-pressed','false');
 await legend.locator('button').first().click();await expect.poll(()=>host.locator('.apexcharts-yaxis-title').allTextContents()).toContain('FPV');
 const table=await page.locator('.detail-drone-table').textContent();await page.locator('#detail-dialog [data-plot-days="30"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');
 await page.locator('[data-detail-mode="bar"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');expect(await page.locator('.detail-drone-table').textContent()).toEqual(table);
 while(await legend.locator('button[aria-pressed="true"]').count())await legend.locator('button[aria-pressed="true"]').first().click();await expect(page.locator('#detail-legend-hint')).toContainText('Оберіть хоча б один');
 await legend.locator('button').first().click();await expect(page.locator('#detail-legend-hint')).not.toContainText('Оберіть хоча б один');
 await page.locator('#detail-dialog .close-dialog').click();await expect(host).toBeHidden();
});
