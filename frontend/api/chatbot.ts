import { apiClient } from '@/api/client';
import type {
  ChatbotRequest,
  ChatbotResponse,
  DeleteDocumentResponse,
  DocumentsListResponse,
  UploadDocumentPayload,
  UploadDocumentResponse,
} from '@/types/chatbot.types';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import axios from 'axios';

const chatbotKeys = {
  documents: (communityId: string) => ['chatbot', 'documents', communityId] as const,
};

interface ErrorPayload {
  detail?: string;
  message?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorPayload>(error)) {
    return error.response?.data?.detail ?? error.response?.data?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

async function fetchCommunityDocuments(communityId: string): Promise<string[]> {
  const response = await apiClient.get<DocumentsListResponse>(
    `/comunities/${communityId}/documents`
  );
  return response.data.documents;
}

async function sendCommunityQuestion({
  communityId,
  question,
}: {
  communityId: string;
  question: string;
}): Promise<ChatbotResponse> {
  const payload: ChatbotRequest = {
    comunidad_id: communityId,
    question,
  };

  const response = await apiClient.post<ChatbotResponse>(
    `/comunities/${communityId}/chatbot`,
    payload
  );
  return response.data;
}

async function uploadCommunityDocument(
  payload: UploadDocumentPayload
): Promise<UploadDocumentResponse> {
  const { communityId } = payload;

  if ('file' in payload) {
    const formData = new FormData();

    if (payload.file.kind === 'web') {
      formData.append('file', payload.file.blob, payload.file.name);
    } else {
      formData.append('file', {
        uri: payload.file.uri,
        name: payload.file.name,
        type: payload.file.mimeType,
      } as unknown as Blob);
    }

    const response = await apiClient.post<UploadDocumentResponse>(
      `/comunities/${communityId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  const response = await apiClient.post<UploadDocumentResponse>(
    `/comunities/${communityId}/documents`,
    {
      title: payload.title,
      content: payload.content,
    }
  );

  return response.data;
}

async function deleteCommunityDocument({
  communityId,
  documentTitle,
}: {
  communityId: string;
  documentTitle: string;
}): Promise<DeleteDocumentResponse> {
  const response = await apiClient.delete<DeleteDocumentResponse>(
    `/comunities/${communityId}/documents`,
    {
      params: {
        document_title: documentTitle,
      },
    }
  );

  return response.data;
}

export function useCommunityDocumentsQuery({
  communityId,
  enabled,
}: {
  communityId: string;
  enabled: boolean;
}): UseQueryResult<string[], Error> {
  return useQuery<string[], Error>({
    queryKey: chatbotKeys.documents(communityId),
    queryFn: () => fetchCommunityDocuments(communityId),
    enabled,
  });
}

export function useSendCommunityQuestionMutation(): UseMutationResult<
  ChatbotResponse,
  Error,
  { communityId: string; question: string }
> {
  return useMutation({
    mutationFn: sendCommunityQuestion,
  });
}

export function useUploadCommunityDocumentMutation(): UseMutationResult<
  UploadDocumentResponse,
  Error,
  UploadDocumentPayload
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadCommunityDocument,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: chatbotKeys.documents(variables.communityId),
      });
    },
  });
}

export function useDeleteCommunityDocumentMutation(): UseMutationResult<
  DeleteDocumentResponse,
  Error,
  { communityId: string; documentTitle: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCommunityDocument,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: chatbotKeys.documents(variables.communityId),
      });
    },
  });
}

export { getErrorMessage };
