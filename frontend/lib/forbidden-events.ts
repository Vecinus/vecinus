type ForbiddenHandler = (() => void | Promise<void>) | null;

let forbiddenHandler: ForbiddenHandler = null;
let isHandlingForbidden = false;

export const setForbiddenHandler = (handler: ForbiddenHandler) => {
  forbiddenHandler = handler;
};

export const notifyForbidden = async () => {
  if (isHandlingForbidden) return;

  isHandlingForbidden = true;
  try {
    await forbiddenHandler?.();
  } finally {
    isHandlingForbidden = false;
  }
};
