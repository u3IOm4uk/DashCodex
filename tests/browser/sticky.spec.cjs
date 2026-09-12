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
 await expect.poll(async()=>page.evaluate(()=>{
   const dock=document.querySelector('#workspace-dock').getBoundingClientRect();
   const content=(document.querySelector('#notice:not([hidden])')||document.querySelector('.analysis-heading')).getBoundingClientRect();
   return Math.abs((content.top-dock.bottom)-12);
 }),{timeout:7000}).toBeLessThan(45);
 const state=await page.evaluate(()=>{
   const intro=document.querySelector('.page-heading').getBoundingClientRect();
   return {scrollY,introBottom:intro.bottom};
 });
 expect(state.scrollY).toBeGreaterThan(1);
 expect(state.introBottom).toBeLessThan(120);
});

test('narrow compact cards keep values and labels inside the same cards',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [1440,1024,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('#metrics .metric-card').first()).toBeVisible();
  const expanded=await page.locator('#metrics .metric-card-paired').first().evaluate(e=>e.getBoundingClientRect().width);
  await page.evaluate(()=>{window.__originalCards=[...document.querySelectorAll('#metrics .metric-card')];window.scrollTo(0,500)});await expect(page.locator('body')).toHaveClass(/cards-away/);
  await expect.poll(()=>page.locator('#metrics .metric-card-paired').first().evaluate(e=>e.getBoundingClientRect().width)).toBeLessThan(expanded*.97);
  expect(await page.evaluate(()=>[...document.querySelectorAll('#metrics .metric-card')].every((e,i)=>e===window.__originalCards[i]))).toBe(true);
  const clipped=await page.locator('#metrics .metric-card').evaluateAll(cards=>cards.flatMap(card=>{const b=card.getBoundingClientRect();return [...card.querySelectorAll('.stat-value strong,.stat-value .change-badge,.metric-top')].filter(el=>{const r=el.getBoundingClientRect();return r.right>b.right+1||r.bottom>b.bottom+1}).map(el=>el.textContent)}));expect(clipped).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 }
});
