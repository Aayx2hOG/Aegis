import { expect, test } from '@playwright/test'

test('the Opportunity Finder presents a simple, understandable workflow', async ({ page }) => {
  await page.goto('/research/compare')

  await expect(page.getByRole('heading', { name: 'Which protocol looks strongest right now?' })).toBeVisible()
  await expect(
    page.getByText('Compare 2–5 protocols using mainnet TVL, current yield, recent growth, and stability.'),
  ).toBeVisible()
  await expect(page.getByPlaceholder('Add another protocol')).toBeVisible()

  await page.getByRole('button', { name: 'Growth' }).click()
  await expect(page.getByText('Momentum and current yield matter most.')).toBeVisible()

  await page.getByText('Data integrity and limitations').click()
  await expect(page.getByText(/Rankings are produced by deterministic application code/)).toBeVisible()

  await expect(page.locator('a[href*="undefined"]')).toHaveCount(0)
})
