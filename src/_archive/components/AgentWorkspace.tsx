/**
 * AgentWorkspace - Main workspace where agent builds UI in real-time
 * Zoom-like collaborative interface
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Dimensions, TouchableOpacity, Text } from 'react-native';
import { useAgentStore, useUIStore, useConversationStore } from '../stores';
import { DynamicUI } from './DynamicUI';
import { ConversationView } from './ConversationView';
import { AgentStatusIndicator } from './AgentStatusIndicator';

interface AgentWorkspaceProps {
  sessionId: string;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ sessionId }) => {
  const { agent, status } = useAgentStore();
  const { components } = useUIStore();
  const { messages } = useConversationStore();
  const [showConversation, setShowConversation] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;

  useEffect(() => {
    // Initialize workspace when session starts
    console.log('Workspace initialized for session:', sessionId);
  }, [sessionId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AgentStatusIndicator status={status} agentName={agent?.name || 'AI Agent'} />
        {isMobile && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowConversation(!showConversation)}
          >
            <Text style={styles.toggleButtonText}>
              {showConversation ? 'UI' : 'Chat'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.workspace}>
        {/* Dynamic UI Area - where agent builds components */}
        {(!isMobile || !showConversation) && (
          <View style={[styles.uiArea, isMobile && styles.mobileFullWidth]}>
            <DynamicUI components={components} />
          </View>
        )}

        {/* Conversation Area - chat history */}
        {(!isMobile || showConversation) && (
          <View style={[styles.conversationArea, isMobile && styles.mobileFullWidth]}>
            <ConversationView />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  uiArea: {
    flex: 1,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  conversationArea: {
    width: 350,
    backgroundColor: '#f5f5f5',
  },
  mobileFullWidth: {
    width: '100%',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

