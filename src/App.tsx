import React, { useState, useEffect, useRef } from 'react';
import {
  AssistantSettings,
  OrbState,
  ChatMessage,
  AppCommand,
} from './types/assistant';
import { AudioEngine } from './services/audioEngine';
import { CommandParser } from './services/commandParser';
import { askGemini } from './services/geminiService';
import { OrbAnimationCanvas } from './components/OrbAnimationCanvas';
import { WaveformCanvas } from './components/WaveformCanvas';
import { ChatHistory } from './components/ChatHistory';
import { SettingsModal } from './components/SettingsModal';
import { IncomingCallDialog } from './components/IncomingCallDialog';
import { FloatingOrbOverlay } from './components/FloatingOrbOverlay';
import { SimulatedPhoneActions } from './components/SimulatedPhoneActions';
import { AndroidProjectExplorer } from './components/AndroidProjectExplorer';
import {
  Settings,
  Mic,
  MicOff,
  PhoneCall,
  Layers,
  Code2,
  Send,
  Zap,
  Volume2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

const INITIAL_SETTINGS: AssistantSettings = {
  apiKey: '',
  userName: 'Sonu',
  personalityMode: 'gf',
  geminiModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
  geminiVoice: 'Aoede',
  primeContacts: [
    { id: '1', name: 'Priya', number: '+919876543210', relationship: 'Close Friend' },
    { id: '2', name: 'Mom', number: '+919123456789', relationship: 'Family' },
  ],
  accessibilityEnabled: true,
  overlayEnabled: false,
  keepAliveSeconds: 8,
};

export default function App() {
  const [settings, setSettings] = useState<AssistantSettings>(() => {
    const saved = localStorage.getItem('myra_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_SETTINGS;
  });

  // Core State
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [amplitude, setAmplitude] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Tap karke bolo 💬');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [redOverlayAlpha, setRedOverlayAlpha] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState<string>('');

  // Status Bar Telemetry
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [batteryLevel] = useState<number>(94);
  const [ramUsage] = useState<string>('3.4 GB / 8 GB');

  // Modals & Overlays
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState<boolean>(false);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState<{
    active: boolean;
    callerName: string;
    callerNumber: string;
    announcement: string;
    isListeningDecision: boolean;
  } | null>(null);

  // Simulated Phone Actions State
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(70);
  const [flashlightOn, setFlashlightOn] = useState<boolean>(false);
  const [wifiOn, setWifiOn] = useState<boolean>(true);
  const [bluetoothOn, setBluetoothOn] = useState<boolean>(true);
  const [toastAction, setToastAction] = useState<string | null>(null);

  // Audio Engine Ref
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // Clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save Settings
  const handleSaveSettings = (newSettings: AssistantSettings) => {
    setSettings(newSettings);
    localStorage.setItem('myra_settings', JSON.stringify(newSettings));
  };

  // Trigger Toast Notification
  const showToast = (text: string) => {
    setToastAction(text);
    setTimeout(() => {
      setToastAction(null);
    }, 2800);
  };

  // Initialize AudioEngine
  useEffect(() => {
    const engine = new AudioEngine();
    audioEngineRef.current = engine;

    engine.setOnAmplitude((rms) => {
      setAmplitude(rms);
    });

    engine.setOnSpeakingStart(() => {
      setOrbState('speaking');
      setStatusText('Bol rahi hoon...');
      setRedOverlayAlpha(0.08);
    });

    engine.setOnSpeakingStop(() => {
      setOrbState('listening');
      setStatusText('Sun rahi hoon...');
      setRedOverlayAlpha(0);
    });

    // Voice recognition listener
    engine.setOnSpeechResult((transcript) => {
      if (incomingCall && incomingCall.active && incomingCall.isListeningDecision) {
        handleCallVoiceDecision(transcript);
        return;
      }
      handleUserVoiceInput(transcript);
    });

    return () => {
      engine.stopRecording();
    };
  }, [settings, incomingCall]);

  // Initial Greet Flow
  useEffect(() => {
    const timer = setTimeout(() => {
      sendInitialGreeting();
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const sendInitialGreeting = async () => {
    const name = settings.userName;
    let greetText = '';
    if (settings.personalityMode === 'gf') {
      greetText = `Hey ${name}! Main aa gayi hoon. Kya help chahiye tumhe? ❤️`;
    } else if (settings.personalityMode === 'professional') {
      greetText = `Good day ${name}. MYRA is online and ready to assist you.`;
    } else {
      greetText = `Hello ${name}! Main MYRA hoon. Kaise help karun aapki?`;
    }

    setMessages([
      {
        id: Date.now().toString(),
        text: greetText,
        isUser: false,
        timestamp: Date.now(),
      },
    ]);

    audioEngineRef.current?.speak(greetText, settings.geminiVoice, settings.personalityMode);
  };

  // Process User Voice or Text Input
  const handleUserVoiceInput = async (userInput: string) => {
    if (!userInput.trim()) return;

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: userInput,
      isUser: true,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Check CommandParser
    const command = CommandParser.parse(userInput);
    if (command) {
      executePhoneCommand(command);
      return;
    }

    // Conversational flow via Gemini
    setOrbState('thinking');
    setStatusText('Thinking...');

    try {
      const reply = await askGemini({
        message: userInput,
        history: messages,
        personality: settings.personalityMode,
        userName: settings.userName,
        voice: settings.geminiVoice,
        apiKey: settings.apiKey,
      });

      const myraMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: reply,
        isUser: false,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, myraMsg]);

      await audioEngineRef.current?.speak(reply, settings.geminiVoice, settings.personalityMode);
    } catch (err) {
      console.error(err);
      setStatusText('Tap karke bolo 💬');
      setOrbState('idle');
    }
  };

  // Execute Phone Commands
  const executePhoneCommand = async (command: AppCommand) => {
    showToast(command.description);

    let confirmationText = '';

    switch (command.type) {
      case 'OPEN_APP': {
        const appName = command.params.app_name;
        setActiveApp(appName);
        confirmationText =
          settings.personalityMode === 'gf'
            ? `Haanji! ${appName.toUpperCase()} khol diya maine 😊`
            : `Launching ${appName.toUpperCase()}.`;
        break;
      }
      case 'CLOSE_APP': {
        if (!settings.accessibilityEnabled) {
          showToast('Accessibility Service is OFF');
          confirmationText = 'Kripya Accessibility Service ko settings se enable karein.';
        } else {
          setActiveApp(null);
          confirmationText =
            settings.personalityMode === 'gf'
              ? 'App band kar diya gaya ❤️'
              : 'Application closed via Accessibility Service.';
        }
        break;
      }
      case 'CALL': {
        const name = command.params.name;
        confirmationText =
          settings.personalityMode === 'gf'
            ? `Abhi ${name} ko call milati hoon!`
            : `Placing cellular call to ${name}.`;
        break;
      }
      case 'PRIME_CALL': {
        const idx = parseInt(command.params.index || '0', 10);
        const contact = settings.primeContacts[idx] || settings.primeContacts[0];
        if (contact) {
          confirmationText =
            settings.personalityMode === 'gf'
              ? `Haan ${settings.userName}! Tumhare close friend ${contact.name} ko call laga rahi hoon ❤️`
              : `Calling prime contact ${contact.name} (${contact.number}).`;
        } else {
          confirmationText = 'Settings mein koi prime contact nahi mila.';
        }
        break;
      }
      case 'PRIME_MSG': {
        const contact = settings.primeContacts[0];
        if (contact) {
          confirmationText =
            settings.personalityMode === 'gf'
              ? `Aww, ${contact.name} ke liye message composer open kar diya!`
              : `Composing message for ${contact.name}.`;
        }
        break;
      }
      case 'VOLUME_UP': {
        setVolumeLevel((prev) => Math.min(100, prev + 15));
        confirmationText =
          settings.personalityMode === 'gf'
            ? 'Volume badha diya hai!'
            : 'Volume increased to ' + Math.min(100, volumeLevel + 15) + '%.';
        break;
      }
      case 'VOLUME_DOWN': {
        setVolumeLevel((prev) => Math.max(0, prev - 15));
        confirmationText =
          settings.personalityMode === 'gf'
            ? 'Volume kam kar diya hai!'
            : 'Volume decreased to ' + Math.max(0, volumeLevel - 15) + '%.';
        break;
      }
      case 'FLASHLIGHT_ON': {
        setFlashlightOn(true);
        confirmationText =
          settings.personalityMode === 'gf' ? 'Torch on kar di! 💡' : 'Flashlight turned on.';
        break;
      }
      case 'FLASHLIGHT_OFF': {
        setFlashlightOn(false);
        confirmationText =
          settings.personalityMode === 'gf' ? 'Torch band kar di!' : 'Flashlight turned off.';
        break;
      }
      case 'WIFI_ON':
        setWifiOn(true);
        confirmationText = 'Wi-Fi activated.';
        break;
      case 'WIFI_OFF':
        setWifiOn(false);
        confirmationText = 'Wi-Fi deactivated.';
        break;
      case 'BLUETOOTH_ON':
        setBluetoothOn(true);
        confirmationText = 'Bluetooth enabled.';
        break;
      case 'BLUETOOTH_OFF':
        setBluetoothOn(false);
        confirmationText = 'Bluetooth disabled.';
        break;
      default:
        confirmationText = 'Task complete.';
    }

    const myraMsg: ChatMessage = {
      id: Date.now().toString(),
      text: confirmationText,
      isUser: false,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, myraMsg]);

    await audioEngineRef.current?.speak(
      confirmationText,
      settings.geminiVoice,
      settings.personalityMode
    );
  };

  // Mic Button Toggle
  const toggleMic = async () => {
    if (!isMicActive) {
      const ok = await audioEngineRef.current?.startRecording();
      setIsMicActive(true);
      setOrbState('listening');
      setStatusText('Sun rahi hoon...');
      showToast(ok ? 'Microphone Active' : 'Mic Active (Ambient mode)');
    } else {
      audioEngineRef.current?.stopRecording();
      setIsMicActive(false);
      setOrbState('idle');
      setStatusText('Tap karke bolo 💬');
      setAmplitude(0);
      showToast('Microphone Stopped');
    }
  };

  // Long press interrupt handling
  const handleMicMouseDown = () => {
    longPressTimerRef.current = window.setTimeout(() => {
      audioEngineRef.current?.interrupt();
      setOrbState('idle');
      setStatusText('Stopped (Interrupted)');
      setRedOverlayAlpha(0);
      showToast('MYRA Interrupted ⏹️');
    }, 600);
  };

  const handleMicMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Incoming Call Simulation
  const triggerIncomingCallSimulation = (caller: string = 'Priya') => {
    const announcement = `Sir, ${caller} ka call aa raha hai. Uthau ya reject karu?`;
    setIncomingCall({
      active: true,
      callerName: caller,
      callerNumber: '+91 98765 43210',
      announcement,
      isListeningDecision: false,
    });

    // Announce via native voice
    audioEngineRef.current?.speak(announcement, settings.geminiVoice, settings.personalityMode);

    // After 4.5 seconds -> listen for decision ("uthao" or "reject")
    setTimeout(() => {
      setIncomingCall((prev) => (prev ? { ...prev, isListeningDecision: true } : null));
    }, 4500);
  };

  const handleCallVoiceDecision = (decisionText: string) => {
    const lower = decisionText.toLowerCase();
    if (
      lower.includes('uthao') ||
      lower.includes('haan') ||
      lower.includes('accept') ||
      lower.includes('pick')
    ) {
      handleAcceptCall();
    } else if (
      lower.includes('reject') ||
      lower.includes('nahi') ||
      lower.includes('mat') ||
      lower.includes('cut')
    ) {
      handleRejectCall();
    }
  };

  const handleAcceptCall = () => {
    showToast('Call Accepted (TelecomManager)');
    audioEngineRef.current?.speak(
      'Haanji, call utha liya hai.',
      settings.geminiVoice,
      settings.personalityMode
    );
  };

  const handleRejectCall = () => {
    showToast('Call Rejected');
    setIncomingCall(null);
    audioEngineRef.current?.speak(
      'Call reject kar di hai.',
      settings.geminiVoice,
      settings.personalityMode
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#030303] text-zinc-100 flex items-center justify-center p-0 md:p-6 overflow-hidden select-none">
      {/* Background ambient red/purple mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#FF1744]/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#D500F9]/15 rounded-full blur-[140px]" />
      </div>

      {/* Main Container / Mobile Device Simulator Frame */}
      <div className="relative w-full max-w-[420px] h-[100dvh] md:h-[860px] bg-[#050505] md:rounded-[44px] md:border-4 md:border-zinc-800/90 shadow-[0_0_60px_rgba(255,23,68,0.25)] flex flex-col overflow-hidden">
        {/* Full-Screen Red Overlay Effect (fades to alpha 0.08 when MYRA active) */}
        <div
          className="absolute inset-0 bg-[#FF1744] pointer-events-none transition-opacity duration-300 z-20"
          style={{ opacity: redOverlayAlpha }}
        />

        {/* Dynamic Island / Speaker notch simulation */}
        <div className="hidden md:flex justify-center pt-2 z-30">
          <div className="w-24 h-4 bg-zinc-900 rounded-full flex items-center justify-center">
            <div className="w-8 h-1 bg-zinc-700 rounded-full" />
          </div>
        </div>

        {/* TOP STATUS BAR (Battery, RAM, Time, Settings) */}
        <header className="relative z-30 px-5 pt-3 pb-2 flex items-center justify-between text-xs font-mono border-b border-zinc-900/60 bg-gradient-to-b from-[#080808] to-transparent">
          {/* Left: Battery & RAM */}
          <div className="flex items-center gap-2">
            <span className="text-[#FF1744] font-bold tracking-tight">
              {batteryLevel}%
            </span>
            <span className="text-zinc-500 text-[10px] hidden sm:inline">
              {ramUsage}
            </span>
          </div>

          {/* Center: Brand Lockup */}
          <div className="text-center">
            <div className="text-base font-extrabold tracking-widest text-[#FF1744] font-['Syne',sans-serif] leading-tight">
              MYRA
            </div>
            <div className="text-[8px] tracking-widest uppercase font-mono text-zinc-500">
              AI COMPANION
            </div>
          </div>

          {/* Right: Time & Settings Button */}
          <div className="flex items-center gap-2">
            <span className="text-[#FF1744] font-semibold">{currentTime}</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Settings (SettingsActivity)"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Action Pills Strip (Testing & Simulation Controls) */}
        <div className="relative z-30 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-zinc-900/40 text-[10px] font-mono">
          <button
            onClick={() => triggerIncomingCallSimulation('Priya')}
            className="px-2.5 py-1 rounded-lg bg-[#190407] hover:bg-[#2A050D] text-[#FF1744] border border-[#FF1744]/40 flex items-center gap-1 shrink-0 transition-colors"
          >
            <PhoneCall className="w-3 h-3" />
            Simulate Call
          </button>
          <button
            onClick={() => setIsOverlayVisible(!isOverlayVisible)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors"
          >
            <Layers className="w-3 h-3 text-[#D500F9]" />
            {isOverlayVisible ? 'Hide Orb' : 'Floating Orb'}
          </button>
          <button
            onClick={() => setIsExplorerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors"
          >
            <Code2 className="w-3 h-3 text-emerald-400" />
            Android Source (.zip)
          </button>
        </div>

        {/* CENTER BODY: 7-Layer Canvas Orb, 20-bar Waveform, Status text */}
        <div className="relative z-25 flex-1 flex flex-col items-center justify-center px-4 py-2">
          {/* Animated 7-Layer Canvas Orb */}
          <div className="relative flex items-center justify-center my-auto">
            <OrbAnimationCanvas
              state={orbState}
              amplitude={amplitude}
              size={240}
              onClick={toggleMic}
            />
          </div>

          {/* 20-Bar Reactive Waveform */}
          <div className="my-2">
            <WaveformCanvas amplitude={amplitude} active={orbState !== 'idle'} width={190} height={36} />
          </div>

          {/* Assistant Status Text */}
          <div className="text-xs font-mono text-zinc-400 mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                orbState === 'idle'
                  ? 'bg-zinc-600'
                  : orbState === 'listening'
                  ? 'bg-[#FF1744] animate-pulse'
                  : orbState === 'speaking'
                  ? 'bg-[#D500F9] animate-pulse'
                  : 'bg-[#40C4FF] animate-spin'
              }`}
            />
            <span>{statusText}</span>
          </div>

          {/* Quick Voice Command Triggers */}
          <div className="w-full flex items-center justify-center gap-1.5 mt-3 overflow-x-auto scrollbar-none py-1">
            {[
              'YouTube kholo',
              'close friend ko call karo',
              'torch on karo',
              'volume up',
              'meri jaan ko message karo',
            ].map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleUserVoiceInput(cmd)}
                className="px-2 py-0.5 rounded-full bg-zinc-900/80 hover:bg-[#1E0408] hover:border-[#FF1744]/50 border border-zinc-800 text-[9px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap shrink-0"
              >
                "{cmd}"
              </button>
            ))}
          </div>
        </div>

        {/* CHAT RECYCLERVIEW (User red-bordered bubbles & MYRA dark bubbles) */}
        <div className="relative z-25 w-full border-t border-zinc-900/80 bg-[#070707]">
          <ChatHistory messages={messages} />

          {/* Text fallback input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                handleUserVoiceInput(textInput);
                setTextInput('');
              }
            }}
            className="px-4 py-2 flex items-center gap-2 border-t border-zinc-900/60"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type voice text here..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-[#111111] border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF1744]"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="p-1.5 rounded-xl bg-[#1A0308] border border-[#FF1744]/40 text-[#FF1744] hover:bg-[#FF1744] hover:text-white disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* BOTTOM MIC CONTROLS (72dp Oval Mic button with long-press stop) */}
        <footer className="relative z-30 py-4 px-6 flex flex-col items-center justify-center bg-gradient-to-t from-[#0A0A0A] to-transparent">
          <button
            onClick={toggleMic}
            onMouseDown={handleMicMouseDown}
            onMouseUp={handleMicMouseUp}
            onTouchStart={handleMicMouseDown}
            onTouchEnd={handleMicMouseUp}
            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center border-2 transition-all active:scale-95 shadow-xl ${
              isMicActive
                ? 'bg-gradient-to-tr from-[#FF1744] to-[#D500F9] border-white text-white shadow-[0_0_28px_rgba(255,23,68,0.6)] animate-pulse'
                : 'bg-[#100406] border-[#FF1744]/70 text-[#FF1744] hover:border-[#FF1744] shadow-[0_0_16px_rgba(255,23,68,0.2)]'
            }`}
          >
            {isMicActive ? (
              <Mic className="w-8 h-8 text-white" />
            ) : (
              <MicOff className="w-8 h-8 text-[#FF1744]" />
            )}
          </button>
          <span className="text-[10px] font-mono text-zinc-500 mt-2">
            Tap to talk · Long press to stop
          </span>
        </footer>

        {/* Simulated Android Features Overlays */}
        <SimulatedPhoneActions
          activeApp={activeApp}
          onCloseApp={() => setActiveApp(null)}
          volumeLevel={volumeLevel}
          flashlightOn={flashlightOn}
          wifiOn={wifiOn}
          bluetoothOn={bluetoothOn}
          toastAction={toastAction}
        />

        {/* Incoming Call Simulation Dialog */}
        {incomingCall && incomingCall.active && (
          <IncomingCallDialog
            callerName={incomingCall.callerName}
            callerNumber={incomingCall.callerNumber}
            myraAnnouncement={incomingCall.announcement}
            isListeningDecision={incomingCall.isListeningDecision}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
      </div>

      {/* Settings Activity Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Android Project Source Explorer (.zip downloader) */}
      <AndroidProjectExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
      />

      {/* Floating Orb Overlay Simulation */}
      <FloatingOrbOverlay
        isVisible={isOverlayVisible}
        onClose={() => setIsOverlayVisible(false)}
        onTapToOpen={() => {
          setIsOverlayVisible(false);
          showToast('Opened from Overlay (FLAG_ACTIVITY_SINGLE_TOP)');
        }}
        orbState={orbState}
        amplitude={amplitude}
      />
    </div>
  );
}
