const {test,expect}=require('@playwright/test');

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
