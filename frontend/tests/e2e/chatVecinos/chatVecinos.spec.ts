declare const require: any;
declare const process: { cwd(): string };

const fs = require('fs');
const path = require('path');

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const baseUrl = 'http://localhost:8081';
const backendUrl = 'http://localhost:8000';
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

async function createSession(
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

  return { token, user, activeCommunity };
}

async function login(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
  preferredCommunityName?: string,
) {
  const session = await createSession(request, email, password, preferredCommunityName);

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
      storedToken: session.token,
      storedUser: session.user,
      storedCommunity: session.activeCommunity,
    },
  );
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Show navigation menu' })).toBeVisible();

  return session;
}

async function logout(page: Page) {
  await page.goto(baseUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${baseUrl}/sign-in`);
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
}

async function switchActiveCommunity(page: Page, currentCommunity: string, targetCommunity: string) {
  await openDrawer(page);
  await page.getByRole('button', { name: currentCommunity }).click();
  await page.getByRole('option', { name: targetCommunity }).click();
  await page.waitForLoadState('networkidle');
}

async function openCommunityChat(page: Page) {
  await openDrawer(page);
  await page.getByText('Chat vecinos', { exact: true }).click();
  await expect(page.getByText('Chat vecinal')).toBeVisible({ timeout: 20000 });
}

async function ensureCommunityChannel(request: APIRequestContext, token: string, associationId: string) {
  const channelsResponse = await request.get(`${backendUrl}/chat/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!channelsResponse.ok()) {
    throw new Error('No se pudieron obtener los canales del usuario');
  }

  const channels = await channelsResponse.json();
  const existingChannel = channels.find(
    (channel: any) =>
      channel.association_id === associationId && channel.is_direct_message === false,
  );

  if (existingChannel) {
    return existingChannel.id as string;
  }

  const createResponse = await request.post(`${backendUrl}/chat/channels`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      association_id: associationId,
      name: 'Comunidad',
      is_direct_message: false,
      is_blocked: false,
    },
  });

  if (!createResponse.ok()) {
    throw new Error('No se pudo crear el canal vecinal');
  }

  const createdChannel = await createResponse.json();
  return createdChannel.id as string;
}

async function sendMessageToChannel(
  request: APIRequestContext,
  token: string,
  channelId: string,
  content: string,
) {
  const response = await request.post(`${backendUrl}/chat/channels/${channelId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      channel_id: channelId,
      content,
    },
  });

  if (!response.ok()) {
    throw new Error('No se pudo enviar el mensaje al canal vecinal');
  }
}

async function findTestUsersInCommunity(request: APIRequestContext, targetCommunityName: string) {
  const candidates = [
    'vecino1@prueba.com',
    'vecino2@prueba.com',
    'vecino3@prueba.com',
    'propietario@prueba.com',
    'presidente@prueba.com',
    'empleado@prueba.com',
  ];

  const matchingUsers = [];

  for (const email of candidates) {
    try {
      const session = await createSession(request, email, 'prueba', targetCommunityName);
      if (session.activeCommunity?.name === targetCommunityName) {
        matchingUsers.push(email);
      }
    } catch {
      // Ignore non-existing or inaccessible test users.
    }
  }

  return matchingUsers;
}

test.describe.serial('Chat vecinos flow', () => {
  test('admin publica mensaje y otros vecinos pueden verlo', async ({ page, request }) => {
    test.setTimeout(120000);

    const uniqueMessage = `Hola, esto es una prueba del admin ${String(Date.now()).slice(-4)}`;
    const adminSession = await login(page, request, 'admin@prueba.com', 'prueba');

    if (!adminSession.activeCommunity?.id) {
      throw new Error('El admin no tiene comunidad activa');
    }

    const communityName = adminSession.activeCommunity.name;
    const matchingUsers = await findTestUsersInCommunity(request, communityName);

    if (matchingUsers.length === 0) {
      throw new Error(`No encontré usuarios de prueba en la comunidad ${communityName}`);
    }

    await openCommunityChat(page);
    const channelId = await ensureCommunityChannel(
      request,
      adminSession.token,
      adminSession.activeCommunity.id,
    );
    await sendMessageToChannel(request, adminSession.token, channelId, uniqueMessage);
    await page.reload();
    await expect(page.getByText('Chat vecinal')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(uniqueMessage)).toBeVisible({ timeout: 20000 });
    await logout(page);

    await login(page, request, matchingUsers[0], 'prueba', communityName);
    await openCommunityChat(page);
    await expect(page.getByText(uniqueMessage)).toBeVisible({ timeout: 20000 });
    await logout(page);

    if (matchingUsers[1]) {
      await login(page, request, matchingUsers[1], 'prueba', communityName);
      await openCommunityChat(page);
      await expect(page.getByText(uniqueMessage)).toBeVisible({ timeout: 20000 });
      await logout(page);
    }

    await login(page, request, 'admin@prueba.com', 'prueba', communityName);
    await openCommunityChat(page);
    await expect(page.getByText(uniqueMessage)).toBeVisible({ timeout: 20000 });
    await logout(page);
  });
});
