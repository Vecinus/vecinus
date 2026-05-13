import { test, expect } from '@playwright/test';

test.describe.serial('Announcements workflow', () => {
  test('Presidente crea y borra anuncio', async ({ page }) => {
    await page.goto('http://localhost:8081/sign-in');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('presidente@prueba.com');
    await page.getByRole('textbox', { name: 'Contraseña' }).click();
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
    await page.getByRole('button', { name: 'Continuar' }).click();
    
    await page.getByRole('button', { name: 'Show navigation menu' }).click();
    await page.getByText('Tablón de Anuncios').click();
    
    // Create new announcement
    await page.getByText('Nuevo').click();
    
    await page.getByPlaceholder('Ej: Reunión anual de vecinos...').click();
    await page.getByPlaceholder('Ej: Reunión anual de vecinos...').fill('Anuncio de prueba e2e');
    
    await page.getByPlaceholder('Detalla el anuncio aquí...').click();
    await page.getByPlaceholder('Detalla el anuncio aquí...').fill('Contenido del anuncio e2e');
    
    await page.getByRole('button', { name: 'Guardar' }).click();
    
    await page.waitForLoadState('networkidle');
    // Wait for modal "Anuncio Creado"
    await page.getByRole('button', { name: 'Aceptar' }).click();
    
    // Verify it exists
    await expect(page.getByText('Anuncio de prueba e2e')).toBeVisible();

    // Now delete it
    // Using the accessibility label we just added
    await page.getByRole('button', { name: 'Eliminar anuncio' }).first().click();
    
    // Confirm delete
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.waitForLoadState('networkidle');
  });

  test('Propietario solo puede ver anuncios', async ({ page }) => {
    await page.goto('http://localhost:8081/sign-in');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('propietario@prueba.com');
    await page.getByRole('textbox', { name: 'Contraseña' }).click();
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('prueba');
    await page.getByRole('button', { name: 'Continuar' }).click();
    
    await page.getByRole('button', { name: 'Show navigation menu' }).click();
    await page.getByText('Tablón de Anuncios').click();
    
    // User should not see 'Nuevo' button
    await expect(page.getByText('Nuevo')).toBeHidden();
  });
});
