import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  BirthScreen,
  WorldsScreen,
  DirectionScreen,
  NamingScreen,
  LoginScreen,
} from '../onboarding';

export type OnboardingStackParamList = {
  Birth: undefined;
  Worlds: undefined;
  Direction: undefined;
  Naming: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Birth"
    >
      <Stack.Screen name="Birth" component={BirthScreen} />
      <Stack.Screen name="Worlds" component={WorldsScreen} />
      <Stack.Screen name="Direction" component={DirectionScreen} />
      <Stack.Screen name="Naming" component={NamingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
