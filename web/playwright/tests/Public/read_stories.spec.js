// Read stories test case
import { test, expect } from '@playwright/test';
import { initiatePlaywrightRoutes } from 'ftmocks-utils';

test('Read stories', async ({ page }) => {
 await initiatePlaywrightRoutes(
        page,
        {
          MOCK_DIR: '../ftmocks',
          FALLBACK_DIR: '../dist',
        },
        'Read stories'
      );
  await page.goto('http://localhost:3000/');
  await page.locator("xpath=//*[normalize-space(text())='Tara and the Lost Carrot']").click();
  await page.locator("xpath=//*[normalize-space(text())='Next Page']").click();
  await page.locator("xpath=//*[normalize-space(text())='Next Page']").click();
  await page.locator("xpath=//*[normalize-space(text())='Next Page']").click();
  await page.locator("xpath=//*[normalize-space(text())='Next Page']").click();
  await page.locator("xpath=//*[local-name()='svg'][@data-testid='MenuIcon']").click();
  await page.locator("xpath=//img[@src='/storage/pages/Tara and the Lost Carrot_page_1.png']").click();
  await page.locator("xpath=//img[@src='/storage/pages/Tara and the Lost Carrot_page_2.png']").click();
  await page.locator("xpath=//img[@src='/storage/pages/Tara and the Lost Carrot_page_3.png']").click();
  await page.locator("xpath=//*[local-name()='svg'][@data-testid='CloseIcon']").click();
  await page.close();
});
