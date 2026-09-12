const {test,expect}=require('@playwright/test');

async function openDashboard(page){
 await page.goto('/');
 await expect(page.locator('#source-label')).not.toHaveText('Завантаження даних',{timeout:15000});
 await expect(page.locator('#table-body .row-button').first()).toBeVisible();
}

async function rowIndexBy(page,key,value,visibleOnly=false){
 return page.locator('#table-body tr').evaluateAll((rows,args)=>rows.findIndex(row=>row.dataset[args.key]===args.value&&(!args.visibleOnly||!row.hidden)),{key,value,visibleOnly});
}

test('hierarchy inference keeps stable parents and rejects ambiguous ones',async({page})=>{
 await openDashboard(page);
 const result=await page.evaluate(()=>{
   const [groupA,groupB]=ContourConfig.GROUP_NAMES;
   const sheet=ContourConfig.WORKBOOK_SCHEMA.sheets.ops;
   const records=[
    {date:'2026-01-01',row:1,group:groupA},{date:'2026-01-01',row:2,group:'15 АК'},{date:'2026-01-01',row:3,group:'Unit A'},{date:'2026-01-01',row:4,group:groupB},{date:'2026-01-01',row:5,group:'Unit B'},{date:'2026-01-01',row:6,group:'Shared'},
    {date:'2026-01-02',row:1,group:groupA},{date:'2026-01-02',row:2,group:'15 АК'},{date:'2026-01-02',row:3,group:'Unit A'},{date:'2026-01-02',row:4,group:'Shared'},{date:'2026-01-02',row:5,group:groupB},{date:'2026-01-02',row:6,group:'Unit B'}
   ];
   const catalog=ContourUnits.buildCatalog({sheets:{[sheet]:{records}}});
   return {
    groupA,groupB,
    corpsParent:catalog.index['15 АК']?.parent,
    unitParent:catalog.index['Unit A']?.parent,
    unitBParent:catalog.index['Unit B']?.parent,
    sharedParent:catalog.index.Shared?.parent,
    sharedAmbiguous:catalog.index.Shared?.ambiguous
   };
 });
 expect(result.corpsParent).toBe(result.groupA);
 expect(result.unitParent).toBe('15 АК');
 expect(result.unitBParent).toBe(result.groupB);
 expect(result.sharedParent).toBeNull();
 expect(result.sharedAmbiguous).toBe(true);
});

test('expand control is aligned before the name and the name opens details',async({page})=>{
 await openDashboard(page);
 const snapshot=await page.evaluate(()=>ContourUnits.catalog.nodes.map(({name,parent,level,ambiguous,children})=>({name,parent,level,ambiguous,children})));
 console.log('UNIT_CATALOG:'+JSON.stringify(snapshot));
 const parent=page.locator('#table-body tr.unit-parent').first();
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
 const childIndex=await rowIndexBy(page,'unitParent',parentName,true);
 expect(childIndex).toBeGreaterThan(-1);
 const child=page.locator('#table-body tr').nth(childIndex);
 await expect(child).toBeVisible();
 const childName=await child.getAttribute('data-unit-name');
 expect(childName).toBeTruthy();

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
