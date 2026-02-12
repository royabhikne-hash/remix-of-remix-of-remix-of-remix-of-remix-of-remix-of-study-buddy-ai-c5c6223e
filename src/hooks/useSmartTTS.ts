import { useCallback, useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNativeTTS, type ActiveEngine } from './useNativeTTS';

/**
 * Unified TTS Hook - Simple 2-tier system
 * 
 * Pro Plan + chars remaining → Premium Speechify TTS
 * If premium fails or quota exhausted → Web Speech API (free, no limit)
 * Basic Plan → Web Speech API directly (no limit)
 */

export interface SmartTTSOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  language?: string;
}

export interface TTSUsageInfo {
  plan: 'basic' | 'pro';
  ttsUsed: number;
  ttsLimit: number;
  ttsRemaining: number;
  canUsePremium: boolean;
  usingPremium: boolean;
}

interface SmartTTSState {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  currentVoiceId: string;
  usageInfo: TTSUsageInfo | null;
  activeEngine: 'premium' | 'web' | 'none';
}

export interface SpeechifyVoice {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  description?: string;
}

export const SPEECHIFY_VOICES: SpeechifyVoice[] = [
  { id: 'henry', name: 'Henry 🇮🇳', language: 'Hindi/English (India)', languageCode: 'hi-IN', gender: 'male', description: 'Indian accent, Hindi/Hinglish के लिए best' },
  { id: 'natasha', name: 'Natasha 🇮🇳', language: 'Hindi/English (India)', languageCode: 'hi-IN', gender: 'female', description: 'Indian female voice, natural Hindi pronunciation' },
  { id: 'george', name: 'George', language: 'English (UK)', languageCode: 'en-GB', gender: 'male', description: 'British accent, professional' },
  { id: 'cliff', name: 'Cliff', language: 'English (US)', languageCode: 'en-US', gender: 'male', description: 'American accent, clear' },
  { id: 'mrbeast', name: 'MrBeast', language: 'English', languageCode: 'en-US', gender: 'male', description: 'Energetic, fun' },
  { id: 'gwyneth', name: 'Gwyneth', language: 'English', languageCode: 'en-US', gender: 'female', description: 'Calm, professional' },
  { id: 'oliver', name: 'Oliver', language: 'English (UK)', languageCode: 'en-GB', gender: 'male', description: 'British, formal' },
];

const clientAudioCache = new Map<string, string>();

