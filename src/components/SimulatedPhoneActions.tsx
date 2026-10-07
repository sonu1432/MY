import React, { useEffect, useState } from 'react';
import { Volume2, Zap, Wifi, WifiOff, Bluetooth, BluetoothOff, X, ArrowLeft, ExternalLink, Play } from 'lucide-react';

interface SimulatedPhoneActionsProps {
  activeApp: string | null;
  onCloseApp: () => void;
  volumeLevel: number;
  flashlightOn: boolean;
  wifiOn: boolean;
  bluetoothOn: boolean;
  toastAction: string | null;
}

export const SimulatedPhoneActions: React.FC<SimulatedPhoneActionsProps> = ({
  activeApp,
  onCloseApp,
  volumeLevel,
  flashlightOn,
  wifiOn,
  bluetoothOn,
  toastAction,
}) => {
  const [showVolumeHud, setShowVolumeHud] = useState(false);

  useEffect(() => {
    if (toastAction && toastAction.toLowerCase().includes('volume')) {
      setShowVolumeHud(true);
      const timer = setTimeout(() => setShowVolumeHud(false), 2400);
      return () => clearTimeout(timer);
    }
  }, [toastAction, volumeLevel]);

  return (
    <>
      {/* Volume HUD Slider Overlay (Top-Right / Android standard) */}
      {showVolumeHud && (
        <div className="absolute top-16 right-4 z-30 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-2.5 flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-4 duration-150">
          <Volume2 className="w-4 h-4 text-[#FF1744]" />
          <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF1744] to-[#D500F9] transition-all duration-300"
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-300 w-6 text-right">
            {volumeLevel}%
          </span>
        </div>
      )}

      {/* Flashlight Indicator */}
      {flashlightOn && (
        <div className="absolute top-14 left-4 z-30 bg-amber-500/20 border border-amber-500/50 rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-[10px] font-mono text-amber-300 font-bold">TORCH ON</span>
        </div>
      )}

      {/* Action Toast Feedback */}
      {toastAction && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 max-w-[90%] bg-zinc-900/95 border border-[#FF1744]/40 text-white px-4 py-2 rounded-2xl shadow-2xl text-xs font-mono text-center flex items-center gap-2 backdrop-blur-lg animate-in fade-in slide-in-from-top-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF1744] animate-ping" />
          {toastAction}
        </div>
      )}

      {/* Simulated App View (Full-screen within phone frame when an app is opened) */}
      {activeApp && (
        <div className="absolute inset-0 z-35 bg-[#080808] flex flex-col animate-in zoom-in-95 duration-200">
          {/* App Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                onClick={onCloseApp}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Go Home / Back (Accessibility Service)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                {activeApp}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500">
                via PackageManager
              </span>
              <button
                onClick={onCloseApp}
                className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                title="Close App"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* App Simulated Body Content */}
          <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto">
            {activeApp === 'youtube' ? (
              <div className="space-y-4">
                <div className="w-full aspect-video bg-zinc-900 rounded-xl border border-zinc-800 relative flex items-center justify-center overflow-hidden">
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 text-[11px] text-zinc-300 font-medium truncate">
                    ▶ Gemini Live Assistant Demo in Kotlin
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-zinc-900 rounded w-1/2" />
                </div>
              </div>
            ) : activeApp === 'whatsapp' ? (
              <div className="space-y-3">
                <div className="bg-[#1F2C34] p-3 rounded-xl border border-emerald-900/40 text-xs text-zinc-200">
                  <div className="font-semibold text-emerald-400 mb-0.5">WhatsApp Conversation</div>
                  <div>MYRA initiated chat ready. Say "send message" to dictate.</div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#005C4B] text-zinc-100 p-2.5 rounded-xl text-xs max-w-[80%]">
                    Hey! MYRA opened WhatsApp for you.
                  </div>
                </div>
              </div>
            ) : activeApp === 'spotify' ? (
              <div className="flex flex-col items-center justify-center space-y-4 my-auto">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-tr from-emerald-600 to-zinc-900 flex items-center justify-center shadow-xl">
                  <span className="text-2xl font-bold text-white">♫</span>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">Now Playing</div>
                  <div className="text-xs text-zinc-400">Voice Assistant Soundtrack</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center my-auto space-y-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-300">
                  {activeApp.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-sm font-semibold text-white capitalize">{activeApp}</div>
                <div className="text-xs text-zinc-500 font-mono max-w-xs">
                  Launched via Android Intent. Say "close {activeApp}" or click back to return to MYRA.
                </div>
              </div>
            )}

            {/* Bottom Accessibility Close Bar */}
            <div className="pt-4 border-t border-zinc-900 flex justify-center">
              <button
                onClick={onCloseApp}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-800 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to MYRA (GLOBAL_ACTION_HOME)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
