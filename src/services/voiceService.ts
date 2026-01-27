/**
 * Voice Service - Audio recording and text-to-speech
 */

import { Audio } from 'expo-av';
import { AudioRecording, VoiceConfig } from '../types';
import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from '../utils/constants';

class VoiceService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private voiceConfig: VoiceConfig = {
    provider: 'elevenlabs',
    language: 'en-US',
    speed: 1.0,
  };

  async initialize(): Promise<void> {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  async startRecording(): Promise<AudioRecording | null> {
    try {
      if (this.recording) {
        await this.stopRecording();
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;
      return null; // Recording is in progress
    } catch (error) {
      console.error('Failed to start recording:', error);
      return null;
    }
  }

  async stopRecording(): Promise<AudioRecording | null> {
    if (!this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      const status = await this.recording.getStatusAsync();

      const recording: AudioRecording = {
        uri: uri || '',
        duration: status.durationMillis ? status.durationMillis / 1000 : 0,
        format: 'm4a',
      };

      this.recording = null;
      return recording;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = null;
      return null;
    }
  }

  async playTextToSpeech(text: string, config?: Partial<VoiceConfig>): Promise<void> {
    try {
      const finalConfig = { ...this.voiceConfig, ...config };
      
      // This would integrate with your TTS provider (ElevenLabs, Azure, OpenAI)
      // For now, this is a placeholder
      const audioUrl = await this.generateTTS(text, finalConfig);
      
      if (audioUrl) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );
        this.sound = sound;

        await sound.playAsync();
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
      if (!ELEVENLABS_API_KEY) {
        console.warn('ElevenLabs API key not configured');
        return null;
      }

      const voiceId = config.voiceId || ELEVENLABS_VOICE_ID;
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              speed: config.speed || 1.0
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Convert response to blob and create object URL
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      return null;
    }
  }

  async stopPlayback(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
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

