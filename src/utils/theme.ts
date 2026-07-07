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
  /** Orb face fill. */
  circle: string;
  /** Orb eye fill — separate from the page background so the eyes can stay
   *  high-contrast even when the face and background are both dark. */
  circleEye: string;
  /** Resting fill for a control that's ALWAYS a circle but currently OFF
   *  (e.g. the call-mode speaker/mic/camera buttons inside the input
   *  capsule). A subtle neutral that reads against the capsule surface so
   *  the button is visible even when inactive. */
  callCtrlRest: string;
}

const lightColors: ThemeColors = {
  // Slightly off-white so pure-white surfaces (input capsule, cards) read as
  // floating above the page rather than disappearing into it.
  background: '#F5F4F0',
  surface: '#FFFFFF',
  text: '#0A0A0A',
  textSecondary: '#5B5B5B',
  border: 'rgba(10, 10, 10, 0.08)',
  primary: '#007AFF',
  circle: '#0A0A0A',     // dark face on the off-white page
  circleEye: '#F5F4F0',  // matches the page so eyes "cut out" of the face
  callCtrlRest: 'rgba(10, 10, 10, 0.06)', // subtle gray on the white capsule
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#333333',
  primary: '#0a84ff',
  // Keep the face DARK (charcoal) in dark mode — a stark-white orb on a dark
  // page reads inverted and uncanny. A lifted charcoal pops just enough off
  // the background and lets the white eyes do the personality work.
  circle: '#2A2A2A',
  circleEye: '#FFFFFF',
  callCtrlRest: 'rgba(255, 255, 255, 0.10)', // subtle light fill on the dark capsule
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

