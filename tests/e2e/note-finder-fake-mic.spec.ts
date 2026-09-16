import { expect, test } from '@playwright/test'

// Reuses the tuner's fake-mic WAV fixture (1.5s silence, then a clean E4
// tone). Math.random is pinned so the deck's first weighted-random pick
// (all cards unseen, so uniformly weighted) deterministically lands on
// pitch class E -- see the comment below for the arithmetic.
test('the note finder grades a correct onset from a fake mic', async ({ page }) => {
  await page.addInitScript(() => {
    // pickNextCard: 12 unseen 'anywhere' cards, each weight 2, total 24.
    // r = 0.35 * 24 = 8.4; subtracting weights[0..3] (8) leaves 0.4, which
    // weights[4] (2) then takes below zero -> selects index 4 -> pitch class E.
    Math.random = () => 0.35
  })

  await page.goto('/decks/note-finder')
  await page.getByRole('button', { name: 'Enable microphone' }).click()

  await expect(page.getByText(/measuring your room/i)).toBeVisible()
  await expect(page.getByTestId('flashcard-label')).toHaveText('E', { timeout: 15000 })

  await expect(page.getByRole('status')).toContainText('correct', { timeout: 15000 })
})
