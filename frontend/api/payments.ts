import { apiClient } from './client';
import type {
  RegistrationOrderCreate,
  RegistrationPaymentOrderResponse,
  RenewSubscriptionResponse,
  RetryPaymentResponse,
  SubscriptionStatusResponse,
  SubscriptionUsageResponse,
} from '@/types/payments.types';

export const paymentsApi = {
  createRegistrationOrder: async (
    body: RegistrationOrderCreate,
  ): Promise<RegistrationPaymentOrderResponse> => {
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      '/registration/gocardless/orders',
      body,
    );
    return data;
  },

  completeRegistrationOrder: async (
    orderId: string,
  ): Promise<RegistrationPaymentOrderResponse> => {
    // Sin body: el backend identifica al usuario por JWT (header Authorization
    // que el interceptor de axios añade) y verifica el mandato en GoCardless
    // a partir del order_id.
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/registration/gocardless/orders/${encodeURIComponent(orderId)}/complete`,
    );
    return data;
  },

  getSubscriptionStatus: async (communityId: string): Promise<SubscriptionStatusResponse> => {
    const { data } = await apiClient.get<SubscriptionStatusResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}`,
    );
    return data;
  },

  getSubscriptionUsage: async (communityId: string): Promise<SubscriptionUsageResponse> => {
    const { data } = await apiClient.get<SubscriptionUsageResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/usage`,
    );
    return data;
  },

  retryFailedPayment: async (communityId: string): Promise<RetryPaymentResponse> => {
    const { data } = await apiClient.post<RetryPaymentResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/retry`,
    );
    return data;
  },

  renewSubscription: async (communityId: string): Promise<RenewSubscriptionResponse> => {
    const { data } = await apiClient.post<RenewSubscriptionResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/renew`,
    );
    return data;
  },
};
