/**
 * ONE Platform Backend Server
 * Socket.io server for real-time AI agent communication
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { messageHandler } from './handlers/messageHandler.js';
import { protocolHandler } from './handlers/protocolHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:8081',
    'http://172.20.10.2:8081',
    'exp://172.20.10.2:8081'
  ],
  methods: ['GET', 'POST'],
  credentials: true
};

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: io.sockets.sockets.size
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  const sessionId = socket.handshake.query.sessionId as string;
  const userId = socket.handshake.query.userId as string;

  console.log(`✅ Client connected: ${socket.id}`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   User: ${userId}`);
  console.log(`   Total connections: ${io.sockets.sockets.size}`);

  // Store session info
  socket.data = {
    sessionId,
    userId,
    connectedAt: new Date()
  };

  // Send initial connection confirmation
  socket.emit('agent_status', {
    type: 'agent_status',
    payload: {
      status: 'idle',
      message: 'Agent ready and connected'
    },
    timestamp: new Date(),
    sessionId
  });

  // Handle incoming messages
  socket.on('message', async (event) => {
    try {
      await messageHandler.handleMessage(socket, event, io);
    } catch (error) {
      console.error(`[${sessionId}] Error handling message:`, error);
      socket.emit('error', {
        type: 'error',
        payload: { 
          message: 'Failed to process message',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date(),
        sessionId
      });
    }
  });

  // Handle protocol execution requests
  socket.on('protocol_start', async (event) => {
    try {
      await protocolHandler.handleProtocolStart(socket, event, io);
    } catch (error) {
      console.error(`[${sessionId}] Error starting protocol:`, error);
      socket.emit('error', {
        type: 'error',
        payload: { 
          message: 'Failed to start protocol',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date(),
        sessionId
      });
    }
  });

  // Handle voice data (for STT)
  socket.on('voice_data', async (event) => {
    try {
      await messageHandler.handleVoiceData(socket, event, io);
    } catch (error) {
      console.error(`[${sessionId}] Error handling voice data:`, error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Total connections: ${io.sockets.sockets.size}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`[${sessionId}] Socket error:`, error);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all interfaces

httpServer.listen(PORT, HOST, () => {
  console.log('\n🚀 ONE Platform Backend Server');
  console.log('═══════════════════════════════════════');
  console.log(`📡 Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 WebSocket endpoint: ws://${HOST}:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
  console.log(`📱 Network access: http://172.20.10.2:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════');
  console.log(`\n📋 Configuration:`);
  console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured (demo mode)'}`);
  console.log(`   CORS Origins: ${corsOptions.origin.join(', ')}`);
  console.log(`\n⏳ Waiting for connections...\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

