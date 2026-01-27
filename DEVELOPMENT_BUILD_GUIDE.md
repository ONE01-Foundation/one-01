# 📱 Development Build Setup Guide

## What is a Development Build?

A **development build** is a custom version of your app that includes:
- ✅ Your native dependencies (Reanimated, SecureStore, etc.)
- ✅ No version mismatches (you control the versions)
- ✅ Full access to all native features
- ✅ Works exactly like production, but with dev tools

**vs Expo Go:**
- ❌ Expo Go has pre-built native modules (version mismatches)
- ❌ Limited to Expo SDK modules
- ✅ But easier to test quickly

## What You Need

### Required:
1. **Expo account** (free) - Sign up at https://expo.dev
2. **EAS CLI** - Already installing for you
3. **Your device** (iOS or Android)

### Optional:
- **Apple Developer account** (for iOS - $99/year)
- **Google Play account** (for Android - $25 one-time)

---

## Step 1: Install EAS CLI (Already Done)

```bash
npm install -g eas-cli
```

---

## Step 2: Login to Expo

```bash
eas login
```

This will open a browser to sign in or create an account.

---

## Step 3: Configure EAS Build

```bash
eas build:configure
```

This creates `eas.json` with build configuration.

---

## Step 4: Build for Your Device

### For Android:

```bash
eas build --profile development --platform android
```

This will:
1. Upload your code to Expo servers
2. Build the app in the cloud
3. Give you a download link
4. Install on your Android device

### For iOS:

```bash
eas build --profile development --platform ios
```

**Note:** iOS requires:
- Apple Developer account ($99/year)
- Or use a simulator (free)

---

## Step 5: Install on Device

### Android:
1. Download the `.apk` file from the build link
2. Enable "Install from unknown sources" on your device
3. Install the APK
4. Open the app

### iOS:
1. Download the `.ipa` file
2. Install via TestFlight (if using Apple Developer)
3. Or use simulator

---

## Step 6: Start Development Server

After installing the development build:

```bash
npm start
```

Then:
- The app will automatically connect
- Or scan the QR code in the app
- Changes will hot-reload instantly!

---

## Alternative: Local Build (Faster, but requires setup)

### Android (Local):
```bash
npx expo run:android
```

**Requires:**
- Android Studio installed
- Android SDK configured
- Device connected or emulator running

### iOS (Local - Mac only):
```bash
npx expo run:ios
```

**Requires:**
- Xcode installed
- CocoaPods installed
- iOS Simulator or device

---

## Benefits of Development Build

✅ **No version mismatches** - You control all native modules
✅ **Full feature access** - All native APIs work
✅ **Faster iteration** - Changes reload instantly
✅ **Production-like** - Same as final app
✅ **Custom native code** - Can add native modules

---

## Quick Start Commands

```bash
# 1. Login
eas login

# 2. Configure
eas build:configure

# 3. Build for Android (easiest)
eas build --profile development --platform android

# 4. Download and install APK on your device

# 5. Start dev server
npm start

# 6. App connects automatically!
```

---

## Troubleshooting

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### Build fails
- Check `eas.json` configuration
- Make sure all dependencies are compatible
- Check Expo SDK version matches

### App won't connect
- Make sure device and computer are on same WiFi
- Check firewall settings
- Try tunnel mode: `npm start -- --tunnel`

---

## Cost

- **EAS Build:** Free tier includes builds
- **Development builds:** Free (unlimited)
- **Production builds:** Free tier available
- **Apple Developer:** $99/year (iOS only)
- **Google Play:** $25 one-time (Android)

---

## Next Steps

1. ✅ Install `expo-dev-client` (done)
2. ⏭️ Login: `eas login`
3. ⏭️ Configure: `eas build:configure`
4. ⏭️ Build: `eas build --profile development --platform android`
5. ⏭️ Install on device
6. ⏭️ Start dev server: `npm start`

---

## Recommendation

**Start with Android** - Easier setup, no Apple Developer account needed!

Then build for iOS later if needed.

