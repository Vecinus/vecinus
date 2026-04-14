import { test, expect } from '@playwright/test';

test('Crear documento en chatbot', async ({ page }) => {
  await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Chatbot').click();
  await page.getByRole('textbox', { name: 'Ej: Normas de convivencia' }).click();
  await page.getByRole('textbox', { name: 'Ej: Normas de convivencia' }).fill('Horario de la piscina');
  await page.getByRole('textbox', { name: 'Pega aquí el contenido del' }).click();
  await page.getByRole('textbox', { name: 'Pega aquí el contenido del' }).fill('La piscina abre a las 9:00 am');
  await page.getByRole('button', { name: 'Indexar información' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).waitFor({ state: 'visible', timeout: 15000 });
});

test('Eliminar documento del chatbot', async ({ page }) => {
  await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Chatbot').click();
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).click();
  await page.getByRole('button', { name: 'Eliminar' }).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: 'Eliminar' }).click();
});