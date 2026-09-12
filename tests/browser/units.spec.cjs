const {test,expect}=require('@playwright/test');

async function openDashboard(page){
 await page.goto('/');
 await expect(page.locator('#source-label')).not.toHaveText('Завантаження даних',{timeout:15000});
 await expect(page.locator('#table-body .row-button').first()).toBeVisible();
}

test('unit hierarchy expands and archived rows keep historical details',async({page})=>{
 await openDashboard(page);
 const parent=page.locator('#table-body tr.unit-parent').first();
 await expect(parent).toBeVisible();
 const parentName=await parent.getAttribute('data-unit-name');
 expect(parentName).toBeTruthy();
 await parent.locator('.row-button').click();
 await expect(parent.locator('.unit-expand')).toHaveAttribute('aria-expanded','true');
 const child=page.locator(`#table-body tr[data-unit-parent="${parentName.replace(/"/g,'\\"')}"]:visible`).first();
 await expect(child).toBeVisible();
 const childName=await child.getAttribute('data-unit-name');
 expect(childName).toBeTruthy();

 await page.locator('#unit-manage').click();
 await expect(page.locator('#unit-manager-dialog')).toBeVisible();
 const status=page.locator('#unit-manager-list [data-unit-status]').filter({has:page.locator(`option`)}).and(page.locator(`[data-unit-status="${childName.replace(/"/g,'\\"')}"]`));
 await status.selectOption('archived');
 await page.locator('#unit-manager-dialog .unit-manager-close').click();
 await expect(page.locator(`#table-body tr[data-unit-name="${childName.replace(/"/g,'\\"')}"]`)).toBeHidden();

 await page.locator('#unit-archive-toggle').click();
 const archived=page.locator(`#table-body tr[data-unit-name="${childName.replace(/"/g,'\\"')}"]`);
 await expect(archived).toBeVisible();
 await expect(archived).toHaveClass(/unit-status-archived/);
 await archived.locator('.row-button').click();
 await expect(page.locator('#detail-dialog')).toBeVisible();
 await expect(page.locator('#detail-name')).toHaveText(childName);
});
