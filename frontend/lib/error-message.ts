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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractFromObject(detail: Record<string, unknown>): string {
  const message = normalizeString(detail.message);
  if (message) {
    return message;
  }

  const msg = normalizeString(detail.msg);
  if (msg) {
    return msg;
  }

  return '';
}

export function extractErrorMessage(detail: unknown): string {
  const directMessage = normalizeString(detail);
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

  const dataMessage = normalizeString(candidate.response?.data?.message);
  if (dataMessage) {
    return dataMessage;
  }

  const errorMessage = normalizeString(candidate.message);
  if (errorMessage) {
    return errorMessage;
  }

  return fallback;
}
