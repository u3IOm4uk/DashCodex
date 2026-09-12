const {test,expect}=require('@playwright/test');

async function openDashboard(page){
 await page.goto('/');
 await expect(page.locator('#source-label')).not.toHaveText('Завантаження даних',{timeout:15000});
 await expect(page.locator('#metrics .metric-card').first()).toBeVisible();
}

test('core dashboard flow',async({page})=>{
 await openDashboard(page);
 const cards=page.locator('#metrics .metric-card');
 expect(await cards.count()).toBeGreaterThan(1);
 const target=cards.nth(1);
 const metric=await target.getAttribute('data-metric');
 await target.click();
 await expect(page.locator(`#metrics [data-metric="${metric}"]`)).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#trend-chart')).toBeVisible();
 await expect(page.locator('#distribution-legend')).toBeVisible();
 await expect(page.locator('#table-body')).toBeVisible();
});
