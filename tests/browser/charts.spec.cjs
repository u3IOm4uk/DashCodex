const {test,expect}=require('@playwright/test');
const {periodRange}=require('../../js/contour-charts.js');

test('chart calendar windows clamp to source boundaries and retain calendar gaps',()=>{
 const dates=['2026-01-01','2026-02-28'];
 expect(periodRange(dates,{from:'2026-02-22',to:'2026-02-28'},30,1)).toEqual({from:'2026-01-30',to:'2026-02-28'});
 expect(periodRange(dates,{from:'2026-01-01',to:'2026-01-07'},30,0)).toEqual({from:'2026-01-01',to:'2026-01-30'});
 expect(periodRange(dates,{from:'2026-01-01',to:'2026-02-28'},10000)).toEqual({from:'2026-01-01',to:'2026-02-28'});
 expect(periodRange(['2026-01-01'],{from:'2026-01-01',to:'2026-01-01'},30)).toEqual({from:'2026-01-01',to:'2026-01-01'});
});

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

test('mini chart hover reports its date and value including missing and zero data',async({page})=>{
 await page.goto('/');
 const mini=page.locator('#metrics .mini-hover').first();await expect(mini).toBeVisible();
 await mini.hover();
 const expected=await mini.evaluate(el=>{const p=JSON.parse(el.dataset.miniPoints),i=Math.round((p.days.length-1)/2);return [ContourView.fullDate(p.days[i]),ContourView.fmt(p.values[i])];});
 for(const text of expected)await expect(page.locator('#mini-tooltip')).toContainText(text);
 // The UI must preserve zero/null rather than fabricating a value for missing days.
 await page.evaluate(()=>document.querySelector('#metrics .mini-hover').outerHTML='<span class="mini-hover" style="height:32px" data-mini-points=\'{"days":["2026-09-01","2026-09-02"],"values":[0,null],"label":"Перевірка","color":"#ff0000","mode":"area"}\'></span>');
 await mini.hover({position:{x:1,y:10}});await expect(page.locator('#mini-tooltip')).toContainText('01.09.2026');await expect(page.locator('#mini-tooltip strong')).toHaveText('0');
 const box=await mini.boundingBox();await mini.hover({position:{x:box.width-1,y:10}});await expect(page.locator('#mini-tooltip strong')).toHaveText('—');
 await page.keyboard.press('Escape');await expect(page.locator('#mini-tooltip')).toBeHidden();
});

test('wheel and presets resize only the chart, retain modes, and reset with filters',async({page})=>{
 await page.goto('/');const host=page.locator('#trend-chart');await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 const accounting=()=>page.evaluate(()=>({from:document.querySelector('#from').value,to:document.querySelector('#to').value,cards:document.querySelector('#metrics').textContent,table:document.querySelector('#table-body').textContent,foot:document.querySelector('#chart-foot').textContent}));
 const before=await accounting();await host.hover();await page.mouse.wheel(0,150);
 await expect(host).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await accounting()).toEqual(before);
 const controls=page.locator('.trend-panel .chart-period-controls');await controls.locator('[data-plot-days="30"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');await expect(host).toHaveAttribute('data-plot-to','2026-09-07');
 await page.locator('[data-chart="bar"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');
 await controls.locator('[data-plot-days="reset"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 await controls.locator('[data-plot-days="30"]').click();await controls.locator('[data-plot-days="7"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');
 await host.hover();await page.mouse.wheel(0,-150);await expect(host).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await accounting()).toEqual(before);
 await page.locator('[data-days="1"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-08-20');
 await controls.locator('[data-plot-days="7"]').click();await expect(host).toHaveAttribute('data-plot-from','2026-09-01');await expect(page.locator('#from')).toHaveValue('2026-09-07');
 await page.locator('#table-body .row-button').first().click();const detail=page.locator('#detail-trend-chart');await expect(detail).toBeVisible();
 const table=await page.locator('#detail-content table').textContent();await page.locator('#detail-dialog [data-plot-days="7"]').click();await expect(detail).toHaveAttribute('data-plot-from','2026-09-01');await detail.hover();await page.mouse.wheel(0,120);await expect(detail).not.toHaveAttribute('data-plot-from','2026-09-01');expect(await page.locator('#detail-content table').textContent()).toEqual(table);
});

