const {test,expect}=require('@playwright/test');

test('compact category switch keeps sticky row compact',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#metrics .metric-card').first()).toBeVisible({timeout:15000});
 await page.evaluate(()=>window.scrollTo(0,Math.max(500,document.body.scrollHeight*.35)));
 await expect(page.locator('body')).toHaveClass(/cards-away/);
 const cards=page.locator('#metrics .metric-card');
 expect(await cards.count()).toBeGreaterThan(1);
 await cards.nth(1).click();
 await expect(page.locator('body')).toHaveClass(/cards-away/);
 const state=await page.evaluate(()=>{
   const dock=document.querySelector('#workspace-dock').getBoundingClientRect();
   const content=(document.querySelector('#notice:not([hidden])')||document.querySelector('.analysis-heading')).getBoundingClientRect();
   const intro=document.querySelector('.page-heading').getBoundingClientRect();
   return {scrollY,delta:content.top-dock.bottom,introBottom:intro.bottom};
 });
 expect(state.scrollY).toBeGreaterThan(1);
 expect(Math.abs(state.delta-12)).toBeLessThan(45);
 expect(state.introBottom).toBeLessThan(120);
});
