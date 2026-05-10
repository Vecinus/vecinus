import { apiClient } from '@/api/client';
import axios from 'axios';

export interface CommunityChannel {
  id: string;
  association_id: string;
  name?: string | null;
  is_direct_message: boolean;
  is_blocked: boolean;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_edited?: boolean;
  sender?: {
    id: string;
    username: string;
    avatar_url?: string | null;
  } | null;
}

interface ErrorPayload {
  detail?: string | { message?: unknown; [key: string]: unknown };
  message?: string;
}

export function getChatErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorPayload>(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object' && 'message' in detail && detail.message != null) {
      return String(detail.message);
    }

    return error.response?.data?.message ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export async function fetchUserChannels(): Promise<CommunityChannel[]> {
  const response = await apiClient.get<CommunityChannel[]>('/chat/channels');
  return response.data;
}

export async function createCommunityChannel(communityId: string): Promise<CommunityChannel> {
  const response = await apiClient.post<CommunityChannel>('/chat/channels', {
    association_id: communityId,
    name: 'Comunidad',
    is_direct_message: false,
    is_blocked: false,
  });

  return response.data;
}

export async function fetchChannelMessages(channelId: string): Promise<ChannelMessage[]> {
  const response = await apiClient.get<ChannelMessage[]>(`/chat/channels/${channelId}/messages`);
  return response.data;
}

export async function sendChannelMessage({
  channelId,
  content,
}: {
  channelId: string;
  content: string;
}): Promise<ChannelMessage> {
  const response = await apiClient.post<ChannelMessage>(`/chat/channels/${channelId}/messages`, {
    channel_id: channelId,
    content,
  });

  return response.data;
}

export function buildChatWebSocketUrl(channelId: string): string {
  const baseUrl = apiClient.defaults.baseURL ?? '';
  return baseUrl.replace(/^http/i, 'ws').replace(/\/$/, '') + `/chat/ws/${channelId}`;
}
