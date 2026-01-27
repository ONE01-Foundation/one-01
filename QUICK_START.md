# 🚀 Quick Start Guide - Testing on Expo Go

## ✅ What's Been Configured

1. ✅ **Environment Variables Setup** - `.env` file created with your local IP
2. ✅ **ElevenLabs Integration** - TTS service ready
3. ✅ **Socket.io Client** - Real-time communication configured
4. ✅ **Expo Constants** - Environment variable loading configured
5. ✅ **All Services Updated** - Ready for testing

## 📋 Next Steps

### 1. Update Your .env File

Open `.env` and add your **ElevenLabs API Key**:

```env
EXPO_PUBLIC_ELEVENLABS_API_KEY=paste_your_key_here
```

**To get your ElevenLabs API Key:**
1. Go to https://elevenlabs.io/app/settings/api-keys
2. Click "Create API Key"
3. Name it: "ONE Platform TTS"
4. Set **Voice Generation: Access** (required!)
5. Copy the key and paste it in `.env`

### 2. (Optional) Start Backend Server

If you have the backend server set up:

```bash
# In a separate terminal
cd one-01-backend
npm install
npm run dev
```

The server should run on `http://172.20.10.2:3000`

**Note:** If you don't have a backend yet, the app will still work in demo mode!

### 3. Start Expo Development Server

```bash
npm start
```

### 4. Open in Expo Go

1. **Install Expo Go** on your phone:
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scan the QR code** shown in your terminal

3. **Grant permissions** when prompted:
   - Microphone (for voice recording)
   - Storage (if needed)

## 🧪 Testing Checklist

Once the app loads:

- [ ] App opens without errors
- [ ] Connection status shows in header (may show "disconnected" if no backend)
- [ ] Type a message and send it
- [ ] See agent response (simulated if no backend)
- [ ] Tap microphone button to test recording
- [ ] Test TTS playback (if ElevenLabs key is configured)

## 🔧 Current Configuration

- **Socket Server URL:** `http://172.20.10.2:3000`
- **Local IP:** `172.20.10.2` (auto-detected)
- **ElevenLabs Voice ID:** `21m00Tcm4TlvDq8ikWAM` (Rachel - default)

## ⚠️ Important Notes

1. **Same WiFi Network:** Your phone and computer must be on the same WiFi network
2. **Firewall:** Make sure port 3000 is not blocked by firewall
3. **Backend Optional:** App works without backend (demo mode)
4. **Environment Variables:** Restart Expo server after changing `.env`

## 🐛 Troubleshooting

### "Socket not connected"
- Backend not running? That's OK - app works in demo mode
- Wrong IP? Check your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Update `.env` with correct IP and restart Expo

### "ElevenLabs API key not configured"
- Add your API key to `.env`
- Restart Expo server: `npm start --clear`

### Can't connect from phone
- Ensure phone and computer are on same WiFi
- Try tunnel mode: `npx expo start --tunnel`
- Check firewall settings

## 📚 More Information

- See `EXPO_GO_SETUP.md` for detailed setup instructions
- See `SETUP.md` for full project documentation
- See `README.md` for project overview

## 🎉 You're Ready!

Everything is configured. Just add your ElevenLabs API key and you can start testing!

