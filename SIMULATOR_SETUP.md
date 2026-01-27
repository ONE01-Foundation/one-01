# 🖥️ Testing on Simulator/Emulator

## Option 1: Web Browser (Easiest - Works on Windows)

### Quick Start:
```bash
npm start
```
Then press `w` to open in web browser.

Or directly:
```bash
npm run web
```

**Pros:**
- ✅ Works on Windows, Mac, Linux
- ✅ No setup required
- ✅ Fastest to test
- ✅ Good for UI/UX testing

**Cons:**
- ⚠️ Some native features may not work (camera, microphone permissions)
- ⚠️ Performance differs from mobile

## Option 2: Android Emulator (Windows Compatible)

### Prerequisites:
1. **Install Android Studio**
   - Download: https://developer.android.com/studio
   - Install with Android SDK and emulator

2. **Set up Android Emulator**
   - Open Android Studio
   - Tools → Device Manager
   - Create Virtual Device
   - Select a device (e.g., Pixel 5)
   - Download a system image (e.g., Android 13)
   - Finish setup

3. **Start Emulator**
   - In Android Studio: Device Manager → Start (▶️) button
   - Or from command line:
     ```bash
     emulator -avd <your_avd_name>
     ```

### Run Expo on Android:
```bash
npm start
```
Then press `a` to open on Android emulator.

Or directly:
```bash
npm run android
```

**Pros:**
- ✅ Full native features
- ✅ Real mobile experience
- ✅ Works on Windows

**Cons:**
- ⚠️ Requires Android Studio setup
- ⚠️ Emulator can be slow on some machines

## Option 3: iOS Simulator (Mac Only)

If you're on Mac:

### Prerequisites:
- Xcode installed from App Store
- iOS Simulator (comes with Xcode)

### Run Expo on iOS:
```bash
npm start
```
Then press `i` to open on iOS simulator.

Or directly:
```bash
npm run ios
```

## 🚀 Quick Test (Recommended for Now)

### Test on Web First:
```bash
npm run web
```

This will:
1. Start Metro bundler
2. Open your default browser
3. Show your app running

**Perfect for:**
- Testing UI components
- Testing Socket.io connections
- Testing state management
- Quick iteration

## 📋 Step-by-Step: Web Browser Test

1. **Start the app:**
   ```bash
   npm run web
   ```

2. **Browser opens automatically** at `http://localhost:8081`

3. **Test features:**
   - UI components render
   - Socket.io connection (if backend running)
   - State management
   - Navigation

## 📋 Step-by-Step: Android Emulator Test

1. **Start Android Emulator:**
   - Open Android Studio
   - Device Manager → Start emulator
   - Wait for it to boot

2. **Start Expo:**
   ```bash
   npm start
   ```

3. **Press `a`** or run:
   ```bash
   npm run android
   ```

4. **App installs and opens** on emulator

## 🔧 Troubleshooting

### Web Browser Issues

**Port already in use:**
```bash
# Kill process on port 8081
npx kill-port 8081
npm run web
```

**CORS errors:**
- Make sure backend CORS is configured for `http://localhost:8081`

### Android Emulator Issues

**Emulator not detected:**
```bash
# Check if emulator is running
adb devices

# If empty, start emulator from Android Studio
```

**"No Android devices found":**
1. Make sure emulator is fully booted (wait for home screen)
2. Check ADB: `adb devices` should show device
3. Try: `adb kill-server && adb start-server`

**Slow performance:**
- Enable hardware acceleration in Android Studio
- Allocate more RAM to emulator (4GB+ recommended)
- Use x86/x86_64 system images (faster than ARM)

## 🎯 Recommended Testing Flow

1. **Start with Web** (`npm run web`)
   - Quick UI/UX testing
   - Fast iteration
   - Test core functionality

2. **Then Android Emulator** (`npm run android`)
   - Test native features
   - Test on actual mobile OS
   - Performance testing

3. **Finally Expo Go** (on real device)
   - Real-world testing
   - Network conditions
   - Device-specific features

## 💡 Pro Tips

- **Web is fastest** for development and testing UI
- **Android emulator** for testing native features
- **Expo Go** for final testing on real device
- Use **multiple terminals**: one for backend, one for Expo

## 🚀 Quick Commands Reference

```bash
# Web browser
npm run web

# Android emulator
npm run android

# iOS simulator (Mac only)
npm run ios

# Start with options
npm start -- --web
npm start -- --android
npm start -- --ios

# Clear cache and start
npm start -- --clear
```

