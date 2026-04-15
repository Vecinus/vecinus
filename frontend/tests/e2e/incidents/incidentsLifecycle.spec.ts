import { test, expect } from '@playwright/test';

test.describe.serial('Incidents workflow', () => {
  test('Crear incidencias', async ({ page }) => {
  await page.goto('http://localhost:8081/sign-in');
  await page.waitForLoadState('networkidle');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('propietario@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Incidencias').click();
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByText('Electricidad').click();
  await page.getByRole('textbox', { name: 'Describe con detalle lo que' }).click();
  await page.getByRole('textbox', { name: 'Describe con detalle lo que' }).fill('La luz se ha ido');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByText('Trabajadores').click();
  await page.getByRole('textbox', { name: 'Describe con detalle lo que' }).click();
  await page.getByRole('textbox', { name: 'Describe con detalle lo que' }).fill('El portero no hace su trabajo');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.waitForLoadState('networkidle');
  });

  test('Presidente actualiza estados', async ({ page }) => {
   await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('presidente@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Incidencias').click();
  await page.getByText('Trabajadores').click();
  await page.getByText('En proceso').nth(1).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByText('Trabajadores').first().click();
  await page.getByText('Resuelta').nth(2).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByText('Electricidad').click();
  await page.locator('div').filter({ hasText: /^Rechazada$/ }).first().click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  });

  test('Propietario borra incidencias', async ({ page }) => {
  await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('propietario@prueba.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.getByText('Incidencias').click();
  await page.getByText('Mis incidencias').click();
  await page.getByText('Electricidad').click();
  await page.getByRole('button', { name: 'Eliminar incidencia' }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByText('Trabajadores').click();
  await page.getByRole('button', { name: 'Eliminar incidencia' }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  });
});