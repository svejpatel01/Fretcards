import { expect, test } from '@playwright/test'

// Uses the scale-mistake WAV fixture (1.5s silence, then a single F2 pluck)
// against the default G major, position 2 shape, whose first expected note
// is F#2 -- so this plants an unambiguous wrong note at the very first onset.
test('a planted wrong note is reported and ends the attempt in test (strict) mode', async ({ page }) => {
  await page.goto('/decks/scale-positions')
  await page.getByRole('radio', { name: 'Test (strict)' }).check()

  await page.getByRole('button', { name: 'Enable microphone' }).click()
  await expect(page.getByText(/measuring your room/i)).toBeVisible()

  await expect(page.getByRole('status')).toContainText('Wrong note', { timeout: 15000 })
  await expect(page.getByRole('status')).toContainText('expected F♯2, heard F2')
})
