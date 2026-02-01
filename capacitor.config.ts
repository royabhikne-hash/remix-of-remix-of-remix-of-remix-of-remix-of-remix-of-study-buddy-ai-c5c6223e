import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1186b8ac661e4b4fb8145708d243e67a',
  appName: 'EduImprovement AI',
  webDir: 'dist',
  server: {
    url: 'https://1186b8ac-661e-4b4f-b814-5708d243e67a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    TextToSpeech: {
      // Default TTS settings
    }
  }
};

export default config;
