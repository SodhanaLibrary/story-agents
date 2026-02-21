// Signup test case
import { test, expect } from '@playwright/test';
import { initiatePlaywrightRoutes } from 'ftmocks-utils';

test('Signup', async ({ page }) => {
 await initiatePlaywrightRoutes(
        page,
        {
          MOCK_DIR: '../ftmocks',
          FALLBACK_DIR: '../dist',
        },
        'Signup'
      );
  await page.goto('http://localhost:3000/');
  await page.locator("xpath=//a[@href='/login']").click();
  await page.locator("xpath=//a[@href='/signup']").click();
  await page.locator("xpath=//*[@id='signup-email']").click();
  await page.locator("xpath=//*[@id='signup-email']").fill('sodhanaware@gmail.co');
  await page.locator("xpath=//*[@id='signup-name']").click();
  await page.locator("xpath=//*[@id='signup-name']").fill('Sriniva');
  await page.locator("xpath=//*[@id='signup-password']").click();
  await page.locator("xpath=//*[@id='signup-password']").fill('mypassword12');
  await page.locator("xpath=//*[normalize-space(text())='Sign up']").click();
  await page.locator("xpath=//*[normalize-space(text())='Account created. Please check your email to verify your account.']").click();
  await page.close();
});
