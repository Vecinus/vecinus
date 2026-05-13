type ValidationErrorItem = {
  msg?: unknown;
  message?: unknown;
};

type ErrorResponseData = {
  detail?: unknown;
  message?: unknown;
};

type ErrorWithResponse = {
  response?: {
    data?: ErrorResponseData;
    status?: number;
  };
  message?: unknown;
};

const KNOWN_ERROR_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Input should be less than or equal to 10000': 'El número de viviendas debe ser como máximo 10000.',
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function translateKnownErrorMessage(value: string): string {
  return KNOWN_ERROR_MESSAGE_TRANSLATIONS[value] ?? value;
}

function extractFromObject(detail: Record<string, unknown>): string {
  const message = translateKnownErrorMessage(normalizeString(detail.message));
  if (message) {
    return message;
  }

  const msg = translateKnownErrorMessage(normalizeString(detail.msg));
  if (msg) {
    return msg;
  }

  return '';
}

export function extractErrorMessage(detail: unknown): string {
  const directMessage = translateKnownErrorMessage(normalizeString(detail));
  if (directMessage) {
    return directMessage;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object') {
          return extractFromObject(item as ValidationErrorItem as Record<string, unknown>);
        }

        return normalizeString(item);
      })
      .filter(Boolean)
      .join(' ');
  }

  if (detail && typeof detail === 'object') {
    return extractFromObject(detail as Record<string, unknown>);
  }

  return '';
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as ErrorWithResponse;
  const detailMessage = extractErrorMessage(candidate.response?.data?.detail);
  if (detailMessage) {
    return detailMessage;
  }

  const dataMessage = translateKnownErrorMessage(normalizeString(candidate.response?.data?.message));
  if (dataMessage) {
    return dataMessage;
  }

  const errorMessage = translateKnownErrorMessage(normalizeString(candidate.message));
  if (errorMessage) {
    return errorMessage;
  }

  return fallback;
}
