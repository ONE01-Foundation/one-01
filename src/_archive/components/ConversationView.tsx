/**
 * ConversationView - Displays conversation messages between user and agent
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useConversationStore } from '../stores';
import { ConversationMessage } from '../types';
import Animated, { FadeIn } from 'react-native-reanimated';

export const ConversationView: React.FC = () => {
  const { messages } = useConversationStore();

  const renderMessage = (message: ConversationMessage, index: number) => {
    const isUser = message.sender === 'user';

    return (
      <Animated.View
        key={message.id}
        entering={FadeIn.delay(index * 50)}
        style={[styles.messageContainer, isUser ? styles.userMessage : styles.agentMessage]}
      >
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.agentBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.agentText]}>
            {message.content}
          </Text>
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.agentTimestamp]}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Start a conversation with your AI agent...
          </Text>
        </View>
      ) : (
        messages.map((message, index) => renderMessage(message, index))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  agentMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  agentText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#fff',
  },
  agentTimestamp: {
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

