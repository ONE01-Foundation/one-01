/**
 * ErrorBoundary — top-level safety net so a runtime crash anywhere inside the
 * tree shows a recoverable message instead of a blank white screen. Spec rule:
 * the user should never see nothing.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    maxWidth: 320,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#111',
    borderRadius: 28,
    marginTop: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
