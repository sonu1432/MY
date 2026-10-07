import React, { useState, useRef } from 'react';
import { OrbAnimationCanvas } from './OrbAnimationCanvas';
import { OrbState } from '../types/assistant';
import { X, Move } from 'lucide-react';

interface FloatingOrbOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onTapToOpen: () => void;
  orbState: OrbState;
  amplitude: number;
}

export const FloatingOrbOverlay: React.FC<FloatingOrbOverlayProps> = ({
  isVisible,
  onClose,
  onTapToOpen,
  orbState,
  amplitude,
}) => {
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  if (!isVisible) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag on handle or background, don't trigger if clicking X
    if ((e.target as HTMLElement).closest('.close-btn')) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPosition({
      x: Math.max(10, Math.min(window.innerWidth - 180, dragStartRef.current.posX + dx)),
      y: Math.max(10, Math.min(window.innerHeight - 180, dragStartRef.current.posY + dy)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="w-40 h-40 rounded-3xl bg-black/85 border border-[#FF1744]/40 shadow-[0_0_35px_rgba(255,23,68,0.35)] backdrop-blur-xl flex flex-col items-center justify-between p-2 cursor-grab active:cursor-grabbing select-none group animate-in fade-in zoom-in-90"
    >
      {/* Top Header bar */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
          <Move className="w-2.5 h-2.5 opacity-60" />
          <span>OVERLAY</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="close-btn p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Remove Overlay View"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Mini Orb */}
      <div
        onClick={onTapToOpen}
        className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
      >
        <OrbAnimationCanvas state={orbState} amplitude={amplitude} size={90} />
      </div>

      {/* Bottom Label */}
      <button
        onClick={onTapToOpen}
        className="text-[10px] font-bold font-['Syne',sans-serif] tracking-wider text-[#FF1744] hover:text-[#D500F9] transition-colors"
      >
        MYRA ✦ TAP TO OPEN
      </button>
    </div>
  );
};
