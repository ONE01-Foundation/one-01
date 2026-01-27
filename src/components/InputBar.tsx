/**
 * InputBar - Text and voice input for user messages
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useConversationStore } from '../stores';
import { ConversationMessage } from '../types';
import { voiceService } from '../services';

interface InputBarProps {
  onSend: (message: ConversationMessage) => void;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = () => {
    if (text.trim()) {
      const message: ConversationMessage = {
        id: Date.now().toString(),
        type: 'text',
        content: text.trim(),
        sender: 'user',
        timestamp: new Date(),
      };
      onSend(message);
      setText('');
    }
  };

  const handleVoicePress = async () => {
    if (isRecording) {
      const recording = await voiceService.stopRecording();
      setIsRecording(false);
      if (recording) {
        // Process recording - send to backend for STT
        console.log('Recording stopped:', recording);
      }
    } else {
      await voiceService.startRecording();
      setIsRecording(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
          onPress={handleVoicePress}
        >
          <Text style={styles.voiceButtonText}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim()}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 100,
  },
  voiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonText: {
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

