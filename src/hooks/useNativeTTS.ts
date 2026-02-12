import { useCallback, useEffect, useState, useRef } from 'react';

interface TTSOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

/**
 * Web Speech TTS Hook - Simple Web Speech API only
 * 
 * No character limit. No Android Native TTS.
 * Just browser speechSynthesis with chunking for long text.
 */

export type ActiveEngine = 'web' | 'none';

export const useNativeTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>('none');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          console.log('TTS: Web Speech loaded', voices.length, 'voices');
          setAvailableVoices(voices);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Retry for late-loading voices
      [300, 800, 1500, 3000].forEach(delay =>
        setTimeout(() => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) setAvailableVoices(prev => prev.length === 0 ? voices : prev);
        }, delay)
      );
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const sanitizeText = useCallback((text: string): string => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const splitIntoChunks = useCallback((text: string, maxLength: number = 180): string[] => {
    if (text.length <= maxLength) return [text];
    // Split on Hindi purna viram, period, exclamation, question mark, or comma for smaller chunks
    const sentences = text.split(/(?<=[।.!?,;])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        // If a single sentence is too long, split by words
        if (sentence.length > maxLength) {
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= maxLength) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = word;
            }
          }
          if (wordChunk) currentChunk = wordChunk;
          else currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.filter(c => c.trim().length > 0);
  }, []);

  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = availableVoices.length > 0
      ? availableVoices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    if (voices.length === 0) return null;

    const hindiMaleNames = [
      'google हिन्दी', 'google hindi', 'madhur', 'hemant', 'prabhat',
      'microsoft madhur', 'samsung hindi male', 'hindi male', 'hindi india male', 'male hindi', 'vani'
    ];
    const hindiMaleVoice = voices.find(v => {
      const n = v.name.toLowerCase();
      const isHindi = v.lang === 'hi-IN' || v.lang.startsWith('hi');
      const isMale = hindiMaleNames.some(name => n.includes(name)) ||
        (!n.includes('female') && !n.includes('swara') && !n.includes('lekha'));
      return isHindi && isMale;
    });
    if (hindiMaleVoice) return hindiMaleVoice;

    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) return hindiVoice;
    const hindiAny = voices.find(v => v.lang.startsWith('hi'));
    if (hindiAny) return hindiAny;
    const indianEnglishMale = voices.find(v => {
      const n = v.name.toLowerCase();
      return v.lang === 'en-IN' && (n.includes('ravi') || n.includes('male') || (!n.includes('female') && !n.includes('heera')));
    });
    if (indianEnglishMale) return indianEnglishMale;
    const indianEnglish = voices.find(v => v.lang === 'en-IN');
    if (indianEnglish) return indianEnglish;
    const english = voices.find(v => v.lang.startsWith('en'));
    if (english) return english;
    return voices[0] || null;
  }, [availableVoices]);

  const speakChunkWeb = useCallback((
    text: string,
    voice: SpeechSynthesisVoice | null,
    rate: number,
    pitch: number,
    volume: number,
  ): Promise<{ completed: boolean; stoppedEarly: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) {
        resolve({ completed: false, stoppedEarly: false });
        return;
      }

      const startTime = Date.now();
      const minExpectedDuration = 500;
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'hi-IN';
      }
      utterance.rate = Math.max(0.1, Math.min(10, rate));
      utterance.pitch = Math.max(0, Math.min(2, pitch));
      utterance.volume = Math.max(0, Math.min(1, volume));

      let settled = false;
      const settle = (result: { completed: boolean; stoppedEarly: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimeout);
        clearInterval(resumeWatchdog);
        resolve(result);
      };

      const safetyTimeout = setTimeout(() => {
        settle({ completed: false, stoppedEarly: true, error: 'timeout' });
      }, Math.max(30000, text.length * 200));

      // Watchdog: detect if Chrome silently stops
      const resumeWatchdog = setInterval(() => {
        if (settled || isCancelledRef.current) {
          clearInterval(resumeWatchdog);
          return;
        }
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          const elapsed = Date.now() - startTime;
          const stoppedEarly = text.length > 30 && elapsed < minExpectedDuration;
          settle({ completed: true, stoppedEarly });
        }
      }, 300);

      utterance.onend = () => {
        const elapsed = Date.now() - startTime;
        const stoppedEarly = text.length > 30 && elapsed < minExpectedDuration;
        settle({ completed: true, stoppedEarly });
      };

      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          // These are expected when we cancel between chunks - not real errors
          settle({ completed: true, stoppedEarly: false });
          return;
        }
        console.error('TTS Web chunk error:', event.error);
        settle({ completed: false, stoppedEarly: false, error: event.error });
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        settle({ completed: false, stoppedEarly: false, error: String(e) });
      }
    });
  }, []);

  const tryWebSpeech = useCallback(async (
    cleanText: string, rate: number, pitch: number, volume: number, voiceName?: string | null
  ): Promise<boolean> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

    const voices = window.speechSynthesis.getVoices();

    let voice: SpeechSynthesisVoice | null = null;
    if (voiceName) {
      voice = voices.find(v => v.name === voiceName) || null;
    }
    if (!voice) voice = getBestVoice();

    // Use 200 char chunks - small enough for Chrome stability, large enough for smooth flow
    const chunks = splitIntoChunks(cleanText, 200);
    chunksRef.current = chunks;
    currentChunkIndexRef.current = 0;

    console.log(`TTS Web: Starting ${chunks.length} chunks for ~${cleanText.split(/\s+/).length} words`);
    setActiveEngine('web');

    // Chrome pause bug workaround: heartbeat every 4s
    heartbeatRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setTimeout(() => window.speechSynthesis.resume(), 30);
      }
    }, 4000);

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (let i = 0; i < chunks.length; i++) {
      if (isCancelledRef.current) break;
      currentChunkIndexRef.current = i;
      const chunkText = chunks[i];

      const result = await speakChunkWeb(chunkText, voice, rate, pitch, volume);

      if (result.stoppedEarly || result.error) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error('TTS: Too many consecutive failures, stopping');
          break;
        }
        // Retry this chunk with a fresh engine reset
        window.speechSynthesis.cancel();
        await new Promise(r => setTimeout(r, 250));
        if (!isCancelledRef.current) {
          const retryResult = await speakChunkWeb(chunkText, voice, rate, pitch, volume);
          if (!retryResult.completed || retryResult.stoppedEarly) {
            // Second retry with longer pause
            window.speechSynthesis.cancel();
            await new Promise(r => setTimeout(r, 500));
            if (!isCancelledRef.current) {
              await speakChunkWeb(chunkText, voice, rate, pitch, volume);
            }
          } else {
            consecutiveFailures = 0; // Reset on success
          }
        }
      } else {
        consecutiveFailures = 0; // Reset on success
      }

      // Seamless transition: NO cancel between chunks, just tiny delay
      if (i < chunks.length - 1 && !isCancelledRef.current) {
        await new Promise(r => setTimeout(r, 30));
      }
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    return true;
  }, [getBestVoice, splitIntoChunks, speakChunkWeb]);

  // ============= MAIN SPEAK FUNCTION =============
  // Simple: Web Speech API only, no character limit
  const speak = useCallback((options: TTSOptions): Promise<{ success: boolean; engine: ActiveEngine; error?: string }> => {
    const { text, rate = 0.9, pitch = 1.0, volume = 1.0, voiceName } = options;

    return (async () => {
      if (!isSupported) {
        return { success: false, engine: 'none' as ActiveEngine, error: 'TTS not supported on this device' };
      }

      const cleanText = sanitizeText(text);
      if (!cleanText) {
        return { success: true, engine: 'none' as ActiveEngine };
      }

      // Cancel any ongoing speech
      stop();
      isCancelledRef.current = false;
      await new Promise(r => setTimeout(r, 60));

      setIsSpeaking(true);

      try {
        const webSuccess = await tryWebSpeech(cleanText, rate, pitch, volume, voiceName || selectedVoiceName);
        if (webSuccess && !isCancelledRef.current) {
          return { success: true, engine: 'web' as ActiveEngine };
        }

        // Web Speech failed
        console.error('TTS: ❌ Web Speech failed!');
        setActiveEngine('none');
        return {
          success: false,
          engine: 'none' as ActiveEngine,
          error: 'Voice playback failed. Device may not support TTS.'
        };
      } finally {
        setIsSpeaking(false);
        utteranceRef.current = null;
      }
    })();
  }, [isSupported, sanitizeText, selectedVoiceName, tryWebSpeech]);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    utteranceRef.current = null;
    chunksRef.current = [];
    currentChunkIndexRef.current = 0;
    setIsSpeaking(false);
    setActiveEngine('none');
  }, []);

  const getHindiVoices = useCallback((): SpeechSynthesisVoice[] => {
    const voices = availableVoices.length > 0
      ? availableVoices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    return voices.filter(v =>
      v.lang.startsWith('hi') || v.lang === 'en-IN' || v.lang.startsWith('en')
    );
  }, [availableVoices]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    isNative: false,
    availableVoices,
    sanitizeText,
    selectedVoiceName,
    setSelectedVoiceName,
    getHindiVoices,
    useAndroidNative: false,
    activeEngine,
  };
};

export default useNativeTTS;
