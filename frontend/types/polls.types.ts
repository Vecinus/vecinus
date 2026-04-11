export enum PollStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  MANUALLY_CLOSED = 'MANUALLY_CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum PollCurrentStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  WAITING_ABSENTEES = 'WAITING_ABSENTEES',
  FINISHED = 'FINISHED',
  UNKNOWN = 'UNKNOWN',
}

export interface Poll {
  id: string;
  association_id: string;
  created_by: string;
  title: string;
  description?: string;
  options: string[];
  status: PollStatus;
  db_status?: PollStatus;
  start_at?: string;
  end_at?: string;
  absentees_end_at?: string;
  created_at: string;
  current_status?: PollCurrentStatus;
}

export interface PollListItem extends Poll {
  voters_count?: number;
}

export interface Option {
  text: string;
}

export interface VoteCreate {
  selected_option: string;
  voting_token: string;
  rgpd_accepted: boolean;
}

export interface Vote {
  id: string;
  poll_id: string;
  membership_id: string;
  selected_option: string;
  coefficient_snapshot: number;
  is_presumed_vote: boolean;
  rgpd_accepted_at: string;
  created_at: string;
}

export interface VotingToken {
  token: string;
  poll_id: string;
  membership_id: string;
  is_used: boolean;
  expires_at: string;
}

export interface OptionResult {
  option_text: string;
  total_votes_count: number;
  total_coefficient: number;
}

export interface VoterDetail {
  property_number: string;
  voted_for: string;
  coefficient: number;
  is_presumed: boolean;
}

export interface PollResults {
  poll_id: string;
  census_eligible_voters: number;
  census_eligible_coefficient: number;
  total_votes_cast: number;
  presumed_votes_applied: number;
  results: OptionResult[];
  voters_list: VoterDetail[];
}

export interface CreatePollPayload {
  title: string;
  description?: string;
  options: string[];
  defaulter_properties?: string[];
  start_at?: string;
  end_at: string;
  absentees_end_at: string;
}

export interface EditPollPayload {
  title?: string;
  description?: string;
  options?: string[];
  defaulter_properties?: string[];
  start_at?: string;
  end_at?: string;
  absentees_end_at?: string;
}

export interface PollProperty {
  id: string;
  association_id: string;
  number: string;
  coefficient: number;
  is_defaulter: boolean;
}

export interface PollPublish {
  start_at: string;
  end_at: string;
  absentees_end_at: string;
  status?: string;
}

export interface PendingInvitation {
  id: string;
  target_email: string;
  role_to_grant: number;
  created_at: string;
  property_id?: string;
}

export interface AvailableProperty {
  id: string;
  number: string;
  coefficient?: number;
  is_defaulter?: boolean;
}
