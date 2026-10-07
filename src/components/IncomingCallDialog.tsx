import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, User, Mic } from 'lucide-react';

interface IncomingCallDialogProps {
  callerName: string;
  callerNumber: string;
  myraAnnouncement: string;
  onAccept: () => void;
  onReject: () => void;
  isListeningDecision: boolean;
}

export const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  callerName,
  callerNumber,
  myraAnnouncement,
  onAccept,
  onReject,
  isListeningDecision,
}) => {
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: number;
    if (callActive) {
      timer = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callActive]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleInternalAccept = () => {
    setCallActive(true);
    onAccept();
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between bg-gradient-to-b from-black via-zinc-950 to-[#120005] p-6 text-white backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      {/* Top Banner */}
      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF1744]/20 border border-[#FF1744]/40 text-[#FF1744] text-[11px] font-mono mb-4 animate-pulse">
          <Phone className="w-3.5 h-3.5" />
          {callActive ? 'CALL IN PROGRESS' : 'INCOMING CALL (TelecomManager)'}
        </div>
        <div className="text-2xl font-bold font-['Syne',sans-serif] tracking-wide">
          {callerName}
        </div>
        <div className="text-xs font-mono text-zinc-400 mt-1">
          {callerNumber}
        </div>
        {callActive && (
          <div className="text-sm font-mono text-emerald-400 mt-2 font-bold">
            {formatDuration(callDuration)}
          </div>
        )}
      </div>

      {/* Center Caller Avatar & MYRA Speech Announcement */}
      <div className="flex flex-col items-center justify-center my-auto space-y-5">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border-2 border-[#FF1744]/40 flex items-center justify-center shadow-[0_0_40px_rgba(255,23,68,0.3)]">
            <User className="w-14 h-14 text-zinc-300" />
          </div>
          {!callActive && (
            <span className="absolute inset-0 rounded-full border-2 border-[#FF1744] animate-ping opacity-30" />
          )}
        </div>

        {/* MYRA Voice Call Guidance */}
        <div className="w-full max-w-xs bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 text-center shadow-lg">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#FF1744] mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF1744] animate-pulse" />
            MYRA ANNOUNCEMENT
          </div>
          <p className="text-xs text-zinc-200 italic">
            "{myraAnnouncement}"
          </p>
          {isListeningDecision && !callActive && (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-mono animate-pulse">
              <Mic className="w-3.5 h-3.5" />
              Listening... Say "Uthao" or "Reject"
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="pb-8">
        {callActive ? (
          <div className="flex justify-center">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-transform group-hover:scale-105 active:scale-95">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono text-zinc-400">End Call</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-around px-4">
            {/* Reject Button */}
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-transform group-hover:scale-105 active:scale-95">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono text-zinc-300">Reject ("Nahi")</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={handleInternalAccept}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-transform group-hover:scale-105 active:scale-95">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono text-zinc-300">Accept ("Uthao")</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
