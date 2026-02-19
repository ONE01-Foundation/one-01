/**
 * AppShell – Single stack: Home, Process, Profile, Discovery, ProviderProfile, ShareCard.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OneScreen } from '../screens/OneScreen';
import { ProcessScreen } from '../screens/ProcessScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { ProviderProfileScreen } from '../screens/ProviderProfileScreen';
import { ShareCardScreen } from '../screens/ShareCardScreen';
import { UnitsScreen } from '../screens/UnitsScreen';
import type { AppShellParamList } from './types';

const Stack = createNativeStackNavigator<AppShellParamList>();

export function AppShell() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={OneScreen} />
      <Stack.Screen name="Process" component={ProcessScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Discovery" component={DiscoveryScreen} />
      <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} />
      <Stack.Screen name="ShareCard" component={ShareCardScreen} />
      <Stack.Screen name="Units" component={UnitsScreen} />
    </Stack.Navigator>
  );
}