test('cross-category comparison builds a shared analytical view with hierarchical unit scope',async({page})=>{
 await page.goto('/');await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await page.locator('#compare-open').click();await expect(page.locator('#compare-dialog')).toBeVisible();
 const categories=page.locator('#compare-catalog .compare-category');expect(await categories.count()).toBeGreaterThan(0);expect(await categories.evaluateAll(nodes=>nodes.every(node=>!node.open))).toBe(true);
 await categories.first().locator('summary').click();await expect(categories.first().locator('[data-compare-metric]').first()).toBeVisible({timeout:15000});
 await expect(page.locator('#compare-chart .apexcharts-canvas')).toBeVisible({timeout:15000});
 const checked=page.locator('#compare-catalog [data-compare-metric]:checked');expect(await checked.count()).toBeGreaterThanOrEqual(2);
 const [metricsBox,workspaceBox,unitsBox]=await Promise.all([page.locator('.compare-metrics-panel').boundingBox(),page.locator('.compare-workspace').boundingBox(),page.locator('.compare-units-panel').boundingBox()]);
 expect(metricsBox.x+metricsBox.width).toBeLessThanOrEqual(workspaceBox.x+1);expect(unitsBox.x).toBeGreaterThanOrEqual(workspaceBox.x+workspaceBox.width-1);
 const graphControls=page.locator('.compare-chart-controls');await expect(graphControls).toHaveClass(/segmented/);expect(await graphControls.locator('button').allTextContents()).toEqual(['','']);
 const valueControls=page.locator('.compare-value-controls');await expect(valueControls).toHaveClass(/segmented/);
 await expect(page.locator('#compare-units-all')).toHaveAttribute('aria-pressed','true');
 const parentToggle=page.locator('#compare-unit-tree [data-unit-toggle]').first(),parentRow=parentToggle.locator('xpath=..'),parentNode=parentRow.locator('xpath=..'),parentInput=parentRow.locator('[data-compare-unit]');
 await parentInput.check();await expect(parentInput).toBeChecked();await expect(parentToggle).toHaveAttribute('aria-expanded','true');
 const children=parentNode.locator('.compare-unit-children [data-compare-unit]');expect(await children.count()).toBeGreaterThanOrEqual(2);await expect(children.first()).toBeVisible();
 const childNames=await children.evaluateAll(nodes=>nodes.slice(0,2).map(input=>input.parentElement.textContent.trim()));
 await children.first().check();await expect(parentInput).not.toBeChecked();await expect(children.first()).toBeChecked();
 await children.nth(1).check();await expect(page.locator('#compare-unit-count')).toContainText('2');await expect(page.locator('#compare-data-note')).toContainText('Серії сумуються');
 await expect(page.locator('#compare-data-note')).toContainText('Нормалізація');
 await expect(page.locator('#compare-table-head')).toContainText('Підрозділ');await expect(page.locator('#compare-table-body')).toContainText(childNames[0]);await expect(page.locator('#compare-table-body')).toContainText(childNames[1]);
 await expect(page.locator('#compare-table-foot')).toContainText('Абсолютні значення джерела');
 const tableBeforeMode=await page.locator('#compare-table-body').textContent();
 await page.locator('[data-compare-mode="absolute"]').click();await expect(page.locator('[data-compare-mode="absolute"]')).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('#compare-table-body').textContent()).toEqual(tableBeforeMode);
 await parentInput.check();await expect(parentInput).toBeChecked();await expect(page.locator('#compare-unit-count')).toContainText('1');
 const directChildren=await parentNode.evaluate(node=>[...node.querySelector('.compare-unit-children').children].map(child=>child.querySelector('.compare-unit-row [data-compare-unit]').dataset.compareUnit));
 const hierarchyTable=page.locator('.compare-table-wrap table');await expect(hierarchyTable).toHaveClass(/detail-hierarchy-table/);await expect(page.locator('#compare-unit-breakdown-note')).toBeVisible();
 const firstBlock=await page.locator('#compare-table-body').evaluate(body=>{const parent=body.querySelector('.detail-unit-parent'),date=parent.querySelector('.detail-unit-date'),span=Number(date.getAttribute('rowspan')),names=[];let row=parent.nextElementSibling;for(let i=1;i<span;i++,row=row.nextElementSibling)names.push(row.dataset.detailUnit);return {parent:parent.dataset.detailUnit,span,names}});
 const parentName=await parentInput.getAttribute('data-compare-unit');expect(firstBlock.parent).toBe(parentName);expect(firstBlock.span).toBe(directChildren.length+1);expect(firstBlock.names).toEqual(directChildren);
 await page.locator('[data-compare-chart="bar"]').click();await expect(page.locator('[data-compare-chart="bar"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#compare-table-body tr').first()).toBeVisible();
 await expect(page.locator('.compare-table-panel')).toHaveClass(/panel/);await expect(page.locator('.compare-table-panel')).toHaveClass(/details-panel/);await expect(page.locator('.compare-table-wrap')).toHaveClass(/table-wrap/);
 const detailWrapStyle=await page.locator('#analysis-grid .details-panel .table-wrap').evaluate(el=>{const s=getComputedStyle(el);return {maxHeight:s.maxHeight,overflowX:s.overflowX,overflowY:s.overflowY}}),compareWrapStyle=await page.locator('.compare-table-wrap').evaluate(el=>{const s=getComputedStyle(el);return {maxHeight:s.maxHeight,overflowX:s.overflowX,overflowY:s.overflowY}});expect(compareWrapStyle).toEqual(detailWrapStyle);
 const dashboardFrom=await page.locator('#from').inputValue(),dashboardTo=await page.locator('#to').inputValue();await page.locator('#compare-dashboard-period').click();await expect(page.locator('#compare-from')).toHaveValue(dashboardFrom);await expect(page.locator('#compare-to')).toHaveValue(dashboardTo);
});

