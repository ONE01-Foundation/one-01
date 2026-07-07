import type { ChatChromeKey, SettingsStringKey } from '../i18n/strings';

export const MAX_CONTENT_WIDTH = 428;
export const INACTIVITY_HIDE_MS = 3000;
export const UNIT_ORB_STATUS_BAR_IDLE_MS = 4000;
export const IDLE_CHROME_FADE_MS = 280;

export type ChatStatusPhase = 'agent' | 'thinking' | 'planning' | 'ready';

export const CHAT_PHASE_KEY: Record<ChatStatusPhase, ChatChromeKey> = {
  agent: 'chat_status_agent',
  thinking: 'chat_status_thinking',
  planning: 'chat_status_planning',
  ready: 'chat_status_ready',
};

export const CHAT_MENU_ROWS: { id: 'Share' | 'Profile' | 'History' | 'Settings'; labelKey: SettingsStringKey }[] = [
  { id: 'Share', labelKey: 'menu_share' },
  { id: 'Profile', labelKey: 'menu_profile' },
  { id: 'History', labelKey: 'menu_history' },
  { id: 'Settings', labelKey: 'menu_settings' },
];

export const UPGRADE_GOLD = '#e6bf3f';
export const UPGRADE_GOLD_ON = '#111111';

export const GLOBAL_WHEEL_ORB_ID = '__wheel_global__';
export const GLOBAL_ORB_INDEX = 0;
export const AGENT_ORB_INDEX = 1;

export const GLOBAL_PULL_ENTER_PX = 56;
export const GLOBAL_WHEEL_EARLY_OPEN_SCROLL_PX = 36;

export const ORB_SIZE_RATIO = 321 / 375;
export const SMALL_ORB_RATIO = 0.32;
export const WHEEL_ITEM_HEIGHT = 240;
export const SHOW_ORB_DEBUG_OUTLINE = true;
export const EMOJI_CIRCLE_BORDER_WIDTH = 0;
export const EMOJI_CIRCLE_BORDER_COLOR = 'transparent';
export const EMOJI_CIRCLE_LIGHT = '#000000';
export const EMOJI_CIRCLE_DARK = '#2a2a2a';
export const EMOJI_CIRCLE_SIZE = 72;
export const AGENT_CIRCLE_SIZE_OTHER_WORLDS = 56;
export const WHEEL_AGENT_FACE_BASE_TRANSLATE_Y = -10;
export const WHEEL_AGENT_FACE_EXTRA_LIFT_WHEN_CENTERED_PX = 30;
export const WHEEL_AGENT_CENTER_ORB_EXTRA_PX = 18;
export const WHEEL_AGENT_BROADCAST_PRIMARY_TITLE_OFFSET_Y = 0;
export const WHEEL_AGENT_BROADCAST_SUBTITLE_MARGIN_TOP = 8;
