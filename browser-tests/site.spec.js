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



test('adds and removes a medication reminder', async ({ page }) => {
  await page.getByRole('button', { name: /Add Medication/ }).click();
  await page.locator('#medicationName').fill('Vitamin test reminder');
  await page.locator('#medicationTime').fill('09:30');
  await page.locator('#medicationDescription').fill('Take with breakfast');
  await page.getByRole('button', { name: 'Save reminder' }).click();
  await expect(page.locator('#medicationList')).toContainText('Vitamin test reminder');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('healmeal_medications') || '[]').length)).toBe(1);
  await page.getByRole('checkbox', { name: 'Select Vitamin test reminder for removal' }).check();
  await page.getByRole('button', { name: /Remove Medication/ }).click();
  await expect(page.locator('#medicationList')).toContainText('No medications added yet');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('healmeal_medications') || '[]').length)).toBe(0);
});

test('clears browser data only after confirmation', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('healthvoice_history', JSON.stringify([{ role: 'user', content: 'Saved test conversation' }]));
    localStorage.setItem('healmeal_medications', JSON.stringify([{ id: 'test-reminder', name: 'Saved test medicine', time: '09:00', note: '', sound: 'gentle' }]));
  });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Clear Saved Data/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('healthvoice_history'))).not.toBeNull();
  const reload = page.waitForEvent('load');
  page.once('dialog', async dialog => { expect(dialog.message()).toMatch(/permanently clears/i); await dialog.accept(); });
  await page.getByRole('button', { name: /Clear Saved Data/ }).click();
  await reload;
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('healthvoice_history'), localStorage.getItem('healmeal_medications')])).toEqual([null, null]);
  await expect(page.locator('#medicationList')).toContainText('No medications added yet');
});

test('keeps quick chat submissions in order and shows provider failures', async ({ page }) => {
  const requestOrder = [];
  await page.route('**/api/chat', async route => {
    const { question } = JSON.parse(route.request().postData());
    requestOrder.push(question);
    await new Promise(resolve => setTimeout(resolve, question === 'First test question' ? 120 : 10));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: question === 'First test question' ? 'First test answer' : 'Second test answer' }) });
  });
  const input = page.locator('#voiceInput');
  await input.fill('First test question');
  await page.getByRole('button', { name: 'Send question' }).click();
  await input.fill('Second test question');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('#conversationArea')).toContainText('Second test answer');
  expect(requestOrder).toEqual(['First test question', 'Second test question']);
  const content = await page.locator('#conversationArea .message-body').allInnerTexts();
  expect(content.slice(-4)).toEqual(['First test question', 'First test answer', 'Second test question', 'Second test answer']);

  await page.route('**/api/chat', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'The AI service is unavailable in this test.' }) }));
  await input.fill('Question during outage');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('#conversationArea')).toContainText('The AI service is unavailable in this test.');
});

test('shows a friendly message when meal-plan generation is unavailable', async ({ page }) => {
  await page.locator('#healthConcern').fill('General balanced meals');
  await page.getByRole('button', { name: /Generate Meal Plan/ }).click();
  await expect(page.locator('#mealPlanStatus')).toContainText('AI is unavailable in this browser test');
});



test('moves keyboard focus through the skip link to main content', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect.poll(() => page.locator('.skip-link').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('falls back to browser speech when the speech service is unavailable', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/voice', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Speech unavailable in test.' }) }));
  const response = page.waitForResponse(response => response.url().endsWith('/api/voice'));
  await page.getByRole('button', { name: /Guide Me/ }).click();
  await expect(page.locator('#conversationArea')).toContainText(/Let me show what I can do|Ask me any health question|I'm here to help you personally|Let's explore your nutrition goals|Get practical meal ideas with me/);
  expect((await response).status()).toBe(503);
  expect(pageErrors).toEqual([]);
});

