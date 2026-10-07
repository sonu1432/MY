import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types/assistant';

interface ChatHistoryProps {
  messages: ChatMessage[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="w-full h-44 overflow-y-auto px-4 py-2 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent select-text"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-mono text-center">
          Tap microphone button to start voice conversation with MYRA
        </div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2 ${
              msg.isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {!msg.isUser && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF1744] shrink-0 mt-2 shadow-[0_0_8px_#FF1744]" />
            )}

            <div
              className={`max-w-[82%] px-3.5 py-2 text-xs leading-relaxed transition-all ${
                msg.isUser
                  ? 'bg-[#1A0508] border border-[#FF1744]/70 text-zinc-100 rounded-2xl rounded-tr-sm shadow-[0_0_12px_rgba(255,23,68,0.15)]'
                  : 'bg-[#121212] border border-zinc-800/80 text-zinc-200 rounded-2xl rounded-tl-sm shadow-sm'
              }`}
            >
              <div className="break-words">{msg.text}</div>
              <div className="text-[9px] text-zinc-500 font-mono mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
