declare const require: any;
declare const process: { cwd(): string };

const fs = require('fs');
const path = require('path');
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const baseUrl = 'http://localhost:8081';
const backendUrl = 'http://localhost:8000';
const invitedUserEmail = 'vecino3@prueba.com';
const envPath = path.resolve(process.cwd(), '../backend/.env');

function readEnvValue(key: string) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const line = envContent
    .split(/\r?\n/)
    .find((entry: string) => entry.trim().startsWith(`${key}=`) && !entry.trim().startsWith('#'));

  if (!line) {
    throw new Error(`No se encontró ${key} en backend/.env`);
  }

  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

async function login(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
  preferredCommunityName?: string,
) {
  const supabaseUrl = readEnvValue('SUPABASE_URL');
  const supabaseKey = readEnvValue('SUPABASE_KEY');

  const authResponse = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });

  if (!authResponse.ok()) {
    throw new Error(`Login directo con Supabase falló para ${email}: ${authResponse.status()}`);
  }

  const authData = await authResponse.json();
  const token = authData.access_token as string | undefined;

  if (!token) {
    throw new Error(`Supabase no devolvió access_token para ${email}`);
  }

  const [profileResponse, communitiesResponse] = await Promise.all([
    request.get(`${backendUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    request.get(`${backendUrl}/users/me/communities`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!profileResponse.ok() || !communitiesResponse.ok()) {
    throw new Error(`No se pudo hidratar el usuario ${email} desde el backend`);
  }

  const profile = await profileResponse.json();
  const communities = await communitiesResponse.json();
  const memberships = communities.map((membership: any) => ({
    community: {
      id: membership.neighborhood_associations.id,
      name: membership.neighborhood_associations.name,
      address: membership.neighborhood_associations.address ?? null,
    },
    role: membership.role,
  }));

  const user = {
    id: profile.id,
    name: profile.username,
    email: profile.email,
    CommunitiesAndRole: memberships,
  };

  const selectedMembership =
    memberships.find((membership: any) => membership.community.name === preferredCommunityName) ??
    memberships[0];

  const activeCommunity = selectedMembership
    ? {
        id: selectedMembership.community.id,
        name: selectedMembership.community.name,
        role: selectedMembership.role,
        address: selectedMembership.community.address ?? null,
      }
    : null;

  await page.goto(`${baseUrl}/sign-in`);
  await page.evaluate(
    ({ storedToken, storedUser, storedCommunity }) => {
      window.localStorage.clear();
      window.localStorage.setItem('jwt_token', storedToken);
      window.localStorage.setItem('user_data', JSON.stringify(storedUser));
      if (storedCommunity) {
        window.localStorage.setItem('community_data', JSON.stringify(storedCommunity));
      }
    },
    {
      storedToken: token,
      storedUser: user,
      storedCommunity: activeCommunity,
    },
  );
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Show navigation menu' })).toBeVisible();

  return user;
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
}

async function logout(page: Page) {
  await page.goto(baseUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${baseUrl}/sign-in`);
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
}

async function goToCommunityAdmin(page: Page) {
  await openDrawer(page);
  await page.getByText('Comunidad', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comunidad' })).toBeVisible();
  await expect(page.getByText('Listado de vecinos')).toBeVisible({ timeout: 20000 });
}

async function goToInvitations(page: Page) {
  await openDrawer(page);
  await page.getByText('Invitaciones', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Invitaciones' })).toBeVisible();
}

async function switchActiveCommunity(
  page: Page,
  currentCommunity: string,
  targetCommunity: string,
) {
  await openDrawer(page);
  await page.getByRole('button', { name: currentCommunity }).click();
  await page.getByRole('option', { name: targetCommunity }).click();
  await page.waitForLoadState('networkidle');
}

test.describe.serial('Community invitations flow', () => {
  test('admin invita a un vecino, este acepta y luego es expulsado', async ({ page, request }) => {
    test.setTimeout(120000);

    await login(page, request, 'admin@prueba.com', 'prueba', 'Comunidad Mirador Verde');
    await goToCommunityAdmin(page);

    const inviteDialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Invitar Vecino' }).click();
    await inviteDialog.getByRole('textbox', { name: 'ejemplo@correo.com' }).fill(invitedUserEmail);
    await inviteDialog.getByText('Propietario', { exact: true }).click();
    await inviteDialog.getByText(/^(3A|Puerta 2F|###)$/).first().click();
    await inviteDialog.getByRole('button', { name: 'Enviar' }).click();

    const duplicateInvitationError = inviteDialog.getByText(
      /Este correo ya tiene una invitaci.n pendiente para esta comunidad/i,
    );

    try {
      await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
    } catch {
      await expect(duplicateInvitationError).toBeVisible();
      await inviteDialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
    }

    await expect(page.getByText(/Invitaciones Activas/i)).toBeVisible();
    await logout(page);

    const invitedUser = await login(page, request, invitedUserEmail, 'prueba', 'Edificio Marte');
    await goToInvitations(page);

    await expect(page.getByText(/Mirador Verde/i)).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByText('0 invitaciones pendientes')).toBeVisible({ timeout: 20000 });

    await switchActiveCommunity(page, 'Edificio Marte', 'Comunidad Mirador Verde');
    await goToInvitations(page);
    await expect(page.getByText(/Sin invitaciones/i)).toBeVisible();
    await logout(page);

    await login(page, request, 'admin@prueba.com', 'prueba', 'Comunidad Mirador Verde');
    await goToCommunityAdmin(page);

    const invitedMemberName = page.getByText(invitedUser.name, { exact: true });
    const invitedMemberDeleteTrigger = invitedMemberName.locator(
      'xpath=ancestor::div[1]/following-sibling::*[1]',
    );
    await expect(invitedMemberName).toBeVisible();
    await invitedMemberDeleteTrigger.click();
    await page.getByRole('button', { name: 'Expulsar' }).click();
    await expect(page.getByText('8 miembros')).toBeVisible({ timeout: 20000 });
    await logout(page);

    await login(page, request, invitedUserEmail, 'prueba', 'Edificio Marte');
    await openDrawer(page);
    await page.getByRole('button', { name: 'Edificio Marte' }).click();
    await expect(page.getByRole('option', { name: 'Comunidad Mirador Verde' })).not.toBeVisible();
  });
});
