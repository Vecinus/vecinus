type ValidationErrorItem = {
  msg?: unknown;
  message?: unknown;
  loc?: unknown;
  type?: unknown;
  ctx?: unknown;
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
  'Input should be less than or equal to 10000': 'El valor debe ser como maximo 10000.',
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function translateKnownErrorMessage(value: string): string {
  return KNOWN_ERROR_MESSAGE_TRANSLATIONS[value] ?? value;
}

function getValidationPath(detail: Record<string, unknown>): string {
  const loc = detail.loc;
  if (Array.isArray(loc)) {
    return loc.map(String).join('.');
  }

  return '';
}

function getValidationLimit(detail: Record<string, unknown>): number {
  const ctx = detail.ctx && typeof detail.ctx === 'object'
    ? (detail.ctx as Record<string, unknown>)
    : {};
  return Number(ctx.le ?? ctx.max_length ?? Number.NaN);
}

function translateValidationError(detail: Record<string, unknown>): string {
  const path = getValidationPath(detail);
  const msg = normalizeString(detail.msg);
  const type = normalizeString(detail.type);
  const limit = getValidationLimit(detail);

  if (path.includes('capacity') && (limit === 10000 || msg.includes('10000'))) {
    return 'La capacidad maxima no puede superar las 10.000 personas.';
  }

  if (path.includes('max_guests_per_reservation') && (limit === 10000 || msg.includes('10000'))) {
    return 'El maximo de invitados por reserva no puede superar 10.000 personas.';
  }

  if (path.includes('household_count') && (limit === 10000 || msg.includes('10000'))) {
    return 'El numero de viviendas debe ser como maximo 10000.';
  }

  if (type === 'int_parsing_size') {
    return 'El numero introducido es demasiado grande.';
  }

  return '';
}

function extractFromObject(detail: Record<string, unknown>): string {
  const validationMessage = translateValidationError(detail);
  if (validationMessage) {
    return validationMessage;
  }

  const message = translateKnownErrorMessage(normalizeString(detail.message));
  if (message) {
    return message;
  }

  const msg = translateKnownErrorMessage(normalizeString(detail.msg));
  if (msg) {
    return msg;
  }

  const nestedDetail = extractErrorMessage(detail.detail);
  if (nestedDetail) {
    return nestedDetail;
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
