/**
 * ONE Platform - Simplified Version
 * Start simple, add complexity later
 */

import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your AI assistant. How can I help you today?',
      sender: 'agent',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // Simulate agent response (simple for now)
    setTimeout(() => {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `You said: "${userMessage.text}". This is a simple response. We'll add AI later!`,
        sender: 'agent',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMessage]);
    }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ONE Platform</Text>
        <Text style={styles.headerSubtitle}>AI Assistant</Text>
      </View>

      {/* Messages */}
      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.agentBubble,
            ]}
          >
            <Text style={message.sender === 'user' ? styles.userText : styles.agentText}>
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userText: {
    color: '#fff',
    fontSize: 15,
  },
  agentText: {
    color: '#333',
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

