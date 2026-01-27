/**
 * Application constants
 */

import Constants from 'expo-constants';

// Get environment variables from Expo Constants
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return Constants.expoConfig?.extra?.[key] || process.env[key] || defaultValue;
};

export const SOCKET_SERVER_URL = getEnvVar('EXPO_PUBLIC_SOCKET_SERVER_URL', 'http://localhost:3000');
export const SUPABASE_URL = getEnvVar('EXPO_PUBLIC_SUPABASE_URL', '');
export const SUPABASE_ANON_KEY = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
export const ELEVENLABS_API_KEY = getEnvVar('EXPO_PUBLIC_ELEVENLABS_API_KEY', '');
export const ELEVENLABS_VOICE_ID = getEnvVar('EXPO_PUBLIC_ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'); // Default voice

export const APP_NAME = 'ONE Platform';
export const APP_VERSION = '1.0.0';

// Session management
export const SESSION_STORAGE_KEY = 'one_session_id';
export const USER_STORAGE_KEY = 'one_user_id';

