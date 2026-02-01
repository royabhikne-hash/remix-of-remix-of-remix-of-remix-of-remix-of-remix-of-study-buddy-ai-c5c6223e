import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

interface TTSOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Native TTS hook that works in Capacitor apps with Web Speech API fallback
 * Provides reliable voice output across all platforms
 */
export const useNativeTTS = () => {
  const [isNative, setIsNative] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  useEffect(() => {
    const checkPlatform = async () => {
      const native = Capacitor.isNativePlatform();
      setIsNative(native);

      if (native) {
        try {
          // Check if native TTS is available
          const languages = await TextToSpeech.getSupportedLanguages();
          setAvailableVoices(languages.languages || []);
          setIsSupported(true);
        } catch (error) {
          console.error('Native TTS not available:', error);
          setIsSupported(false);
        }
      } else {
        // Web fallback - check Web Speech API
        setIsSupported('speechSynthesis' in window);
        if ('speechSynthesis' in window) {
          const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            setAvailableVoices(voices.map(v => v.lang));
          };
          loadVoices();
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
      }
    };

    checkPlatform();
  }, []);

  /**
   * Sanitize text for TTS - remove markdown, emojis, special chars
   */
  const sanitizeText = useCallback((text: string): string => {
    return text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Clean up special chars
      .replace(/[•●○◦▪▫]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  /**
   * Speak text using native TTS or Web Speech API fallback
   */
  const speak = useCallback(async (options: TTSOptions): Promise<void> => {
    const { text, lang = 'hi-IN', rate = 0.9, pitch = 1.0, volume = 1.0 } = options;
    
    const cleanText = sanitizeText(text);
    if (!cleanText) return;

    setIsSpeaking(true);

    try {
      if (isNative) {
        // Use native TTS (Capacitor)
        await TextToSpeech.speak({
          text: cleanText,
          lang,
          rate,
          pitch,
          volume,
        });
      } else {
        // Web Speech API fallback
        await speakWithWebAPI(cleanText, lang, rate, pitch, volume);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      // Try English fallback
      try {
        if (isNative) {
          await TextToSpeech.speak({
            text: cleanText,
            lang: 'en-IN',
            rate,
            pitch,
            volume,
          });
        } else {
          await speakWithWebAPI(cleanText, 'en-IN', rate, pitch, volume);
        }
      } catch (fallbackError) {
        console.error('TTS Fallback Error:', fallbackError);
      }
    } finally {
      setIsSpeaking(false);
    }
  }, [isNative, sanitizeText]);

  /**
   * Web Speech API implementation with optimizations
   */
  const speakWithWebAPI = useCallback((
    text: string,
    lang: string,
    rate: number,
    pitch: number,
    volume: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Web Speech API not supported'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Find best voice for Hindi
      const voices = window.speechSynthesis.getVoices();
      const hindiVoices = voices.filter(v => 
        v.lang.includes('hi') || v.lang.includes('IN')
      );
      
      // Prefer male Hindi voices
      const preferredVoice = hindiVoices.find(v => 
        v.name.toLowerCase().includes('male') ||
        v.name.includes('Madhur') ||
        v.name.includes('Hemant') ||
        v.name.includes('Prabhat')
      ) || hindiVoices[0] || voices.find(v => v.lang.includes('en-IN'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Keep-alive interval for WebView (prevents 15-sec cutoff)
      let keepAliveInterval: NodeJS.Timeout | null = null;
      
      utterance.onstart = () => {
        keepAliveInterval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 10000);
      };

      utterance.onend = () => {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        resolve();
      };

      utterance.onerror = (event) => {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        reject(event.error);
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  /**
   * Stop any ongoing speech
   */
  const stop = useCallback(async () => {
    try {
      if (isNative) {
        await TextToSpeech.stop();
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (error) {
      console.error('Stop TTS Error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [isNative]);

  /**
   * Check if currently speaking
   */
  const checkSpeaking = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      // Native doesn't have a direct check, use state
      return isSpeaking;
    }
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }, [isNative, isSpeaking]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    isNative,
    availableVoices,
    checkSpeaking,
    sanitizeText,
  };
};

export default useNativeTTS;
