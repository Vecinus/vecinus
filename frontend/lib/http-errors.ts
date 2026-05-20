import { isAxiosError } from 'axios';

export const isForbiddenError = (error: unknown): boolean => {
  return isAxiosError(error) && error.response?.status === 403;
};
