import { expect, test } from '@playwright/test'

test('loads the instrument select screen and navigates to the tuner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose an instrument' })).toBeVisible()

  await page.getByRole('link', { name: 'Tuner' }).click()
  await expect(page).toHaveURL(/\/tuner$/)
  await expect(page.getByRole('heading', { name: 'Tuner' })).toBeVisible()
})
