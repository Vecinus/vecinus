import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentsApi } from '@/api/payments';
import type {
  RenewSubscriptionResponse,
  RetryPaymentResponse,
  SubscriptionStatusResponse,
  SubscriptionUsageResponse,
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
} from '@/types/payments.types';


const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_SECONDS = 30 * 1000;

export const subscriptionKeys = {
  all: ['subscription'] as const,
  status: (communityId: string | undefined) =>
    [...subscriptionKeys.all, 'status', communityId] as const,
  usage: (communityId: string | undefined) =>
    [...subscriptionKeys.all, 'usage', communityId] as const,
};

export const useSubscriptionStatus = (
  communityId: string | undefined,
  enabled: boolean = true,
) => {
  return useQuery<SubscriptionStatusResponse, Error>({
    queryKey: subscriptionKeys.status(communityId),
    queryFn: () => paymentsApi.getSubscriptionStatus(communityId as string),
    enabled: !!communityId && enabled,
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
};

export const useSubscriptionUsage = (
  communityId: string | undefined,
  enabled: boolean = true,
) => {
  return useQuery<SubscriptionUsageResponse, Error>({
    queryKey: subscriptionKeys.usage(communityId),
    queryFn: () => paymentsApi.getSubscriptionUsage(communityId as string),
    enabled: !!communityId && enabled,
    staleTime: THIRTY_SECONDS,
    retry: 1,
  });
};

export const useRetryPayment = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<RetryPaymentResponse, Error, void>({
    mutationFn: () => paymentsApi.retryFailedPayment(communityId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionKeys.status(communityId),
      });
    },
  });
};

export const useRenewSubscription = (communityId: string | undefined) => {
  return useMutation<RenewSubscriptionResponse, Error, void>({
    mutationFn: () => paymentsApi.renewSubscription(communityId as string),
  });
};

export const useUpdateSubscription = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<UpdateSubscriptionResponse, Error, UpdateSubscriptionRequest>({
    mutationFn: (payload) => paymentsApi.updateSubscription(communityId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionKeys.status(communityId),
      });
      void queryClient.invalidateQueries({
        queryKey: subscriptionKeys.usage(communityId),
      });
    },
  });
};
