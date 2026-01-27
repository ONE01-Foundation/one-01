# Expo Go Testing Setup Guide

## Quick Setup for Testing on Expo Go

### 1. Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```env
# Socket.io Server URL
# IMPORTANT: For Expo Go, use your local network IP address, NOT localhost
# Find your IP: 
#   Windows: ipconfig (look for IPv4 Address)
#   Mac/Linux: ifconfig or ip addr
# Example: http://192.168.1.100:3000
EXPO_PUBLIC_SOCKET_SERVER_URL=http://YOUR_LOCAL_IP:3000

# Supabase (Optional for initial testing)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# ElevenLabs API Key
EXPO_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key
EXPO_PUBLIC_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 2. Find Your Local IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```
Look for inet address (usually 192.168.x.x or 10.0.x.x)

### 3. Start the Backend Server

If you have the backend server set up:

```bash
cd one-01-backend
npm install
npm run dev
```

The server should be running on port 3000.

### 4. Start Expo Development Server

```bash
npm start
```

### 5. Open in Expo Go

1. Install **Expo Go** app on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Scan the QR code shown in your terminal/browser

3. The app will load on your device

### 6. Testing Checklist

- [ ] App loads without errors
- [ ] Connection status shows in header
- [ ] Can send text messages
- [ ] Agent responds (if backend is running)
- [ ] UI components appear dynamically
- [ ] Voice recording works (tap microphone button)
- [ ] Text-to-speech works (if ElevenLabs is configured)

## Troubleshooting

### Connection Issues

**Problem:** "Socket not connected" or connection errors

**Solutions:**
1. Make sure backend server is running
2. Use your local network IP, not `localhost` or `127.0.0.1`
3. Ensure phone and computer are on the same WiFi network
4. Check firewall settings (port 3000 should be open)
5. Try using tunnel mode: `npx expo start --tunnel`

### Environment Variables Not Loading

**Problem:** API keys not working

**Solutions:**
1. Make sure `.env` file is in the root directory
2. Restart Expo server after changing `.env`
3. Clear cache: `npx expo start --clear`
4. Check that variable names start with `EXPO_PUBLIC_`

### Voice/Recording Issues

**Problem:** Microphone not working

**Solutions:**
1. Grant microphone permissions when prompted
2. Check app permissions in device settings
3. For iOS: Check Info.plist permissions (should be auto-configured)

### Backend Not Responding

**Problem:** Messages not being processed

**Solutions:**
1. Check backend server logs
2. Verify backend is accessible from your network
3. Test backend health endpoint: `http://YOUR_IP:3000/health`
4. Check CORS settings in backend

## Testing Without Backend

The app can run in demo mode without a backend:

1. Leave `EXPO_PUBLIC_SOCKET_SERVER_URL` empty or set to a non-existent URL
2. The app will show a warning but still function
3. You'll see simulated agent responses after 1 second
4. UI components can be added programmatically for testing

## Network Configuration Tips

### For Local Development:
- Use your computer's local IP address
- Ensure both devices are on the same network
- Disable VPN if it's causing issues

### For Production Testing:
- Deploy backend to a cloud service (Heroku, Railway, etc.)
- Use the production URL in `.env`
- No need for local IP in production

## Next Steps

Once everything is working:

1. Test all lens capabilities (Health, Finance, Career)
2. Test protocol execution
3. Test voice features (recording + TTS)
4. Test real-time UI updates
5. Test with multiple devices/sessions

