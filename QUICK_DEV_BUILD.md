# 🚀 Quick Development Build Setup

## ✅ What's Already Done

1. ✅ `expo-dev-client` installed
2. ✅ `eas-cli` installed globally
3. ✅ `eas.json` configuration created

## 📋 What I Need From You

### 1. Expo Account
- Go to https://expo.dev
- Sign up (free) or log in
- That's it!

### 2. Your Device Type
- **Android** (easier - recommended to start)
- **iOS** (requires Apple Developer account - $99/year)

### 3. Device Ready
- Android: Enable "Developer options" and "USB debugging"
- iOS: Need Apple Developer account for physical device (or use simulator)

---

## 🎯 Quick Start (3 Steps)

### Step 1: Login to Expo

```bash
eas login
```

This opens your browser - sign in or create account.

### Step 2: Build for Your Device

**For Android (Easiest):**
```bash
eas build --profile development --platform android
```

**For iOS:**
```bash
eas build --profile development --platform ios
```

### Step 3: Install & Run

1. **Download** the build from the link EAS provides
2. **Install** on your device
3. **Run:** `npm start`
4. **Open** the app on your device - it connects automatically!

---

## ⏱️ Build Time

- **First build:** ~10-15 minutes (builds in cloud)
- **Subsequent builds:** ~5-10 minutes (cached dependencies)

---

## 💰 Cost

- **EAS Build:** FREE for development builds
- **Android:** FREE (no account needed)
- **iOS:** FREE for simulator, $99/year for physical device

---

## 🎉 Benefits

✅ **No more version mismatches** - Your Reanimated will work perfectly!
✅ **All native features work** - SecureStore, AV, everything
✅ **Hot reload** - Changes appear instantly
✅ **Production-like** - Same as final app

---

## 🔄 After First Build

Once you have the development build installed:

1. **Make code changes**
2. **Save file**
3. **App updates automatically!** (hot reload)

No need to rebuild unless you:
- Add new native dependencies
- Change `app.json` native config
- Update Expo SDK

---

## 📱 Alternative: Local Build (Faster)

If you have Android Studio/Xcode set up:

**Android:**
```bash
npx expo run:android
```

**iOS (Mac only):**
```bash
npx expo run:ios
```

This builds locally (faster) but requires full dev environment setup.

---

## 🆘 Need Help?

1. **Build fails?** Check `eas.json` is correct
2. **Can't login?** Make sure you have Expo account
3. **App won't connect?** Same WiFi network required
4. **Still issues?** Check `DEVELOPMENT_BUILD_GUIDE.md` for detailed troubleshooting

---

## ✅ Ready?

Just run:
```bash
eas login
eas build --profile development --platform android
```

Then wait for the build link, download, and install! 🎉

