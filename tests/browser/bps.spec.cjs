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
