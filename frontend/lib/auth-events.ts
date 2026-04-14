type UnauthorizedHandler = (() => void | Promise<void>) | null;

let unauthorizedHandler: UnauthorizedHandler = null;
let isHandlingUnauthorized = false;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  unauthorizedHandler = handler;
};

export const notifyUnauthorized = async () => {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;
  try {
    await unauthorizedHandler?.();
  } finally {
    isHandlingUnauthorized = false;
  }
};
