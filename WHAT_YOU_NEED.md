# 📋 What You Need for Development Build

## ✅ Already Done (By Me)

1. ✅ `expo-dev-client` installed
2. ✅ `eas-cli` installed globally  
3. ✅ `eas.json` configuration created
4. ✅ All code committed and ready

## 📋 What YOU Need to Do

### 1. Expo Account (2 minutes)
- Go to: https://expo.dev
- Click "Sign Up" (free)
- Or log in if you already have one
- **That's it!**

### 2. Choose Your Device

**Option A: Android (Easiest - Recommended)**
- ✅ No paid account needed
- ✅ Just need your Android phone
- ✅ Enable "Developer options" in settings
- ✅ Enable "USB debugging" (optional, for direct install)

**Option B: iOS**
- ⚠️ Requires Apple Developer account ($99/year)
- ✅ Or use iOS Simulator (free, Mac only)
- ✅ Physical device needs paid account

### 3. Run These Commands

```bash
# Step 1: Login to Expo
eas login

# Step 2: Build for Android (easiest)
eas build --profile development --platform android

# Step 3: Wait for build (~10-15 minutes)
# EAS will give you a download link

# Step 4: Download and install APK on your device

# Step 5: Start dev server
npm start

# Step 6: Open the app - it connects automatically!
```

---

## 🎯 Recommended: Start with Android

**Why Android first?**
- ✅ No paid account needed
- ✅ Easier setup
- ✅ Faster to test
- ✅ Can do iOS later

---

## ⏱️ Timeline

1. **Create Expo account:** 2 minutes
2. **Login:** 1 minute
3. **Start build:** 1 minute
4. **Wait for build:** 10-15 minutes
5. **Install on device:** 2 minutes
6. **Total:** ~20 minutes

---

## 💰 Cost Breakdown

| Item | Cost | Required? |
|------|------|-----------|
| Expo Account | FREE | ✅ Yes |
| EAS Build (dev) | FREE | ✅ Yes |
| Android Build | FREE | ✅ Yes |
| iOS Build | FREE | ✅ Yes |
| Apple Developer | $99/year | ❌ Only for iOS physical device |
| Google Play | $25 one-time | ❌ Only for publishing |

**Total for Android:** $0 (FREE!)

---

## 🚀 After Build is Ready

1. **Download** the `.apk` file (Android) or `.ipa` (iOS)
2. **Install** on your device:
   - Android: Enable "Install from unknown sources", then install
   - iOS: Use TestFlight or Xcode
3. **Run:** `npm start` in your terminal
4. **Open** the app on your device
5. **It connects automatically!** 🎉

---

## ✅ Checklist

- [ ] Create Expo account at expo.dev
- [ ] Run `eas login`
- [ ] Run `eas build --profile development --platform android`
- [ ] Wait for build to complete
- [ ] Download APK from build link
- [ ] Install on Android device
- [ ] Run `npm start`
- [ ] Open app - should connect!

---

## 🎉 That's It!

Once you have the development build installed:
- ✅ No more version mismatches
- ✅ All native features work
- ✅ Hot reload works perfectly
- ✅ Same as production app

**Ready to start?** Just run `eas login` and follow the prompts!


