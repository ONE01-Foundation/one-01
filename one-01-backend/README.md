# ONE Platform Backend Server

Socket.io backend server for real-time AI agent communication.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

Edit `.env`:
- `PORT`: Server port (default: 3000)
- `CLIENT_URL`: Your Expo app URL
- `OPENAI_API_KEY`: Your OpenAI API key (optional, for AI processing)
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (optional)

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://0.0.0.0:3000` (accessible from your network).

### 4. Test Connection

Visit: `http://localhost:3000/health`

You should see:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 0.123,
  "connections": 0
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `CLIENT_URL`: Client URL for CORS
- `CORS_ORIGIN`: Comma-separated list of allowed origins
- `OPENAI_API_KEY`: OpenAI API key for GPT-4 processing
- `ELEVENLABS_API_KEY`: ElevenLabs API key (optional)

### Network Access

The server listens on `0.0.0.0` (all interfaces), so it's accessible from:
- Localhost: `http://localhost:3000`
- Network: `http://172.20.10.2:3000` (your local IP)

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "connections": 5
}
```

## Socket.io Events

### Client → Server

- `message`: Send a message to the agent
- `protocol_start`: Start a protocol execution
- `voice_data`: Send voice/audio data

### Server → Client

- `agent_status`: Agent status updates
- `message`: Agent response messages
- `ui_update`: UI component updates
- `protocol_update`: Protocol execution updates
- `error`: Error notifications

## Development

### Run in Development Mode

```bash
npm run dev
```

Uses `tsx watch` for hot reloading.

### Build for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
one-01-backend/
├── src/
│   ├── server.ts           # Main server file
│   ├── handlers/           # Event handlers
│   │   ├── messageHandler.ts
│   │   └── protocolHandler.ts
│   ├── services/           # Business logic
│   │   └── openAIService.ts
│   └── types/              # TypeScript types
│       └── index.ts
├── package.json
├── tsconfig.json
└── .env
```

## Troubleshooting

### Port Already in Use

Change the port in `.env`:
```env
PORT=3001
```

### CORS Errors

Add your client URL to `CORS_ORIGIN` in `.env`:
```env
CORS_ORIGIN=http://172.20.10.2:8081,exp://172.20.10.2:8081
```

### OpenAI Not Working

If `OPENAI_API_KEY` is not set, the server runs in demo mode with simulated responses.

## License

MIT

