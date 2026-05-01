import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Chatbot').click();
  await page.getByRole('textbox', { name: 'Haz una pregunta sobre la' }).click();
  await page.getByRole('textbox', { name: 'Haz una pregunta sobre la' }).fill('Dime las normas de la piscina');
  await page.getByRole('button').nth(3).click();
  await page.getByRole('textbox', { name: 'Haz una pregunta sobre la' }).click();
  await page.getByRole('textbox', { name: 'Haz una pregunta sobre la' }).fill('Ha que hora cierra la piscina');
});