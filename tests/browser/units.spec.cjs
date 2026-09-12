const {test,expect}=require('@playwright/test');

async function openDashboard(page){
 await page.goto('/');
 await expect(page.locator('#source-label')).not.toHaveText('Завантаження даних',{timeout:15000});
 await expect(page.locator('#table-body .row-button').first()).toBeVisible();
}

async function rowIndexBy(page,key,value,visibleOnly=false){
 return page.locator('#table-body tr').evaluateAll((rows,args)=>rows.findIndex(row=>row.dataset[args.key]===args.value&&(!args.visibleOnly||!row.hidden)),{key,value,visibleOnly});
}

test('explicit hierarchy config defines parents and leaves unknown rows unconfigured',async({page})=>{
 await openDashboard(page);
 const result=await page.evaluate(()=>{
   const [groupA,groupB]=ContourConfig.GROUP_NAMES;
   const sheet=ContourConfig.WORKBOOK_SCHEMA.sheets.ops;
   const hierarchy=[
    {name:groupA,children:[{name:'15 АК',children:[{name:'Unit A'}]}]},
    {name:groupB,children:[{name:'Unit B'}]}
   ];
   const records=[
    {date:'2026-01-01',row:1,group:'Unit A'},
    {date:'2026-01-01',row:2,group:groupB},
    {date:'2026-01-01',row:3,group:'15 АК'},
    {date:'2026-01-01',row:4,group:'Shared'},
    {date:'2026-01-01',row:5,group:groupA},
    {date:'2026-01-01',row:6,group:'Unit B'}
   ];
   const catalog=ContourUnits.buildCatalog({sheets:{[sheet]:{records}}},hierarchy);
   return {
    groupA,groupB,
    corpsParent:catalog.index['15 АК']?.parent,
    corpsDepth:catalog.index['15 АК']?.depth,
    unitParent:catalog.index['Unit A']?.parent,
    unitDepth:catalog.index['Unit A']?.depth,
    unitBParent:catalog.index['Unit B']?.parent,
    sharedParent:catalog.index.Shared?.parent,
    sharedUnconfigured:catalog.index.Shared?.unconfigured,
    unconfigured:catalog.unconfigured
   };
 });
 expect(result.corpsParent).toBe(result.groupA);
 expect(result.corpsDepth).toBe(1);
 expect(result.unitParent).toBe('15 АК');
 expect(result.unitDepth).toBe(2);
 expect(result.unitBParent).toBe(result.groupB);
 expect(result.sharedParent).toBeNull();
 expect(result.sharedUnconfigured).toBe(true);
 expect(result.unconfigured).toEqual(['Shared']);
});

test('configured hierarchy renders below parent with branch and smooth expand collapse',async({page})=>{
 await openDashboard(page);
 const parent=page.locator('#table-body tr.unit-parent:visible').first();
 await expect(parent).toBeVisible();
 const parentName=await parent.getAttribute('data-unit-name');
 expect(parentName).toBeTruthy();
 await expect(parent.locator('.unit-detail')).toHaveCount(0);
 const order=await parent.locator('.unit-row-main').locator(':scope > *').evaluateAll(nodes=>nodes.map(node=>node.className));
 expect(order[0]).toContain('row-index');
 expect(order[1]).toContain('unit-expand');
 expect(order[2]).toContain('row-button');

 await parent.locator('.unit-expand').click();
 await expect(parent.locator('.unit-expand')).toHaveAttribute('aria-expanded','true');
 const parentIndex=await rowIndexBy(page,'unitName',parentName,true);
 const childIndex=await rowIndexBy(page,'unitParent',parentName,true);
 expect(childIndex).toBeGreaterThan(parentIndex);
 const child=page.locator('#table-body tr').nth(childIndex);
 await expect(child).toBeVisible();
 const childName=await child.getAttribute('data-unit-name');
 const childDepth=Number(await child.getAttribute('data-unit-depth'));
 expect(childName).toBeTruthy();
 expect(childDepth).toBeGreaterThan(0);
 await expect(child.locator('.unit-branch')).toBeVisible();
 expect(await child.locator('.unit-branch-segment').count()).toBe(childDepth);
 await expect(child.locator('.unit-branch-segment.current')).toHaveCount(1);
 await expect(child).toHaveClass(/unit-animating/);
 await expect(child).not.toHaveClass(/unit-animating/);

 await parent.locator('.unit-expand').click();
 await expect(child).toHaveClass(/unit-animating/);
 await expect(child).toBeHidden();
 await expect(parent.locator('.unit-expand')).toHaveAttribute('aria-expanded','false');

 await parent.locator('.unit-expand').click();
 await expect(child).toBeVisible();
 await expect(child).not.toHaveClass(/unit-animating/);

 await parent.locator('.row-button').click();
 await expect(page.locator('#detail-dialog')).toBeVisible();
 await expect(page.locator('#detail-name')).toHaveText(parentName);
 await page.locator('#detail-dialog .close-dialog').click();

 await page.locator('#unit-manage').click();
 await expect(page.locator('#unit-manager-dialog')).toBeVisible();
 await page.getByLabel(`Статус: ${childName}`).selectOption('archived');
 await page.locator('#unit-manager-dialog .unit-manager-close').click();
 let currentIndex=await rowIndexBy(page,'unitName',childName,false);
 expect(currentIndex).toBeGreaterThan(-1);
 await expect(page.locator('#table-body tr').nth(currentIndex)).toBeHidden();

 await page.locator('#unit-archive-toggle').click();
 currentIndex=await rowIndexBy(page,'unitName',childName,true);
 expect(currentIndex).toBeGreaterThan(-1);
 const archived=page.locator('#table-body tr').nth(currentIndex);
 await expect(archived).toBeVisible();
 await expect(archived).toHaveClass(/unit-status-archived/);
 await archived.locator('.row-button').click();
 await expect(page.locator('#detail-dialog')).toBeVisible();
 await expect(page.locator('#detail-name')).toHaveText(childName);
});
