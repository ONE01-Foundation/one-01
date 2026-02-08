/**
 * Theme System - Light/Dark theme with time-based detection
 */

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  circle: string; // Circle color (opposite of background)
}

const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e0e0e0',
  primary: '#007AFF',
  circle: '#000000', // Black circle on light background
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#333333',
  primary: '#0a84ff',
  circle: '#ffffff', // White circle on dark background
};

/**
 * Determine theme based on time of day
 * Dark mode: 6 PM (18:00) to 6 AM (06:00)
 * Light mode: 6 AM to 6 PM
 */
export function getThemeByTime(): Theme {
  const now = new Date();
  const hour = now.getHours();
  
  // Dark mode from 6 PM (18) to 6 AM (6)
  if (hour >= 18 || hour < 6) {
    return 'dark';
  }
  
  return 'light';
}

/**
 * Get theme colors based on theme
 */
export function getThemeColors(theme: Theme): ThemeColors {
  return theme === 'light' ? lightColors : darkColors;
}

/**
 * Resolve final theme based on preference and time
 */
export function resolveTheme(
  preference: 'auto' | 'light' | 'dark',
  currentTime?: Date
): Theme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  
  // 'auto' - use time-based detection
  return getThemeByTime();
}

