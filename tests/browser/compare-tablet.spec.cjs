const {test,expect}=require('@playwright/test');

test('tablet portrait keeps comparison in mobile shell while bottom navigation is visible',async({page})=>{
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/');
 await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 const nav=page.locator('.mobile-nav'),overview=page.locator('#mobile-overview'),compare=page.locator('#mobile-compare');
 await expect(nav).toBeVisible();
 await expect(page.locator('#compare-open')).toBeHidden();
 await expect(overview).toHaveClass(/active/);
 await expect(compare).not.toHaveClass(/active/);

 await compare.click();
 const dialog=page.locator('#compare-dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).toHaveClass(/compare-mobile-nav/);
 expect(await dialog.evaluate(el=>el.matches(':modal'))).toBe(false);
 await expect(nav).toBeVisible();
 await expect(page.locator('.compare-mobile-pickers')).toBeVisible();
 await expect(compare).toHaveClass(/active/);
 await expect(compare).toHaveAttribute('aria-current','page');
 await expect(overview).not.toHaveClass(/active/);
 const [dialogBox,navBox]=await Promise.all([dialog.boundingBox(),nav.boundingBox()]);
 expect(dialogBox.y+dialogBox.height).toBeLessThanOrEqual(navBox.y+1);

 await dialog.locator('[data-compare-close]').click();
 await expect(dialog).toBeHidden();
 await expect(compare).not.toHaveClass(/active/);
 await expect(compare).not.toHaveAttribute('aria-current','page');
 await expect(overview).toHaveClass(/active/);
});
