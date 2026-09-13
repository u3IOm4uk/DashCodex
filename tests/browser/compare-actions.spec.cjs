const {test,expect}=require('@playwright/test');

test('comparison dropdown actions reset metrics and select all non-overlapping leaf units',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#mobile-compare').click();
 await expect(page.locator('#compare-catalog [data-compare-metric]').first()).toBeAttached({timeout:15000});

 await page.locator('#compare-mobile-metrics-toggle').click();
 const metricReset=page.locator('#compare-metrics-reset');
 await expect(metricReset).toBeVisible();
 await expect(metricReset).toHaveClass(/button/);
 const metricResetStyle=await metricReset.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {width:r.width,height:r.height,paddingTop:s.paddingTop,paddingRight:s.paddingRight,paddingBottom:s.paddingBottom,paddingLeft:s.paddingLeft,borderRadius:s.borderRadius,fontSize:s.fontSize}});
 await metricReset.click();
 await expect(page.locator('#compare-catalog [data-compare-metric]:checked')).toHaveCount(0);
 await expect(page.locator('#compare-selected-count')).toHaveText('0 / 6');

 await page.locator('#compare-mobile-units-toggle').click();
 const unitsPanel=page.locator('.compare-units-panel');
 await expect(unitsPanel.getByRole('button',{name:'Загальний підсумок'})).toHaveCount(0);
 const panelStyle=await unitsPanel.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {position:s.position,left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
 expect(panelStyle.position).toBe('fixed');expect(panelStyle.left).toBeGreaterThanOrEqual(0);expect(panelStyle.right).toBeLessThanOrEqual(390);expect(panelStyle.top).toBeGreaterThanOrEqual(0);expect(panelStyle.bottom).toBeLessThanOrEqual(844);
 const heading=unitsPanel.locator('.compare-sidebar-head h3'),selectAll=page.locator('#compare-units-select-all'),reset=page.locator('#compare-units-all'),count=page.locator('#compare-unit-count');
 await expect(selectAll).toHaveClass(/button/);await expect(reset).toHaveClass(/button/);
 await expect(selectAll).toHaveText('Усі');await expect(reset).toHaveText('Скинути');await expect(count).toHaveText('0');
 const [headingBox,countBox,allBox,resetBox]=await Promise.all([heading.boundingBox(),count.boundingBox(),selectAll.boundingBox(),reset.boundingBox()]);
 const center=box=>box.y+box.height/2;
 expect(Math.abs(center(headingBox)-center(countBox))).toBeLessThanOrEqual(2);expect(Math.abs(center(countBox)-center(allBox))).toBeLessThanOrEqual(2);expect(Math.abs(center(allBox)-center(resetBox))).toBeLessThanOrEqual(1);
 const unitButtonStyles=await Promise.all([selectAll,reset].map(locator=>locator.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {width:r.width,height:r.height,paddingTop:s.paddingTop,paddingRight:s.paddingRight,paddingBottom:s.paddingBottom,paddingLeft:s.paddingLeft,borderRadius:s.borderRadius,fontSize:s.fontSize}})));
 expect(unitButtonStyles).toEqual([metricResetStyle,metricResetStyle]);
 const expectedLeaves=await page.locator('#compare-unit-tree [data-compare-unit]').evaluateAll(inputs=>inputs.filter(input=>{const node=input.closest('.compare-unit-node'),child=[...node.children].find(el=>el.classList.contains('compare-unit-children')),runtime=window.ContourUnits?.catalog?.index;return !child&&(!runtime||runtime[input.dataset.compareUnit])}).length);
 expect(expectedLeaves).toBeGreaterThan(0);
 await selectAll.click();
 await expect(count).toHaveText(String(expectedLeaves));
 const checkedLeaves=page.locator('#compare-unit-tree [data-compare-unit]:checked').filter({hasNot:page.locator('[data-derived-selected="true"]')});
 expect(await checkedLeaves.evaluateAll(inputs=>inputs.filter(input=>{const node=input.closest('.compare-unit-node');return ![...node.children].some(el=>el.classList.contains('compare-unit-children'))}).length)).toBe(expectedLeaves);
 const derived=page.locator('#compare-unit-tree [data-compare-unit][data-derived-selected="true"]:checked');expect(await derived.count()).toBeGreaterThan(0);
 const derivedValid=await derived.evaluateAll(inputs=>inputs.every(input=>{const node=input.closest('.compare-unit-node'),children=[...node.children].find(el=>el.classList.contains('compare-unit-children')),runtime=window.ContourUnits?.catalog?.index,leaves=children?[...children.querySelectorAll('[data-compare-unit]')].filter(child=>{const childNode=child.closest('.compare-unit-node'),nested=[...childNode.children].find(el=>el.classList.contains('compare-unit-children'));return !nested&&(!runtime||runtime[child.dataset.compareUnit])}):[];return leaves.length>0&&leaves.every(child=>child.checked)}));
 expect(derivedValid).toBe(true);
 const hasActualOverlap=await page.locator('#compare-unit-tree').evaluate(root=>[...root.querySelectorAll('[data-compare-unit]:checked:not([data-derived-selected="true"])')].some(input=>{const node=input.closest('.compare-unit-node'),children=[...node.children].find(el=>el.classList.contains('compare-unit-children'));return !!children?.querySelector('[data-compare-unit]:checked:not([data-derived-selected="true"])')}));
 expect(hasActualOverlap).toBe(false);
 await reset.click();
 await expect(page.locator('#compare-unit-tree [data-compare-unit]:checked')).toHaveCount(0);
 await expect(count).toHaveText('0');
});
