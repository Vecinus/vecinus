import type { CommunityBlockedDetail } from '@/types/payments.types';


type CommunityBlockedHandler = ((detail: CommunityBlockedDetail) => void | Promise<void>) | null;

let communityBlockedHandler: CommunityBlockedHandler = null;
let lastFiredAt = 0;
const COMMUNITY_BLOCKED_THROTTLE_MS = 1000;

export const setCommunityBlockedHandler = (handler: CommunityBlockedHandler) => {
  communityBlockedHandler = handler;
};

export const notifyCommunityBlocked = async (detail: CommunityBlockedDetail) => {
  const now = Date.now();
  if (now - lastFiredAt < COMMUNITY_BLOCKED_THROTTLE_MS) {
    // Notificación duplicada (otra request en paralelo devolvió 402): la
    // descartamos para no apilar modales ni relanzar el redirect.
    return;
  }
  lastFiredAt = now;
  await communityBlockedHandler?.(detail);
};

export const resetCommunityBlockedThrottle = () => {
  lastFiredAt = 0;
};
