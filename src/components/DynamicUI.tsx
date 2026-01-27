/**
 * DynamicUI - Renders UI components dynamically based on agent actions
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useUIStore } from '../stores';
import { UIComponent } from '../types';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

interface DynamicUIProps {
  components?: UIComponent[];
}

export const DynamicUI: React.FC<DynamicUIProps> = ({ components: propComponents }) => {
  const { components: storeComponents } = useUIStore();
  const components = propComponents || storeComponents;

  const renderComponent = (component: UIComponent, index: number): React.ReactNode => {
    const animationStyle = component.animation
      ? getAnimationStyle(component.animation, index)
      : {};

    switch (component.type) {
      case 'text':
        return (
          <Animated.View
            key={component.id}
            entering={FadeIn.delay(index * 100)}
            style={[styles.component, animationStyle, component.style]}
          >
            <Text style={styles.text}>{component.props.content as string}</Text>
          </Animated.View>
        );

      case 'card':
        return (
          <Animated.View
            key={component.id}
            entering={SlideInDown.delay(index * 100)}
            style={[styles.card, component.style]}
          >
            {component.props.title && (
              <Text style={styles.cardTitle}>{component.props.title as string}</Text>
            )}
            {component.props.content && (
              <Text style={styles.cardContent}>{component.props.content as string}</Text>
            )}
            {component.children?.map((child, idx) => renderComponent(child, idx))}
          </Animated.View>
        );

      case 'button':
        return (
          <Animated.View
            key={component.id}
            entering={FadeIn.delay(index * 100)}
            style={[styles.button, component.style]}
          >
            <Text style={styles.buttonText}>{component.props.label as string}</Text>
          </Animated.View>
        );

      case 'form':
        return (
          <Animated.View
            key={component.id}
            entering={SlideInDown.delay(index * 100)}
            style={[styles.form, component.style]}
          >
            {component.props.fields && (
              <View style={styles.formFields}>
                {(component.props.fields as Array<{ name: string; label: string; type: string }>).map(
                  (field, idx) => (
                    <View key={idx} style={styles.formField}>
                      <Text style={styles.formLabel}>{field.label}</Text>
                      <View style={styles.formInput}>
                        <Text style={styles.formInputText}>{field.type}</Text>
                      </View>
                    </View>
                  )
                )}
              </View>
            )}
          </Animated.View>
        );

      case 'list':
        return (
          <Animated.View
            key={component.id}
            entering={SlideInDown.delay(index * 100)}
            style={[styles.list, component.style]}
          >
            {component.props.title && (
              <Text style={styles.listTitle}>{component.props.title as string}</Text>
            )}
            {component.props.items &&
              (component.props.items as unknown[]).map((item, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Text>{String(item)}</Text>
                </View>
              ))}
          </Animated.View>
        );

      case 'chart':
        return (
          <Animated.View
            key={component.id}
            entering={FadeIn.delay(index * 100)}
            style={[styles.chart, component.style]}
          >
            {component.props.title && (
              <Text style={styles.chartTitle}>{component.props.title as string}</Text>
            )}
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                Chart: {component.props.chartType as string}
              </Text>
            </View>
          </Animated.View>
        );

      default:
        return (
          <Animated.View
            key={component.id}
            entering={FadeIn.delay(index * 100)}
            style={[styles.component, component.style]}
          >
            <Text>Unknown component type: {component.type}</Text>
          </Animated.View>
        );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {components.map((component, index) => renderComponent(component, index))}
    </ScrollView>
  );
};

const getAnimationStyle = (animation: { type: string; duration?: number }, index: number) => {
  // Animation styles would be applied via Reanimated or Moti
  return {};
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  component: {
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  cardContent: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  formFields: {
    gap: 12,
  },
  formField: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  formInputText: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  listItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chart: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#999',
  },
});

