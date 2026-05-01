import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingFlowScreen } from '../onboarding';

export type OnboardingStackParamList = {
  OnboardingFlow: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="OnboardingFlow">
      <Stack.Screen name="OnboardingFlow" component={OnboardingFlowScreen} />
    </Stack.Navigator>
  );
}
