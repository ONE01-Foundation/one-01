import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** AppShell stack: Home + Process + Profile + Discovery + ProviderProfile + ShareCard + Units */
export type AppShellParamList = {
  Home: undefined;
  Process: { processId: string };
  Profile: undefined;
  Discovery: undefined;
  ProviderProfile: { providerId: string };
  ShareCard: { processId: string };
  Units: undefined;
};

export type AppShellScreenProps<T extends keyof AppShellParamList> = NativeStackScreenProps<
  AppShellParamList,
  T
>;

/** Legacy alias for Process/Home only call sites */
export type MainStackParamList = AppShellParamList;
