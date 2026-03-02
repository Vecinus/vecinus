import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri;
    
    if (debuggerHost) {
      const localIp = debuggerHost.split(':')[0];
      return `http://${localIp}:8000`; 
    }
    
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000';
    }
  }
  return 'http://localhost:8000';
};

export const API_URL = getBackendUrl();