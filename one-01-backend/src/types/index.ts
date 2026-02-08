/**
 * Shared types for backend server
 */

export interface SocketEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
  sessionId: string;
}

export interface MessagePayload {
  id?: string;
  type: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp?: Date;
  uiComponents?: UIComponent[];
  protocolId?: string;
  metadata?: Record<string, unknown>;
}

export interface UIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: UIComponent[];
  style?: Record<string, unknown>;
  animation?: {
    type: string;
    duration?: number;
    delay?: number;
  };
}

export interface AgentResponse {
  text: string;
  uiComponents?: UIComponent[];
  protocolId?: string;
  status?: 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';
}

export interface SocketData {
  sessionId: string;
  userId: string;
  connectedAt: Date;
}


