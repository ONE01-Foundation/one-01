# ONE Platform - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `EXPO_PUBLIC_SOCKET_SERVER_URL`: Your Socket.io server URL (optional for now)

### 3. Start Development Server

```bash
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- `w` for web browser

## Project Structure

```
one-01/
├── src/
│   ├── components/      # UI Components
│   │   ├── AgentWorkspace.tsx    # Main workspace layout
│   │   ├── DynamicUI.tsx          # Renders dynamic UI components
│   │   ├── ConversationView.tsx  # Chat interface
│   │   ├── AgentStatusIndicator.tsx # Agent status display
│   │   └── InputBar.tsx           # Message input
│   ├── stores/          # Zustand State Management
│   │   ├── agentStore.ts          # Agent state
│   │   ├── conversationStore.ts   # Messages
│   │   ├── uiStore.ts             # UI components state
│   │   └── connectionStore.ts     # Connection status
│   ├── services/        # External Services
│   │   ├── socketService.ts       # Socket.io client
│   │   ├── supabaseService.ts     # Supabase client
│   │   └── voiceService.ts        # Audio recording/TTS
│   ├── lenses/          # Agent Capabilities
│   │   ├── baseLens.ts            # Base lens class
│   │   ├── healthLens.ts         # Health capabilities
│   │   ├── financeLens.ts        # Finance capabilities
│   │   └── careerLens.ts         # Career capabilities
│   ├── types/           # TypeScript Types
│   │   ├── index.ts              # Core types
│   │   └── lenses.ts             # Lens-specific types
│   └── utils/           # Utilities
│       ├── constants.ts          # App constants
│       └── session.ts            # Session management
├── App.tsx              # Main app component
└── package.json
```

## Key Features Implemented

### ✅ Core Architecture
- [x] Expo + TypeScript setup
- [x] Zustand state management
- [x] Socket.io client integration
- [x] Supabase integration layer
- [x] Voice service (expo-av)

### ✅ Lens System
- [x] Base lens architecture
- [x] Health lens (nutrition, fitness)
- [x] Finance lens (budgeting, investing)
- [x] Career lens (job search, skills)

### ✅ UI Components
- [x] Agent workspace (Zoom-like interface)
- [x] Dynamic UI renderer
- [x] Conversation view
- [x] Agent status indicator
- [x] Input bar (text + voice)

### ✅ State Management
- [x] Agent store
- [x] Conversation store
- [x] UI store
- [x] Connection store

## Next Steps

### Backend Setup Required

1. **Supabase Database Schema**
   - Create tables: `goals`, `messages`, `sessions`
   - Set up Row Level Security (RLS) policies
   - Configure real-time subscriptions

2. **Socket.io Server**
   - Set up Node.js/Express server
   - Implement AI agent orchestration
   - Handle protocol execution
   - Send UI updates to clients

3. **AI Integration**
   - Configure OpenAI API
   - Set up Whisper for STT
   - Configure ElevenLabs or Azure TTS
   - Implement agent reasoning logic

### Development Tasks

1. **Complete Voice Integration**
   - Implement TTS API calls
   - Add audio playback controls
   - Handle recording permissions

2. **Enhance UI Components**
   - Add more component types (charts, maps, etc.)
   - Improve animations
   - Add loading states

3. **Protocol Execution**
   - Implement protocol step execution
   - Add validation logic
   - Handle user input processing

4. **Lens Expansion**
   - Add Home lens
   - Add Social lens
   - Create custom lens templates

## Testing

Currently, the app runs in demo mode without a backend. To test:

1. Start the app: `npm start`
2. Open in simulator/emulator
3. Type a message - you'll see a simulated agent response
4. UI components can be added programmatically via the UI store

## Troubleshooting

### Common Issues

1. **Metro bundler cache issues**
   ```bash
   npm start -- --clear
   ```

2. **TypeScript errors**
   - Ensure all dependencies are installed
   - Check `tsconfig.json` paths are correct

3. **Reanimated not working**
   - Ensure `babel.config.js` includes the Reanimated plugin
   - Restart Metro bundler after changes

4. **Socket connection fails**
   - Check `EXPO_PUBLIC_SOCKET_SERVER_URL` in `.env`
   - App will work without socket (demo mode)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Supabase Documentation](https://supabase.com/docs)

