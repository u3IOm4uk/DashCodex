const {test,expect}=require('@playwright/test');

test('comparison dropdown actions reset metrics and select all non-overlapping leaf units',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#mobile-compare').click();
 await expect(page.locator('#compare-catalog [data-compare-metric]').first()).toBeAttached({timeout:15000});

 await page.locator('label[for="compare-mobile-metrics-toggle"]').click();
 const metricReset=page.locator('#compare-metrics-reset');
 await expect(metricReset).toBeVisible();
 await expect(metricReset).toHaveClass(/button/);
 await metricReset.click();
 await expect(page.locator('#compare-catalog [data-compare-metric]:checked')).toHaveCount(0);
 await expect(page.locator('#compare-selected-count')).toHaveText('0 / 6');

 await page.locator('label[for="compare-mobile-units-toggle"]').click();
 const unitsPanel=page.locator('.compare-units-panel');
 await expect(unitsPanel.getByRole('button',{name:'Загальний підсумок'})).toHaveCount(0);
 const selectAll=page.locator('#compare-units-select-all'),reset=page.locator('#compare-units-all');
 await expect(selectAll).toHaveClass(/button/);await expect(reset).toHaveClass(/button/);
 await expect(selectAll).toHaveText('Усі');await expect(reset).toHaveText('Скинути');
 const expectedLeaves=await page.locator('#compare-unit-tree [data-compare-unit]').evaluateAll(inputs=>inputs.filter(input=>{const node=input.closest('.compare-unit-node'),child=[...node.children].find(el=>el.classList.contains('compare-unit-children')),runtime=window.ContourUnits?.catalog?.index;return !child&&(!runtime||runtime[input.dataset.compareUnit])}).length);
 expect(expectedLeaves).toBeGreaterThan(0);
 await selectAll.click();
 await expect(page.locator('#compare-unit-tree [data-compare-unit]:checked')).toHaveCount(expectedLeaves);
 const hasOverlap=await page.locator('#compare-unit-tree').evaluate(root=>[...root.querySelectorAll('[data-compare-unit]:checked')].some(input=>{const node=input.closest('.compare-unit-node'),children=[...node.children].find(el=>el.classList.contains('compare-unit-children'));return !!children?.querySelector('[data-compare-unit]:checked')}));
 expect(hasOverlap).toBe(false);
 await reset.click();
 await expect(page.locator('#compare-unit-tree [data-compare-unit]:checked')).toHaveCount(0);
 await expect(page.locator('#compare-unit-count')).toHaveText('0 обр.');
});
