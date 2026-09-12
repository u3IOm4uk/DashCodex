const {test,expect}=require('@playwright/test');

async function openDashboard(page){
 await page.goto('/');
 await expect(page.locator('#source-label')).not.toHaveText('Завантаження даних',{timeout:15000});
 await expect(page.locator('#table-body .row-button').first()).toBeVisible();
}

async function rowIndexBy(page,key,value,visibleOnly=false){
 return page.locator('#table-body tr').evaluateAll((rows,args)=>rows.findIndex(row=>row.dataset[args.key]===args.value&&(!args.visibleOnly||!row.hidden)),{key,value,visibleOnly});
}

test('unit hierarchy expands and archived rows keep historical details',async({page})=>{
 await openDashboard(page);
 const parent=page.locator('#table-body tr.unit-parent').first();
 await expect(parent).toBeVisible();
 const parentName=await parent.getAttribute('data-unit-name');
 expect(parentName).toBeTruthy();
 await parent.locator('.row-button').click();
 await expect(parent.locator('.unit-expand')).toHaveAttribute('aria-expanded','true');
 const childIndex=await rowIndexBy(page,'unitParent',parentName,true);
 expect(childIndex).toBeGreaterThan(-1);
 const child=page.locator('#table-body tr').nth(childIndex);
 await expect(child).toBeVisible();
 const childName=await child.getAttribute('data-unit-name');
 expect(childName).toBeTruthy();

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