import { expect, test } from '@playwright/test'

test('the tuner renders the mic permission gate with no console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/tuner')
  await expect(page.getByRole('heading', { name: 'Tuner' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable microphone' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('the dev page (?debug) renders the source picker with no console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/dev?debug')
  await expect(page.getByRole('heading', { name: 'Dev tools' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Microphone' })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Enable microphone' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('the dev page without ?debug shows the disabled placeholder, not the real tools', async ({
  page,
}) => {
  await page.goto('/dev')
  await expect(page.getByText('Add ?debug to the URL to enable this page.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable microphone' })).not.toBeVisible()
})
