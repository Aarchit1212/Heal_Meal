const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'AI is unavailable in this browser test.' }) }));
  await page.goto('/');
});

test('renders the dashboard and calculator interactions', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /voice-powered health companion/i })).toBeVisible();
  await page.getByRole('button', { name: /Calculate BMI/ }).click();
  await expect(page.locator('#toolResult')).toContainText('height between 100 and 250 cm');
  await page.locator('#bmiHeight').fill('170');
  await page.locator('#bmiWeight').fill('65');
  await page.getByRole('button', { name: /Calculate BMI/ }).click();
  await expect(page.locator('#toolResult')).toContainText('BMI: 22.5');

  await page.getByRole('button', { name: /Calorie Calculator/ }).click();
  await page.locator('#calAge').fill('17');
  await page.locator('#calWeight').fill('65');
  await page.locator('#calHeight').fill('170');
  await page.getByRole('button', { name: /Calculate calories/ }).click();
  await expect(page.locator('#toolResult')).toContainText('age 18–100');

  await page.getByRole('button', { name: /Calorie Deficit/ }).click();
  await page.locator('#defAge').fill('40');
  await page.locator('#defWeight').fill('65');
  await page.locator('#defHeight').fill('170');
  await page.locator('#deficitAmount').fill('500');
  await page.getByRole('button', { name: /Calculate target/ }).click();
  await expect(page.locator('#toolResult')).toContainText('at or above resting energy');
});

test('keeps the page within a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /BMR Calculator/ }).click();
  await expect(page.getByRole('heading', { name: /BMR Calculator/ })).toBeVisible();
});

test('passes automated accessibility checks on the dashboard', async ({ page }) => {
  await page.mouse.move(1, 1);
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);

  for (const path of ['/privacy.html', '/terms.html']) {
    await page.goto(path);
    await page.mouse.move(1, 1);
    const legalResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(legalResults.violations, `Accessibility issues on ${path}: ${JSON.stringify(legalResults.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))}`).toEqual([]);
  }
});

