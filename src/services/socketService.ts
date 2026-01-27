/**
 * Socket.io Service - Real-time communication with agent backend
 */

import { io, Socket } from 'socket.io-client';
import { SocketEvent, SocketEventType } from '../types';
import { useConnectionStore } from '../stores/connectionStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUIStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(serverUrl: string, sessionId: string, userId: string): void {
    if (this.socket?.connected) {
      console.warn('Socket already connected');
      return;
    }

    const connectionStore = useConnectionStore.getState();
    connectionStore.setStatus('connecting');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      query: {
        sessionId,
        userId,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    const connectionStore = useConnectionStore.getState();
    const conversationStore = useConversationStore.getState();
    const uiStore = useUIStore.getState();
    const agentStore = useAgentStore.getState();

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      connectionStore.setStatus('connected');
      connectionStore.setSocketId(this.socket?.id || null);
      connectionStore.setLastConnected(new Date());
      connectionStore.resetReconnectAttempts();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      connectionStore.setStatus('disconnected');
      connectionStore.setSocketId(null);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      connectionStore.setStatus('error');
      connectionStore.incrementReconnectAttempts();
    });

    // Message events
    this.socket.on('message', (event: SocketEvent) => {
      this.handleMessage(event);
    });

    // UI update events
    this.socket.on('ui_update', (event: SocketEvent) => {
      this.handleUIUpdate(event);
    });

    // Protocol update events
    this.socket.on('protocol_update', (event: SocketEvent) => {
      this.handleProtocolUpdate(event);
    });

    // Agent status events
    this.socket.on('agent_status', (event: SocketEvent) => {
      this.handleAgentStatus(event);
    });

    // Error events
    this.socket.on('error', (event: SocketEvent) => {
      console.error('Socket error event:', event);
      conversationStore.setError(event.payload as string);
    });
  }

  private handleMessage(event: SocketEvent): void {
    const conversationStore = useConversationStore.getState();
    const payload = event.payload as any;
    
    // Transform socket event to conversation message
    const message = {
      id: payload.id || Date.now().toString(),
      type: payload.type || 'text',
      content: payload.content || '',
      sender: payload.sender || 'agent',
      timestamp: new Date(payload.timestamp || Date.now()),
      uiComponents: payload.uiComponents || [],
      protocolId: payload.protocolId,
      metadata: payload.metadata,
    };
    
    conversationStore.addMessage(message);
  }

  private handleUIUpdate(event: SocketEvent): void {
    const uiStore = useUIStore.getState();
    const payload = event.payload as any;
    
    // Handle UI component updates from agent
    if (payload.components && Array.isArray(payload.components)) {
      if (payload.action === 'add') {
        payload.components.forEach((component: any) => {
          uiStore.addComponent(component);
        });
      } else if (payload.action === 'update') {
        payload.components.forEach((component: any) => {
          uiStore.updateComponent(component.id, component);
        });
      } else if (payload.action === 'remove') {
        payload.components.forEach((component: any) => {
          uiStore.removeComponent(component.id);
        });
      } else if (payload.action === 'replace') {
        uiStore.batchUpdateComponents(payload.components);
      }
    }
  }

  private handleProtocolUpdate(event: SocketEvent): void {
    const agentStore = useAgentStore.getState();
    const uiStore = useUIStore.getState();
    const payload = event.payload as any;
    
    // Handle protocol execution updates
    if (payload.protocolId) {
      agentStore.setActiveProtocol(payload.protocolId);
      uiStore.setActiveProtocol(payload.protocolId);
    }
    
    if (payload.status) {
      agentStore.updateStatus(payload.status);
    }
  }

  private handleAgentStatus(event: SocketEvent): void {
    const agentStore = useAgentStore.getState();
    const payload = event.payload as any;
    
    // Update agent status
    if (payload.status) {
      agentStore.updateStatus(payload.status);
    }
  }

  sendMessage(type: SocketEventType, payload: unknown): void {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }

    const event: SocketEvent = {
      type,
      payload,
      timestamp: new Date(),
      sessionId: useConnectionStore.getState().socketId || '',
    };

    this.socket.emit(type, event);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      useConnectionStore.getState().setStatus('disconnected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();

