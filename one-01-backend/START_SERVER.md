# 🚀 Starting the Backend Server

## Quick Start

### 1. Navigate to Backend Directory

```bash
cd one-01-backend
```

### 2. Install Dependencies (if not done)

```bash
npm install
```

### 3. Configure Environment (Optional)

Edit `.env` file and add your API keys:
- `OPENAI_API_KEY` - For AI processing (optional, works in demo mode without it)
- `ELEVENLABS_API_KEY` - For server-side TTS (optional)

### 4. Start the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Server Information

- **Port:** 3000
- **Local URL:** http://localhost:3000
- **Network URL:** http://172.20.10.2:3000
- **Health Check:** http://localhost:3000/health

## Testing the Server

1. **Check if server is running:**
   ```bash
   curl http://localhost:3000/health
   ```
   
   Or visit in browser: http://localhost:3000/health

2. **Expected response:**
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "uptime": 0.123,
     "connections": 0
   }
   ```

## Connecting from Expo Go

Make sure your `.env` file in the main project has:
```env
EXPO_PUBLIC_SOCKET_SERVER_URL=http://172.20.10.2:3000
```

## Troubleshooting

### Port Already in Use

Change port in `.env`:
```env
PORT=3001
```

### Can't Connect from Phone

1. Make sure server is running
2. Check firewall allows port 3000
3. Ensure phone and computer are on same WiFi
4. Verify IP address is correct (172.20.10.2)

### CORS Errors

Add your Expo URL to `.env`:
```env
CORS_ORIGIN=http://172.20.10.2:8081,exp://172.20.10.2:8081
```

## Server Logs

When a client connects, you'll see:
```
✅ Client connected: <socket-id>
   Session: <session-id>
   User: <user-id>
   Total connections: 1
```

When processing messages:
```
[<session-id>] Received message from user: <message>
[<session-id>] Sending <n> UI components
```

