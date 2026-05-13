import { apiClient } from '../client';
import { PropertyUpdateRequest, PropertyReadResponse } from '@/types/poll.types';

export const associationService = {
  getProperties: async (associationId: string): Promise<PropertyReadResponse[]> => {
    const response = await apiClient.get<PropertyReadResponse[]>(
      `/${associationId}/properties`
    );
    return response.data;
  },

  getVotingProperties: async (associationId: string): Promise<PropertyReadResponse[]> => {
    const response = await apiClient.get<PropertyReadResponse[]>(
      `/${associationId}/properties/eligible`
    );
    return response.data;
  },

  updateProperty: async (
    propertyId: string,
    data: PropertyUpdateRequest
  ): Promise<PropertyReadResponse> => {
    const response = await apiClient.patch<PropertyReadResponse>(
      `/properties/${propertyId}`,
      data
    );
    return response.data;
  },
};