import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/auth.types';
import { Platform } from 'react-native';
import { MinutesReadResponse } from '@/types/minutes.types';


const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'user_data';
const COMMUNITY_KEY = 'community_data';
const SELECTED_MINUTE_KEY = 'selected_minute_data';

export const storageService = {
  saveToken: async (token: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  },
  getToken: async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
  },
  removeToken: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },

  saveUser: async (user: User): Promise<void> => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: async (): Promise<User | null> => {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  removeUser: async (): Promise<void> => {
    await AsyncStorage.removeItem(USER_KEY);
  },

  saveActiveCommunity: async (community: { id: string; name: string; role: string }): Promise<void> => {
    await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(community));
  },
  getActiveCommunity: async (): Promise<{ id: string; name: string; role: string } | null> => {
    const data = await AsyncStorage.getItem(COMMUNITY_KEY);
    return data ? JSON.parse(data) : null;
  },
  removeActiveCommunity: async (): Promise<void> => {
    await AsyncStorage.removeItem(COMMUNITY_KEY);
  },

  saveSelectedMinute: async (minute: MinutesReadResponse): Promise<void> => {
    await AsyncStorage.setItem(SELECTED_MINUTE_KEY, JSON.stringify(minute));
  },
  getSelectedMinute: async (): Promise<MinutesReadResponse | null> => {
    const data = await AsyncStorage.getItem(SELECTED_MINUTE_KEY);
    return data ? JSON.parse(data) : null;
  },
  removeSelectedMinute: async (): Promise<void> => {
    await AsyncStorage.removeItem(SELECTED_MINUTE_KEY);
  },


  clearAll: async (): Promise<void> => {
    await storageService.removeToken();
    await storageService.removeUser();
    await storageService.removeActiveCommunity();
    await storageService.removeSelectedMinute();
  },
};