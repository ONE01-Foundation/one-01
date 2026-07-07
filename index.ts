import { registerRootComponent } from 'expo';
import { I18nManager } from 'react-native';

import App from './App';

// RTL strategy. This app drives right-to-left from the IN-APP language via the
// engine-aware helpers in src/utils/rtl.ts (rowFlip / alignText). Those adapt to
// whatever direction the native engine ends up in, so we don't depend on
// forceRTL (which is unreliable in Expo Go). We DO turn OFF the automatic
// left↔right swap so that `textAlign: 'left' | 'right'` mean their PHYSICAL side
// in every engine — that's what alignText assumes after reading the flag.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
I18nManager.swapLeftAndRightInRTL(false);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
