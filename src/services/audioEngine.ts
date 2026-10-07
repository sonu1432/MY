/**
 * AudioEngine manages microphone capture, RMS calculation,
 * speech recognition, and synthetic voice output mirroring Android AudioEngine.kt
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  private isRecording = false;
  private isSpeaking = false;
  private isMuted = false;

  private recognition: any = null;
  private onSpeechResultCallback: ((text: string) => void) | null = null;
  private onAmplitudeCallback: ((rms: number) => void) | null = null;
  private onSpeakingStartCallback: (() => void) | null = null;
  private onSpeakingStopCallback: (() => void) | null = null;

  // Active utterance for cancellation
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakingAnimInterval: number | null = null;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'hi-IN'; // Hinglish friendly Indian accent recognition
      rec.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim();
        if (transcript && this.onSpeechResultCallback) {
          this.onSpeechResultCallback(transcript);
        }
      };
      rec.onerror = (e: any) => {
        console.warn('Speech recognition status:', e.error);
      };
      this.recognition = rec;
    }
  }

  public setOnSpeechResult(cb: (text: string) => void) {
    this.onSpeechResultCallback = cb;
  }

  public setOnAmplitude(cb: (rms: number) => void) {
    this.onAmplitudeCallback = cb;
  }

  public setOnSpeakingStart(cb: () => void) {
    this.onSpeakingStartCallback = cb;
  }

  public setOnSpeakingStop(cb: () => void) {
    this.onSpeakingStopCallback = cb;
  }

  public async startRecording(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.isRecording = true;
      this.startRmsLoop();

      if (this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // already started or resuming
        }
      }

      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable in sandbox:', err);
      // Fallback RMS simulation so visualizer still operates
      this.isRecording = true;
      this.startSimulatedRms();
      return false;
    }
  }

  public stopRecording() {
    this.isRecording = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.onAmplitudeCallback?.(0);
  }

  private startRmsLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.isRecording) return;

      if (this.isSpeaking || this.isMuted) {
        // While speaking, suppress mic RMS or show speaking amplitude
        this.animFrameId = requestAnimationFrame(update);
        return;
      }

      this.analyser!.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.min(1, Math.sqrt(sumSquares / dataArray.length) * 3.5);
      this.onAmplitudeCallback?.(rms);

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  private startSimulatedRms() {
    let t = 0;
    const interval = window.setInterval(() => {
      if (!this.isRecording) {
        clearInterval(interval);
        return;
      }
      if (!this.isSpeaking && !this.isMuted) {
        t += 0.2;
        // Mild ambient pulse
        const ambient = 0.05 + 0.04 * Math.sin(t);
        this.onAmplitudeCallback?.(ambient);
      }
    }, 80);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.onAmplitudeCallback?.(0);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play speech aloud with selected voice characteristics
   */
  public speak(
    text: string,
    voiceName: string = 'Aoede',
    personality: 'gf' | 'professional' | 'assistant' = 'gf'
  ): Promise<void> {
    return new Promise((resolve) => {
      this.interrupt(); // stop any active speech first

      if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis not supported');
        resolve();
        return;
      }

      // Clean emojis and symbols for speech engine
      const cleanText = text.replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]/gu, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      this.currentUtterance = utterance;

      // Map prebuilt voice name to speech synthesis voice characteristics
      const voices = window.speechSynthesis.getVoices();
      const isFemale = ['Aoede', 'Kore', 'Leda', 'Zephyr'].includes(voiceName);

      // Try finding appropriate voice
      let selectedVoice = voices.find((v) =>
        v.lang.startsWith('hi') || v.lang.startsWith('en-IN')
      );
      if (!selectedVoice) {
        selectedVoice = voices.find((v) =>
          isFemale ? v.name.toLowerCase().includes('female') : v.name.toLowerCase().includes('male')
        ) || voices[0];
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Adjust pitch and rate for personality
      if (personality === 'gf') {
        utterance.pitch = isFemale ? 1.25 : 1.05;
        utterance.rate = 1.02;
      } else if (personality === 'professional') {
        utterance.pitch = isFemale ? 1.05 : 0.95;
        utterance.rate = 1.05;
      } else {
        utterance.pitch = isFemale ? 1.15 : 1.0;
        utterance.rate = 1.0;
      }

      this.isSpeaking = true;
      this.onSpeakingStartCallback?.();

      // Start reactive speaking amplitude simulation
      this.startSpeakingAmplitudeLoop();

      utterance.onend = () => {
        this.stopSpeakingState();
        resolve();
      };

      utterance.onerror = () => {
        this.stopSpeakingState();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  private startSpeakingAmplitudeLoop() {
    if (this.speakingAnimInterval) clearInterval(this.speakingAnimInterval);
    let step = 0;
    this.speakingAnimInterval = window.setInterval(() => {
      if (!this.isSpeaking) {
        if (this.speakingAnimInterval) clearInterval(this.speakingAnimInterval);
        return;
      }
      step += 0.3;
      // High-energy dynamic speech waveform
      const rms = 0.35 + 0.45 * Math.abs(Math.sin(step) * Math.cos(step * 1.7));
      this.onAmplitudeCallback?.(rms);
    }, 50);
  }

  private stopSpeakingState() {
    this.isSpeaking = false;
    this.currentUtterance = null;
    if (this.speakingAnimInterval) {
      clearInterval(this.speakingAnimInterval);
      this.speakingAnimInterval = null;
    }
    this.onSpeakingStopCallback?.();
    this.onAmplitudeCallback?.(0);
  }

  /**
   * Interrupt speaking immediately (e.g. Long press mic button)
   */
  public interrupt() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.stopSpeakingState();
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
