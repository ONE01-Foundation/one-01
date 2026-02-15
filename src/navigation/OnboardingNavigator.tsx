import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  WelcomeScreen,
  NameScreen,
  StyleScreen,
  LensScreen,
  DesireScreen,
  ConfirmScreen,
} from '../onboarding';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Name: undefined;
  Style: undefined;
  Lens: undefined;
  Desire: undefined;
  Confirm: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Name" component={NameScreen} />
      <Stack.Screen name="Style" component={StyleScreen} />
      <Stack.Screen name="Lens" component={LensScreen} />
      <Stack.Screen name="Desire" component={DesireScreen} />
      <Stack.Screen name="Confirm" component={ConfirmScreen} />
    </Stack.Navigator>
  );
}
