# ONE Platform - AI Agent Operating System

A React Native (Expo) application that functions as a "live screen-sharing conversation with an AI agent" - a personal AI operating system where users collaborate with their AI agent in real-time to accomplish life goals through dynamic, visual protocol execution.

## 🎯 Core Philosophy

- **Not a chatbot** - This is a collaborative workspace where UI builds progressively during conversation
- **Not an app** - This is an operating system for human-AI agency
- **Zoom-like feel** - User sees the agent "building" UI components in real-time, similar to collaborative design tools

## 🏗️ Architecture

### Modular Agent System ("Lenses")

Each lens is a capability module that can be attached to the main agent:

- **HealthLens**: nutrition, fitness, sleep, medical
- **FinanceLens**: budgeting, investing, savings, debt
- **CareerLens**: job search, skills, networking, projects
- **HomeLens**: maintenance, renovation, organization
- **SocialLens**: relationships, events, communication

## 🛠️ Tech Stack

### Frontend
- **Framework**: Expo (React Native) - latest stable version
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand (lightweight, modular)
- **Real-time Communication**: Socket.io-client
- **Animations**: Reanimated 3 + Moti
- **Voice**: expo-av (recording) + Web Audio API polyfills
- **Storage**: expo-secure-store (encrypted local vault)

### Backend
- **Database & Auth**: Supabase
  - PostgreSQL with Row Level Security (RLS)
  - Real-time subscriptions
  - Edge Functions for API logic
  - Storage for audio/media files

- **AI Services**:
  - OpenAI API (GPT-4 for orchestration, Whisper for STT)
  - ElevenLabs API (or Azure TTS) for voice synthesis
  - Custom agent orchestration layer

- **Real-time**: Socket.io server (Node.js/Express or Supabase Edge Functions)

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd one-01
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
- Supabase URL and keys
- Socket.io server URL
- API keys (OpenAI, ElevenLabs)

4. Start the development server:
```bash
npm start
```

## 🚀 Usage

### Running on Different Platforms

- **iOS**: `npm run ios`
- **Android**: `npm run android`
- **Web**: `npm run web`

### Development

The app uses Expo's development tools. Press:
- `i` to open iOS simulator
- `a` to open Android emulator
- `w` to open web browser

## 📁 Project Structure

```
one-01/
├── src/
│   ├── components/      # React Native UI components
│   │   ├── AgentWorkspace.tsx
│   │   ├── DynamicUI.tsx
│   │   ├── ConversationView.tsx
│   │   └── ...
│   ├── stores/          # Zustand state management
│   │   ├── agentStore.ts
│   │   ├── conversationStore.ts
│   │   ├── uiStore.ts
│   │   └── ...
│   ├── services/        # External service integrations
│   │   ├── socketService.ts
│   │   ├── supabaseService.ts
│   │   ├── voiceService.ts
│   │   └── ...
│   ├── lenses/          # Modular agent capabilities
│   │   ├── baseLens.ts
│   │   ├── healthLens.ts
│   │   ├── financeLens.ts
│   │   └── ...
│   ├── types/           # TypeScript type definitions
│   │   ├── index.ts
│   │   └── lenses.ts
│   └── utils/           # Utility functions
│       ├── constants.ts
│       └── session.ts
├── App.tsx              # Main app component
├── package.json
└── README.md
```

## 🔧 Configuration

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Set up database tables (see backend documentation)
4. Configure Row Level Security policies

### Socket.io Server

The app expects a Socket.io server running for real-time communication. You'll need to set up a backend server that:
- Handles Socket.io connections
- Processes AI agent requests
- Manages protocol execution
- Sends UI updates to clients

## 🎨 Features

- **Real-time UI Building**: Watch the agent build UI components as you converse
- **Modular Lenses**: Activate different capability modules (health, finance, career, etc.)
- **Protocol Execution**: Agents execute structured protocols to accomplish goals
- **Voice Integration**: Record audio and receive text-to-speech responses
- **Secure Storage**: Encrypted local storage for sensitive data

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📧 Contact

[Add contact information here]