test('comparison action keeps mobile navigation and opens filters as dropdown overlays',async({page})=>{
 await page.goto('/');await expect(page.locator('#trend-chart')).toBeVisible({timeout:15000});
 await expect(page.locator('.section-nav-row > #compare-open')).toBeVisible();
 await expect(page.locator('.analysis-tools #compare-open')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 const nav=page.locator('.mobile-nav');
 await expect(nav).toBeVisible();await expect(page.locator('#mobile-overview')).toBeVisible();await expect(page.locator('#mobile-menu')).toBeVisible();await expect(page.locator('#mobile-compare')).toBeVisible();await expect(page.locator('#mobile-dates')).toBeHidden();await expect(page.locator('#mobile-source')).toBeHidden();
 await page.locator('#mobile-compare').click();
 const dialog=page.locator('#compare-dialog');await expect(dialog).toBeVisible();await expect(nav).toBeVisible();expect(await dialog.evaluate(el=>el.matches(':modal'))).toBe(false);
 const [dialogBox,navBox]=await Promise.all([dialog.boundingBox(),nav.boundingBox()]);expect(dialogBox.y+dialogBox.height).toBeLessThanOrEqual(navBox.y+1);
 const metrics=page.locator('.compare-metrics-panel'),units=page.locator('.compare-units-panel'),workspace=page.locator('.compare-workspace');
 await expect(page.locator('.compare-mobile-pickers')).toBeVisible();await expect(metrics).toBeHidden();await expect(units).toBeHidden();
 const valueField=page.locator('.compare-value-controls').locator('xpath=..'),chartField=page.locator('.compare-chart-controls').locator('xpath=..'),toolbar=page.locator('.compare-toolbar');
 const [valueBox,chartBox,toolbarBox]=await Promise.all([valueField.boundingBox(),chartField.boundingBox(),toolbar.boundingBox()]);
 expect(Math.abs(valueBox.y-chartBox.y)).toBeLessThanOrEqual(1);expect(toolbarBox.x+toolbarBox.width-(chartBox.x+chartBox.width)).toBeLessThanOrEqual(13);
 const workspaceY=await workspace.evaluate(el=>el.getBoundingClientRect().y);
 await page.locator('label[for="compare-mobile-metrics-toggle"]').click();await expect(metrics).toBeVisible();await expect(page.locator('#compare-catalog .compare-category[open]')).toHaveCount(0);
 const metricsStyle=await metrics.evaluate(el=>{const s=getComputedStyle(el);return {position:s.position,bottom:s.bottom,maxHeight:s.maxHeight}});expect(metricsStyle.position).toBe('fixed');expect(metricsStyle.bottom).toBe('auto');expect(parseFloat(metricsStyle.maxHeight)).toBeGreaterThan(0);expect(Math.abs((await workspace.evaluate(el=>el.getBoundingClientRect().y))-workspaceY)).toBeLessThanOrEqual(1);
 const metricsBox=await metrics.boundingBox();expect(metricsBox.x).toBeGreaterThanOrEqual(0);expect(metricsBox.x+metricsBox.width).toBeLessThanOrEqual(391);expect(metricsBox.height).toBeLessThanOrEqual(parseFloat(metricsStyle.maxHeight)+1);
 await page.locator('label[for="compare-mobile-units-toggle"]').click();await expect(metrics).toBeHidden();await expect(units).toBeVisible();const unitsStyle=await units.evaluate(el=>{const s=getComputedStyle(el);return {position:s.position,bottom:s.bottom,maxHeight:s.maxHeight}});expect(unitsStyle.position).toBe('fixed');expect(unitsStyle.bottom).toBe('auto');expect(parseFloat(unitsStyle.maxHeight)).toBeGreaterThan(0);
 const unitsBox=await units.boundingBox();expect(unitsBox.x+unitsBox.width).toBeLessThanOrEqual(391);expect(unitsBox.height).toBeLessThanOrEqual(parseFloat(unitsStyle.maxHeight)+1);expect(Math.abs((await workspace.evaluate(el=>el.getBoundingClientRect().y))-workspaceY)).toBeLessThanOrEqual(1);
 await page.locator('label[for="compare-mobile-units-toggle"]').click();await expect(units).toBeHidden();
 await page.locator('#mobile-overview').click();await expect(dialog).toBeHidden();await expect(nav).toBeVisible();
});