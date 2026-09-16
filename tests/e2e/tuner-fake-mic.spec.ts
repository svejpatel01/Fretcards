import { expect, test } from '@playwright/test'

// Exercises the real getUserMedia -> AnalyserNode mic path (not just the
// Node-side pipeline unit tests) against a synthesized, looping WAV fed in
// as a fake mic device (see globalSetup.ts and fixturePaths.ts).
test('the tuner calibrates against silence, then reads a clean E4 tone from a fake mic', async ({
  page,
}) => {
  await page.goto('/tuner')
  await page.getByRole('button', { name: 'Enable microphone' }).click()

  // The fixture leads with 1.5s of silence, longer than the 1s calibration
  // window, so calibration should complete against real silence.
  await expect(page.getByText(/measuring your room/i)).toBeVisible()

  // Once calibration finishes and the WAV's tone plays, the dial should settle on E4.
  await expect(page.getByTestId('tuner-note')).toHaveText('E4', { timeout: 15000 })

  const centsText = await page.getByTestId('tuner-cents').textContent()
  const cents = Number(centsText?.replace('¢', '').replace('+', ''))
  expect(Math.abs(cents)).toBeLessThan(15)
})
