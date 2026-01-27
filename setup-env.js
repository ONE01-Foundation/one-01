/**
 * Setup script to create .env file with your local IP
 * Run: node setup-env.js
 */

const fs = require('fs');
const path = require('path');

// Your local IP address (detected or set manually)
const LOCAL_IP = '172.20.10.2'; // Update this if needed

const envTemplate = `# ONE Platform Environment Variables
# Generated automatically - update with your actual API keys

# Socket.io Server URL
# Using your local IP for Expo Go testing
EXPO_PUBLIC_SOCKET_SERVER_URL=http://${LOCAL_IP}:3000

# Supabase Configuration (Optional for initial testing)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# ElevenLabs API Configuration
# Get your API key from: https://elevenlabs.io/app/settings/api-keys
# Make sure to enable "Voice Generation: Access" permission
EXPO_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
EXPO_PUBLIC_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
`;

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('📝 Please update it manually with your API keys.');
  console.log('\nCurrent .env location:', envPath);
} else {
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ .env file created successfully!');
  console.log('📝 Location:', envPath);
  console.log('\n⚠️  IMPORTANT: Update the .env file with your actual API keys:');
  console.log('   1. EXPO_PUBLIC_ELEVENLABS_API_KEY - from ElevenLabs dashboard');
  console.log('   2. EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (optional)');
  console.log('\n💡 Your local IP is set to:', LOCAL_IP);
  console.log('   Socket server URL:', `http://${LOCAL_IP}:3000`);
}

