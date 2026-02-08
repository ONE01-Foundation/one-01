/**
 * Message Handler - Processes incoming messages and generates responses
 */

import { Socket, Server } from 'socket.io';
import { SocketEvent, MessagePayload } from '../types/index.js';
import { openAIService } from '../services/openAIService.js';

export const messageHandler = {
  async handleMessage(socket: Socket, event: SocketEvent, io: Server): Promise<void> {
    const { payload, sessionId } = event;
    const messagePayload = payload as MessagePayload;
    const messageContent = messagePayload.content;
    const userId = (socket.data as any).userId || 'anonymous';

    console.log(`[${sessionId}] Received message from ${messagePayload.sender}: ${messageContent}`);

    // Update agent status to thinking
    socket.emit('agent_status', {
      type: 'agent_status',
      payload: { 
        status: 'thinking',
        message: 'Processing your message...'
      },
      timestamp: new Date(),
      sessionId
    });

    try {
      // Process message with AI agent
      const response = await openAIService.chat(
        messageContent,
        sessionId,
        userId
      );

      // Update agent status to executing
      socket.emit('agent_status', {
        type: 'agent_status',
        payload: { 
          status: 'executing',
          message: 'Generating response...'
        },
        timestamp: new Date(),
        sessionId
      });

      // Small delay to show status update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send agent response message
      const agentMessage: MessagePayload = {
        id: `msg_${Date.now()}`,
        type: 'text',
        content: response.text,
        sender: 'agent',
        timestamp: new Date(),
        uiComponents: response.uiComponents || []
      };

      socket.emit('message', {
        type: 'message',
        payload: agentMessage,
        timestamp: new Date(),
        sessionId
      });

      // If UI components were generated, send UI update
      if (response.uiComponents && response.uiComponents.length > 0) {
        console.log(`[${sessionId}] Sending ${response.uiComponents.length} UI components`);
        
        socket.emit('ui_update', {
          type: 'ui_update',
          payload: {
            components: response.uiComponents,
            action: 'add'
          },
          timestamp: new Date(),
          sessionId
        });
      }

      // Reset agent status to idle
      socket.emit('agent_status', {
        type: 'agent_status',
        payload: { 
          status: 'idle',
          message: 'Ready'
        },
        timestamp: new Date(),
        sessionId
      });

    } catch (error) {
      console.error(`[${sessionId}] Error processing message:`, error);
      
      socket.emit('error', {
        type: 'error',
        payload: { 
          message: 'Failed to process message. Please try again.',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date(),
        sessionId
      });

      socket.emit('agent_status', {
        type: 'agent_status',
        payload: { 
          status: 'error',
          message: 'Error occurred'
        },
        timestamp: new Date(),
        sessionId
      });
    }
  },

  async handleVoiceData(socket: Socket, event: SocketEvent, io: Server): Promise<void> {
    // Handle audio data for speech-to-text
    // This would integrate with Whisper API
    const { payload, sessionId } = event;
    
    console.log(`[${sessionId}] Received voice data`);
    
    // TODO: Implement Whisper API integration
    // For now, just acknowledge receipt
    socket.emit('voice_data_received', {
      type: 'voice_data_received',
      payload: { status: 'received' },
      timestamp: new Date(),
      sessionId
    });
  }
};


