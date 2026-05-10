export type CommunityBlockedCode = 'community_blocked' | 'community_no_subscription';


export type CommunityBlockedDetail = {
  code: CommunityBlockedCode;
  reason: string;
  message: string;
  association_id: string;
  since?: string | null;
};

export type PlanCode = 'basic' | 'premium';

export type RegistrationOrderStatus =
  | 'pending'
  | 'redirect_created'
  | 'authorised'
  | 'completed'
  | 'failed'
  | 'subscription_failed';

export type RegistrationOrderCreate = {
  community_name: string;
  community_address: string;
  plan: PlanCode;
  household_count: number;
};

export type RegistrationPaymentOrderResponse = {
  id: string;
  email: string;
  username: string;
  community_name: string;
  community_address: string;
  amount_cents: number;
  currency: string;
  status: RegistrationOrderStatus | string;
  authorisation_url: string | null;
  billing_request_id: string | null;
  billing_request_flow_id: string | null;
  mandate_id: string | null;
  payment_id: string | null;
  created_profile_id: string | null;
  created_association_id: string | null;
  granted_role: number;
  granted_role_label: string;
  token: string | null;
  plan_code: PlanCode | null;
  subscription_plan_id: string | null;
  household_count: number;
  created_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};


export type SubscriptionStatusValue =
  | 'active'
  | 'pending_first_payment'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'mandate_invalid';

export type MandateStatus =
  | 'pending_submission'
  | 'pending_customer_approval'
  | 'submitted'
  | 'active'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'consumed';

export type InvoiceStatus =
  | 'pending_submission'
  | 'submitted'
  | 'confirmed'
  | 'paid_out'
  | 'failed'
  | 'cancelled'
  | 'charged_back';

export type SubscriptionPlanSummary = {
  code: PlanCode;
  display_name: string;
  base_cents: number;
  per_household_cents: number;
  minutes_seconds_per_month: number;
  minutes_seconds_cap: number;
  chatbot_base_msg: number;
  chatbot_per_household_msg: number;
  chatbot_input_chars: number;
  chatbot_output_chars: number;
};

export type SubscriptionInvoice = {
  id: string;
  gocardless_payment_id: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus | string;
  failure_reason: string | null;
  charge_date: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionStatusResponse = {
  id: string;
  association_id: string;
  status: SubscriptionStatusValue | string;
  is_blocked: boolean;
  plan: SubscriptionPlanSummary | null;
  current_amount_cents: number | null;
  household_count: number | null;
  current_household_count: number;
  mandate_status: MandateStatus | string | null;
  gocardless_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  cancelled_at: string | null;
  invoices: SubscriptionInvoice[];
};

export type SubscriptionUsageResponse = {
  association_id: string;
  subscription_id: string;
  subscription_status: SubscriptionStatusValue | string;
  chatbot: {
    used: number;
    quota: number;
    remaining: number;
  };
  minutes: {
    used_seconds: number;
    balance_seconds: number;
    remaining_seconds: number;
    cap_seconds: number;
  };
  period_started_at: string | null;
  period_ends_at: string | null;
  last_reset_at: string | null;
};

export type RetryPaymentResponse = {
  ok: boolean;
  message: string;
  payment_id: string;
  invoice_id: string;
  gocardless_payment_status: string | null;
};

export type RenewSubscriptionResponse = {
  checkout_url: string;
};
