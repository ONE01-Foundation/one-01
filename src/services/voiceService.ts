/**
 * Voice Service - Audio recording and text-to-speech
 */

import { createAudioPlayer, setAudioModeAsync, requestRecordingPermissionsAsync, type AudioPlayer } from 'expo-audio';
import { AudioRecording, VoiceConfig } from '../types';
import { ELEVENLABS_VOICE_ID } from '../utils/constants';
import { supabaseService } from './supabaseService';

class VoiceService {
  private player: AudioPlayer | null = null;
  private voiceConfig: VoiceConfig = {
    provider: 'elevenlabs',
    language: 'en-US',
    speed: 1.0,
  };

  async initialize(): Promise<void> {
    try {
      await requestRecordingPermissionsAsync();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  // Recording lives at the screen level now (expo-audio's recorder is a hook —
  // see HomeScreen's useAudioRecorder). Kept as no-ops for the archived InputBar.
  async startRecording(): Promise<AudioRecording | null> {
    return null;
  }

  async stopRecording(): Promise<AudioRecording | null> {
    return null;
  }

  async playTextToSpeech(text: string, config?: Partial<VoiceConfig>): Promise<void> {
    try {
      const finalConfig = { ...this.voiceConfig, ...config };
      const audioUrl = await this.generateTTS(text, finalConfig);

      if (audioUrl) {
        await this.stopPlayback();
        this.player = createAudioPlayer({ uri: audioUrl });
        this.player.play();
      }
    } catch (error) {
      console.error('Failed to play TTS:', error);
    }
  }

  private async generateTTS(text: string, config: VoiceConfig): Promise<string | null> {
    if (config.provider === 'elevenlabs') {
      return await this.generateElevenLabsTTS(text, config);
    }

    console.log('TTS provider not implemented:', config.provider);
    return null;
  }

  private async generateElevenLabsTTS(text: string, config: VoiceConfig): Promise<string | null> {
    try {
      const client = supabaseService.getClient();
      if (!client) {
        console.warn('Supabase not initialized — cannot call TTS edge function');
        return null;
      }

      const voiceId = config.voiceId || ELEVENLABS_VOICE_ID;

      const { data, error } = await client.functions.invoke('tts', {
        body: {
          text,
          voice_id: voiceId,
          model_id: 'eleven_monolingual_v1',
          stability: 0.5,
          similarity_boost: 0.5,
          speed: config.speed || 1.0,
        },
      });

      if (error) {
        throw new Error(error.message ?? 'TTS request failed');
      }

      const blob = data instanceof Blob ? data : new Blob([data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      return null;
    }
  }

  async stopPlayback(): Promise<void> {
    if (this.player) {
      try { this.player.remove(); } catch { /* already released */ }
      this.player = null;
    }
  }

  setVoiceConfig(config: Partial<VoiceConfig>): void {
    this.voiceConfig = { ...this.voiceConfig, ...config };
  }

  getVoiceConfig(): VoiceConfig {
    return this.voiceConfig;
  }
}

export const voiceService = new VoiceService();

