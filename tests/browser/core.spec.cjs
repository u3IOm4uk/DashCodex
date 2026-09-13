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

test('mobile category stepper stays compact above navigation and previews target categories',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openDashboard(page);
 const cards=page.locator('#metrics .metric-card');
 const info=await cards.evaluateAll(nodes=>nodes.map(node=>({
  id:node.dataset.metric,
  name:node.querySelector('.metric-top')?.textContent.trim()||'',
  active:node.getAttribute('aria-pressed')==='true'
 })));
 const activeIndex=info.findIndex(item=>item.active);
 expect(activeIndex).toBeGreaterThanOrEqual(0);
 const previousTarget=info[(activeIndex-1+info.length)%info.length],nextTarget=info[(activeIndex+1)%info.length];
 const previous=page.locator('#previous'),next=page.locator('#next'),nav=page.locator('.mobile-nav');
 await expect(previous).toHaveAttribute('data-target-label',previousTarget.name);
 await expect(next).toHaveAttribute('data-target-label',nextTarget.name);
 await expect(previous).toHaveAttribute('aria-label',`Попередня категорія: ${previousTarget.name}`);
 await expect(next).toHaveAttribute('aria-label',`Наступна категорія: ${nextTarget.name}`);
 const [previousBox,nextBox,navBox]=await Promise.all([previous.boundingBox(),next.boundingBox(),nav.boundingBox()]);
 const previousGap=navBox.y-(previousBox.y+previousBox.height),nextGap=navBox.y-(nextBox.y+nextBox.height);
 expect(previousGap).toBeGreaterThanOrEqual(7);
 expect(previousGap).toBeLessThanOrEqual(9);
 expect(nextGap).toBeGreaterThanOrEqual(7);
 expect(nextGap).toBeLessThanOrEqual(9);
 expect(previousBox.width).toBeLessThan(390/2);
 expect(nextBox.width).toBeLessThan(390/2);
 expect(nextBox.x-(previousBox.x+previousBox.width)).toBeGreaterThan(0);
 expect(await previous.evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
 await next.click();
 await expect(page.locator(`#metrics [data-metric="${nextTarget.id}"]`)).toHaveAttribute('aria-pressed','true');
 const nextNext=info[(activeIndex+2)%info.length];
 await expect(next).toHaveAttribute('data-target-label',nextNext.name);
});
