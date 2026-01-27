/**
 * AgentStatusIndicator - Shows current agent status and activity
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AgentStatus } from '../types';
import { MotiView } from 'moti';

interface AgentStatusIndicatorProps {
  status: AgentStatus;
  agentName: string;
}

export const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({
  status,
  agentName,
}) => {
  const getStatusColor = (): string => {
    switch (status) {
      case 'idle':
        return '#999';
      case 'thinking':
        return '#FFA500';
      case 'executing':
        return '#007AFF';
      case 'waiting':
        return '#FFA500';
      case 'error':
        return '#FF3B30';
      default:
        return '#999';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'thinking':
        return 'Thinking...';
      case 'executing':
        return 'Building...';
      case 'waiting':
        return 'Waiting for input';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const isActive = status === 'thinking' || status === 'executing';

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <MotiView
          animate={{
            scale: isActive ? [1, 1.2, 1] : 1,
          }}
          transition={{
            type: 'timing',
            duration: 1000,
            loop: isActive,
          }}
          style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
        />
        <Text style={styles.agentName}>{agentName}</Text>
      </View>

      <View style={styles.rightSection}>
        {isActive && <ActivityIndicator size="small" color={getStatusColor()} />}
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

