# 🖥️ Quick Simulator Guide

## Option 1: Web Browser (Easiest - Recommended First)

### Run:
```bash
npm run web
```

This will:
- ✅ Start Metro bundler
- ✅ Open your browser automatically
- ✅ Show your app at `http://localhost:8081`

**Perfect for:**
- Quick UI testing
- Testing Socket.io connections
- Fast development iteration

## Option 2: Android Emulator

### Prerequisites:
1. **Install Android Studio**
   - Download: https://developer.android.com/studio
   - Install with Android SDK

2. **Create Virtual Device:**
   - Open Android Studio
   - Tools → Device Manager
   - Create Virtual Device
   - Choose device (Pixel 5 recommended)
   - Download system image (Android 13)
   - Finish

3. **Start Emulator:**
   - In Android Studio: Click ▶️ (Play) button
   - Wait for emulator to boot (home screen appears)

### Run on Android:
```bash
npm start
```
Then press `a` when prompted.

Or directly:
```bash
npm run android
```

## Option 3: iOS Simulator (Mac Only)

If you're on Mac:

```bash
npm start
```
Then press `i` when prompted.

Or:
```bash
npm run ios
```

## 🚀 Quick Start (Right Now)

### Test on Web:
```bash
npm run web
```

The browser will open automatically with your app!

## 📋 Testing Checklist

Once simulator/emulator is running:

- [ ] App loads without errors
- [ ] UI components render correctly
- [ ] Can send messages (if backend running)
- [ ] Socket.io connection works
- [ ] Animations work smoothly
- [ ] Navigation functions properly

## 🔧 Troubleshooting

### Web Browser

**Port 8081 in use:**
```bash
# Kill the process
npx kill-port 8081
npm run web
```

**Browser doesn't open:**
- Manually visit: `http://localhost:8081`

### Android Emulator

**"No Android devices found":**
1. Make sure emulator is fully booted
2. Check: `adb devices` (should show device)
3. Restart ADB: `adb kill-server && adb start-server`

**Emulator is slow:**
- Enable hardware acceleration in Android Studio
- Allocate more RAM (4GB+)
- Use x86 system images (not ARM)

## 💡 Pro Tips

1. **Start with Web** - Fastest way to test
2. **Use Android Emulator** - For native feature testing
3. **Keep backend running** - In separate terminal
4. **Use multiple terminals:**
   - Terminal 1: Backend server (`cd one-01-backend && npm run dev`)
   - Terminal 2: Expo (`npm start` or `npm run web`)

## 🎯 Recommended Workflow

1. **Development:** Use web browser (`npm run web`)
2. **Native Testing:** Use Android emulator
3. **Final Testing:** Use Expo Go on real device

## 📝 Quick Commands

```bash
# Web (works everywhere)
npm run web

# Android (Windows/Mac/Linux)
npm run android

# iOS (Mac only)
npm run ios

# Start with menu
npm start
# Then press: w (web), a (android), i (ios)
```

