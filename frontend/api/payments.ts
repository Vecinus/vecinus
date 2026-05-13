import { apiClient } from './client';
import type {
  CancelSubscriptionResponse,
  RegistrationOrderCreate,
  RegistrationPaymentOrderResponse,
  RenewSubscriptionResponse,
  RetryPaymentResponse,
  SubscriptionActivationOrderCreate,
  SubscriptionStatusResponse,
  SubscriptionUsageResponse,
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
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
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/registration/gocardless/orders/${encodeURIComponent(orderId)}/complete`,
    );
    return data;
  },

  createSubscriptionActivationOrder: async (
    communityId: string,
    body: SubscriptionActivationOrderCreate,
  ): Promise<RegistrationPaymentOrderResponse> => {
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/activation-orders`,
      body,
    );
    return data;
  },

  completeSubscriptionActivationOrder: async (
    orderId: string,
  ): Promise<RegistrationPaymentOrderResponse> => {
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/payments/subscriptions/activation-orders/${encodeURIComponent(orderId)}/complete`,
    );
    return data;
  },

  createSubscriptionReactivationOrder: async (
    communityId: string,
    body: SubscriptionActivationOrderCreate,
  ): Promise<RegistrationPaymentOrderResponse> => {
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/reactivation-orders`,
      body,
    );
    return data;
  },

  completeSubscriptionReactivationOrder: async (
    orderId: string,
  ): Promise<RegistrationPaymentOrderResponse> => {
    const { data } = await apiClient.post<RegistrationPaymentOrderResponse>(
      `/payments/subscriptions/reactivation-orders/${encodeURIComponent(orderId)}/complete`,
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

  cancelSubscription: async (communityId: string): Promise<CancelSubscriptionResponse> => {
    const { data } = await apiClient.post<CancelSubscriptionResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}/cancel`,
    );
    return data;
  },

  updateSubscription: async (
    communityId: string,
    body: UpdateSubscriptionRequest,
  ): Promise<UpdateSubscriptionResponse> => {
    const { data } = await apiClient.patch<UpdateSubscriptionResponse>(
      `/payments/subscriptions/${encodeURIComponent(communityId)}`,
      body,
    );
    return data;
  },
};