export const useSmartTTS = (studentId: string | null) => {
  const [state, setState] = useState<SmartTTSState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    currentVoiceId: 'henry',
    usageInfo: null,
    activeEngine: 'none',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Web Speech TTS (fallback / basic plan)
  const nativeTTS = useNativeTTS();

  // Fetch subscription status
  const fetchUsageInfo = useCallback(async () => {
    if (!studentId) return;
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_subscription', studentId },
      });
      if (error || data?.error) {
        setState(prev => ({
          ...prev,
          usageInfo: { plan: 'basic', ttsUsed: 0, ttsLimit: 150000, ttsRemaining: 150000, canUsePremium: false, usingPremium: false },
        }));
        return;
      }
      const sub = data?.subscription;
      const plan = sub?.plan || 'basic';
      const ttsUsed = sub?.tts_used || 0;
      const ttsLimit = sub?.tts_limit || 150000;
      const isActive = sub?.is_active ?? true;
      const isExpired = sub?.end_date && new Date(sub.end_date) < new Date();
      const canUsePremium = plan === 'pro' && isActive && !isExpired && ttsUsed < ttsLimit;

      setState(prev => ({
        ...prev,
        usageInfo: { plan, ttsUsed, ttsLimit, ttsRemaining: Math.max(0, ttsLimit - ttsUsed), canUsePremium, usingPremium: canUsePremium },
      }));
    } catch (err) {
      console.error('TTS: Error fetching usage info', err);
    }
  }, [studentId]);

  useEffect(() => { fetchUsageInfo(); }, [fetchUsageInfo]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    nativeTTS.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setState(prev => ({ ...prev, isSpeaking: false, isLoading: false, activeEngine: 'none' }));
  }, [cleanupAudio, nativeTTS]);

  // Speak using Premium TTS (Speechify)
  const speakPremium = useCallback(async (options: SmartTTSOptions): Promise<boolean> => {
    const { text, voiceId = state.currentVoiceId, speed = 1.0 } = options;

    nativeTTS.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const cacheKey = `${voiceId}:${text.substring(0, 200)}`;
    const cachedAudio = clientAudioCache.get(cacheKey);
    if (cachedAudio && cachedAudio.includes('audio_data')) {
      clientAudioCache.delete(cacheKey);
    }

    try {
      let audioDataUrl: string;

      const validCachedAudio = clientAudioCache.get(cacheKey);
      if (validCachedAudio) {
        console.log('TTS: Using client cache (Premium)');
        audioDataUrl = validCachedAudio;
      } else {
        abortControllerRef.current = new AbortController();
        console.log('TTS: Calling Premium TTS...');

        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { text, voiceId, speed, language: 'hi-IN', studentId },
        });

        if (error) throw new Error(error.message || 'TTS request failed');

        if (data?.error === 'FALLBACK_TO_WEB_TTS') {
          console.log('TTS: Server says fallback -', data.reason);
          if (data?.usageInfo) {
            setState(prev => ({
              ...prev,
              usageInfo: { ...prev.usageInfo!, ...data.usageInfo, usingPremium: false },
            }));
          }
          return false;
        }

        if (data?.error) throw new Error(data.error);
        if (!data?.audio) throw new Error('No audio data received');

        audioDataUrl = `data:audio/mp3;base64,${data.audio}`;

        if (data?.usageInfo) {
          setState(prev => ({
            ...prev,
            usageInfo: {
              ...prev.usageInfo!,
              ttsUsed: data.usageInfo.ttsUsed,
              ttsRemaining: data.usageInfo.ttsRemaining,
              canUsePremium: data.usageInfo.canUsePremium,
            },
          }));
        }

        if (clientAudioCache.size > 50) {
          const firstKey = clientAudioCache.keys().next().value;
          if (firstKey) clientAudioCache.delete(firstKey);
        }
        clientAudioCache.set(cacheKey, audioDataUrl);
        console.log(`TTS Premium: ${data.audioSize || 'unknown'} bytes, cached: ${data.cached}`);
      }

      nativeTTS.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;
      audio.playbackRate = Math.max(0.5, Math.min(2.0, speed));

      return new Promise((resolve) => {
        audio.onplay = () => {
          setState(prev => ({ ...prev, isSpeaking: true, isLoading: false, activeEngine: 'premium' }));
        };
        audio.onended = () => {
          setState(prev => ({ ...prev, isSpeaking: false, activeEngine: 'none' }));
          cleanupAudio();
          resolve(true);
        };
        audio.onerror = () => {
          setState(prev => ({ ...prev, isSpeaking: false, isLoading: false, activeEngine: 'none' }));
          cleanupAudio();
          resolve(false);
        };
        audio.play().catch(() => resolve(false));
      });
    } catch (error: any) {
      console.error('Premium TTS Error:', error);
      return false;
    }
  }, [state.currentVoiceId, studentId, cleanupAudio, nativeTTS]);

  // Speak using Web Speech API (no limit)
  const speakWeb = useCallback(async (options: SmartTTSOptions): Promise<boolean> => {
    const { text, speed = 0.9 } = options;

    console.log('TTS: Using Web Speech API');
    cleanupAudio();

    setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));

    try {
      const result = await nativeTTS.speak({
        text,
        rate: speed,
        pitch: 1.0,
        volume: 1.0,
      });

      setState(prev => ({
        ...prev,
        activeEngine: result.engine === 'web' ? 'web' : 'none',
      }));

      return result.success;
    } catch (error) {
      console.error('TTS Web Error:', error);
      return false;
    }
  }, [nativeTTS, cleanupAudio]);

  // Main speak function
  const speak = useCallback(async (options: SmartTTSOptions): Promise<void> => {
    const { text } = options;
    if (!text || text.trim().length === 0) return;

    stop();
    setState(prev => ({ ...prev, isLoading: true, error: null, activeEngine: 'none' }));

    const textLength = text.length;
    const usageInfo = state.usageInfo;

    // Pro plan with remaining chars → try Premium first
    let tryPremium = false;
    if (studentId && usageInfo?.plan === 'pro' && usageInfo.canUsePremium && usageInfo.ttsRemaining >= textLength) {
      tryPremium = true;
      console.log(`TTS: Trying Premium (${usageInfo.ttsRemaining} chars remaining)`);
    }

    let success = false;

    // STEP 1: Try Premium if eligible
    if (tryPremium) {
      success = await speakPremium(options);
      if (success) return;
      console.log('TTS: Premium failed, falling back to Web Speech...');
    }

    // STEP 2: Web Speech API (no limit)
    success = await speakWeb(options);

    if (!success) {
      const errorMsg = 'Voice playback failed. Try again!';
      console.error(`TTS: ❌ ${errorMsg}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: false,
        error: errorMsg,
        activeEngine: 'none',
      }));
    }
  }, [state.usageInfo, studentId, stop, speakPremium, speakWeb]);

  const setVoice = useCallback((voiceId: string) => {
    setState(prev => ({ ...prev, currentVoiceId: voiceId }));
  }, []);

  const previewVoice = useCallback(async (voiceId: string) => {
    const previewText = "नमस्ते! मैं आपका Study Buddy हूं।";
    await speak({ text: previewText, voiceId, language: 'hi-IN' });
  }, [speak]);

  const refreshUsageInfo = useCallback(() => { fetchUsageInfo(); }, [fetchUsageInfo]);

  const getStatusMessage = useCallback((): string | null => {
    if (!state.usageInfo) return null;
    const { plan, ttsRemaining, canUsePremium } = state.usageInfo;
    if (plan === 'basic') return 'Using Web Voice (Basic Plan)';
    if (plan === 'pro' && !canUsePremium) return '⚠️ Voice limit reached - Using Web Voice';
    if (plan === 'pro' && ttsRemaining < 10000) return `⚠️ Low voice quota: ${Math.round(ttsRemaining / 1000)}K chars left`;
    return null;
  }, [state.usageInfo]);

  const getEngineBadge = useCallback((): { label: string; style: 'premium' | 'web' | 'none' } => {
    switch (state.activeEngine) {
      case 'premium': return { label: '✨ Premium', style: 'premium' };
      case 'web': return { label: '🌐 Web Voice', style: 'web' };
      default: return { label: '', style: 'none' };
    }
  }, [state.activeEngine]);

  // Sync with web TTS speaking state
  useEffect(() => {
    if (nativeTTS.isSpeaking) {
      setState(prev => ({ ...prev, isSpeaking: true }));
    } else if (!audioRef.current) {
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, [nativeTTS.isSpeaking]);

  useEffect(() => {
    if (nativeTTS.activeEngine === 'web' && state.activeEngine !== 'premium') {
      setState(prev => ({ ...prev, activeEngine: 'web' }));
    }
  }, [nativeTTS.activeEngine, state.activeEngine]);

  return {
    speak,
    stop,
    isSpeaking: state.isSpeaking || nativeTTS.isSpeaking,
    isLoading: state.isLoading,
    error: state.error,
    isSupported: true,
    currentVoiceId: state.currentVoiceId,
    setVoice,
    voices: SPEECHIFY_VOICES,
    previewVoice,
    usageInfo: state.usageInfo,
    refreshUsageInfo,
    getStatusMessage,
    getEngineBadge,
    isPremiumActive: state.activeEngine === 'premium',
    isAndroidNative: false,
    activeEngine: state.activeEngine,
  };
};

export default useSmartTTS;
