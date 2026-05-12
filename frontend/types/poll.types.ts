export enum PollStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  MANUALLY_CLOSED = 'MANUALLY_CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum PollCurrentStatusEnum {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  WAITING_ABSENTEES = 'WAITING_ABSENTEES',
  FINISHED = 'FINISHED',
  DRAFT = 'DRAFT',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

export type PollStatus = `${PollStatusEnum}`;
export type PollCurrentStatus = `${PollCurrentStatusEnum}`;

export interface Poll {
  id: string;
  association_id: string;
  created_by: string;
  title: string;
  description: string | null;
  options: string[];
  status: PollStatus;
  current_status: PollCurrentStatus;
  created_at: string;
  start_at: string | null;
  end_at: string | null;
  absentees_end_at: string | null;
}

export interface PollCreateRequest {
  title: string;
  description?: string | null;
  options: string[];
}

export interface PollUpdateRequest {
  title?: string;
  description?: string | null;
  options?: string[];
}

export interface PollPublishRequest {
  start_at: string;
  end_at: string;
  absentees_end_at: string;
  status?: string;
}

export interface PollReadResponse extends Poll {}

export interface Property {
  id: string;
  association_id: string;
  number: string;
  coefficient: number;
  quota_percentage: number;
  is_in_arrears: boolean;
}

export interface PropertyUpdateRequest {
  coefficient?: number;
  is_defaulter?: boolean;
}

export interface PropertyReadResponse {
  id: string;
  association_id: string;
  number: string;
  coefficient: number;
  is_defaulter: boolean;
}

export interface VoteCreatePayload {
  selected_option: string;
  voting_token: string;
  rgpd_accepted: boolean;
}

export interface VoteResponse {
  id: string;
  poll_id: string;
  membership_id: string;
  selected_option: string;
  coefficient_snapshot: number;
  is_presumed_vote: boolean;
  rgpd_accepted_at: string;
  created_at: string;
}

export interface OptionResult {
  option_text: string;
  count: number;
  quota_sum: number;
  total_votes_count: number;
  total_coefficient: number;
}

export interface PollResultResponse {
  poll_id: string;
  census_eligible_voters: number;
  census_eligible_coefficient: number;
  total_votes_cast: number;
  presumed_votes_applied: number;
  results: OptionResult[];
  voters_list: VoterDetail[];
}

export interface VoterDetail {
  property_number: string;
  voted_for: string;
  coefficient: number;
  is_presumed: boolean;
}

export interface MembershipInfoResponse {
  coefficient: number;
  is_defaulter: boolean;
}

export interface HasVotedResponse {
  has_voted: boolean;
}

export interface RequestAuthTokenResponse {
  message: string;
  email: string;
}