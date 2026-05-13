export const MIN_HOUSEHOLD_COUNT = 1;
export const MAX_HOUSEHOLD_COUNT = 10000;

export const HOUSEHOLD_COUNT_ERROR_MESSAGE = `El nº de viviendas debe estar entre ${MIN_HOUSEHOLD_COUNT} y ${MAX_HOUSEHOLD_COUNT}.`;

export function getHouseholdCountError(value: number): string | null {
  if (value < MIN_HOUSEHOLD_COUNT || value > MAX_HOUSEHOLD_COUNT) {
    return HOUSEHOLD_COUNT_ERROR_MESSAGE;
  }

  return null;
}
