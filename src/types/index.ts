/**
 * Core type definitions for ONE Platform
 * AI Agent Operating System
 */

// ============================================================================
// Lens System Types
// ============================================================================

export type LensCategory = 'health' | 'finance' | 'career' | 'home' | 'social';

export interface Lens {
  id: string;
  name: string;
  category: LensCategory;
  capabilities: string[];
  protocols: Protocol[];
  agents: SubAgent[];
  icon?: string;
  description?: string;
}

export interface SubAgent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  lensId: string;
}

// ============================================================================
// Protocol System Types
// ============================================================================

export interface Protocol {
  id: string;
  name: string;
  description: string;
  steps: ProtocolStep[];
  lensId: string;
  metadata?: Record<string, unknown>;
}

export interface ProtocolStep {
  id: string;
  order: number;
  type: 'action' | 'decision' | 'input' | 'display';
  component?: UIComponent;
  condition?: string;
  validation?: ValidationRule[];
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface UIComponent {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  children?: UIComponent[];
  style?: ComponentStyle;
  animation?: AnimationConfig;
}

export type ComponentType =
  | 'text'
  | 'button'
  | 'input'
  | 'card'
  | 'list'
  | 'chart'
  | 'form'
  | 'modal'
  | 'image'
  | 'video'
  | 'map'
  | 'calendar'
  | 'custom';

export interface ComponentStyle {
  backgroundColor?: string;
  color?: string;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  width?: number | string;
  height?: number | string;
  flex?: number;
  [key: string]: unknown;
}

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'scale' | 'rotate';
  duration?: number;
  delay?: number;
  easing?: string;
}

// ============================================================================
// Agent & Conversation Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  status: AgentStatus;
  activeLenses: string[];
  currentProtocol?: string;
  context: AgentContext;
}

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';

export interface AgentContext {
  userId: string;
  sessionId: string;
  goals: Goal[];
  history: ConversationMessage[];
  activeProtocols: string[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  lensId: string;
  protocolId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

// ============================================================================
// Conversation Types
// ============================================================================

export interface ConversationMessage {
  id: string;
  type: MessageType;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  uiComponents?: UIComponent[];
  protocolId?: string;
  metadata?: Record<string, unknown>;
}

export type MessageType = 'text' | 'voice' | 'ui_update' | 'protocol_start' | 'protocol_complete' | 'error';

// ============================================================================
// Real-time Communication Types
// ============================================================================

export interface SocketEvent {
  type: SocketEventType;
  payload: unknown;
  timestamp: Date;
  sessionId: string;
}

export type SocketEventType =
  | 'message'
  | 'ui_update'
  | 'protocol_update'
  | 'agent_status'
  | 'error'
  | 'voice_data'
  | 'connection';

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
  validator?: (value: unknown) => boolean;
}

// ============================================================================
// Store Types
// ============================================================================

export interface AppState {
  agent: Agent | null;
  conversation: ConversationMessage[];
  activeLenses: Lens[];
  uiState: UIState;
  connectionStatus: ConnectionStatus;
}

export interface UIState {
  components: UIComponent[];
  activeProtocol?: string;
  isLoading: boolean;
  error?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============================================================================
// Voice Types
// ============================================================================

export interface VoiceConfig {
  provider: 'elevenlabs' | 'azure' | 'openai';
  voiceId?: string;
  language?: string;
  speed?: number;
}

export interface AudioRecording {
  uri: string;
  duration: number;
  format: string;
}

