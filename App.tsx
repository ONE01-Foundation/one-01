/**
 * ONE Platform - Main App Component
 * AI Agent Operating System
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { AgentWorkspace, InputBar } from './src/components';
import { useAgentStore, useConversationStore, useConnectionStore } from './src/stores';
import { socketService, supabaseService, voiceService } from './src/services';
import { getOrCreateSessionId, getUserId } from './src/utils/session';
import { SOCKET_SERVER_URL } from './src/utils/constants';
import { ConversationMessage } from './src/types';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { setAgent, updateStatus } = useAgentStore();
  const { addMessage } = useConversationStore();
  const { setStatus } = useConnectionStore();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize services
      supabaseService.initialize();
      await voiceService.initialize();

      // Get or create session
      const session = await getOrCreateSessionId();
      const userId = await getUserId();
      setSessionId(session);

      // Initialize agent
      setAgent({
        id: 'main_agent',
        name: 'AI Assistant',
        status: 'idle',
        activeLenses: [],
        context: {
          userId: userId || 'anonymous',
          sessionId: session,
          goals: [],
          history: [],
          activeProtocols: [],
        },
      });

      // Connect to socket server
      // For Expo Go, use your local network IP instead of localhost
      // Example: http://192.168.1.100:3000
      if (SOCKET_SERVER_URL && SOCKET_SERVER_URL !== 'http://localhost:3000') {
        socketService.connect(SOCKET_SERVER_URL, session, userId || 'anonymous');
      } else {
        console.warn('Socket server URL not configured. Real-time features disabled.');
        console.warn('To enable: Set EXPO_PUBLIC_SOCKET_SERVER_URL in .env (use your local IP for Expo Go)');
        setStatus('disconnected');
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsInitialized(true); // Still show UI even if initialization fails
    }
  };

  const handleSendMessage = (message: ConversationMessage) => {
    // Add message to conversation
    addMessage(message);

    // Update agent status
    updateStatus('thinking');

    // Send message via socket if connected
    if (socketService.isConnected()) {
      socketService.sendMessage('message', {
        type: message.type,
        content: message.content,
        sender: message.sender,
        timestamp: message.timestamp,
      });
    } else {
      // Simulate agent response for demo purposes
      setTimeout(() => {
        const agentResponse: ConversationMessage = {
          id: Date.now().toString() + '_agent',
          type: 'text',
          content: 'I received your message. In a production environment, this would be processed by the AI agent backend.',
          sender: 'agent',
          timestamp: new Date(),
        };
        addMessage(agentResponse);
        updateStatus('idle');
      }, 1000);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!sessionId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AgentWorkspace sessionId={sessionId} />
      <InputBar onSend={handleSendMessage} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
