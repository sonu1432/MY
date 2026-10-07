import React, { useEffect, useRef } from 'react';
import { OrbState } from '../types/assistant';

interface OrbAnimationCanvasProps {
  state: OrbState;
  amplitude: number; // 0.0 to 1.0 (RMS from AudioEngine)
  size?: number;     // diameter in px (default 260)
  onClick?: () => void;
}

export const OrbAnimationCanvas: React.FC<OrbAnimationCanvasProps> = ({
  state,
  amplitude,
  size = 260,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  // Animation values preserved across frames
  const rotationAngleRef = useRef<number>(0);
  const waveOffsetRef = useRef<number>(0);
  const thinkingAngleRef = useRef<number>(0);
  const pulsePhaseRef = useRef<number>(0);

  // Particles state (12 orbiting dots)
  const particlesRef = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 12,
      speed: 0.02 + (i % 3) * 0.01,
      distOffset: (i % 4) * 8 - 12,
      radius: 2 + (i % 3) * 1.5,
      alpha: 0.4 + (i % 5) * 0.12,
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Update animated parameters
      pulsePhaseRef.current += dt * (state === 'idle' ? 2.1 : 3.5);
      rotationAngleRef.current += dt * (state === 'speaking' ? 2.5 : 1.2);
      waveOffsetRef.current += dt * (state === 'speaking' ? 6.0 : 3.0);
      thinkingAngleRef.current += dt * 4.0;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.32;

      // Pulse scaling
      let pulseScale = 1.0;
      if (state === 'idle') {
        pulseScale = 1.0 + 0.08 * Math.sin(pulsePhaseRef.current);
      } else if (state === 'listening' || state === 'speaking') {
        pulseScale = 1.0 + Math.min(amplitude * 0.35, 0.35) + 0.03 * Math.sin(pulsePhaseRef.current);
      } else if (state === 'thinking') {
        pulseScale = 1.02 + 0.04 * Math.sin(pulsePhaseRef.current * 1.5);
      }

      const currentRadius = baseRadius * pulseScale;

      // Color scheme based on state
      let colorPrimary = '#B71C1C';
      let colorSecondary = '#880E4F';
      let glowColor = 'rgba(255, 23, 68, 0.45)';

      if (state === 'listening') {
        colorPrimary = '#FF1744';
        colorSecondary = '#D500F9';
        glowColor = 'rgba(255, 23, 68, 0.65)';
      } else if (state === 'speaking') {
        colorPrimary = '#E040FB';
        colorSecondary = '#FF1744';
        glowColor = 'rgba(213, 0, 249, 0.7)';
      } else if (state === 'thinking') {
        colorPrimary = '#40C4FF';
        colorSecondary = '#00B0FF';
        glowColor = 'rgba(0, 176, 255, 0.6)';
      }

      // ==========================================
      // LAYER 1: Radial Glow (1.6x radius)
      // ==========================================
      const glowGrad = ctx.createRadialGradient(cx, cy, currentRadius * 0.4, cx, cy, currentRadius * 1.6);
      glowGrad.addColorStop(0, glowColor);
      glowGrad.addColorStop(0.6, glowColor.replace(/[\d\.]+\)$/, '0.2)'));
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // LAYER 2: Core Orb (Sphere illusion)
      // ==========================================
      const coreGrad = ctx.createRadialGradient(
        cx - currentRadius * 0.3,
        cy - currentRadius * 0.3,
        currentRadius * 0.1,
        cx,
        cy,
        currentRadius
      );
      coreGrad.addColorStop(0, colorPrimary);
      coreGrad.addColorStop(0.7, colorSecondary);
      coreGrad.addColorStop(1, '#050505');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // LAYER 3: 3 Rotating Rings (Dashed arcs)
      // ==========================================
      const ringAngles = [
        rotationAngleRef.current,
        -rotationAngleRef.current * 0.8,
        rotationAngleRef.current * 1.3,
      ];
      const ringRadii = [currentRadius * 1.15, currentRadius * 1.3, currentRadius * 1.45];

      ringRadii.forEach((r, idx) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ringAngles[idx]);
        ctx.strokeStyle = idx % 2 === 0 ? colorPrimary : colorSecondary;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = state === 'idle' ? 0.35 : 0.75;
        ctx.setLineDash([12 + idx * 4, 8 + idx * 3]);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // ==========================================
      // LAYER 4: Wave Rings (Sine waves, reactive)
      // ==========================================
      if (state !== 'idle') {
        const waveCount = 3;
        for (let w = 0; w < waveCount; w++) {
          ctx.save();
          ctx.beginPath();
          const waveRadius = currentRadius * (1.1 + w * 0.15);
          const points = 36;
          for (let p = 0; p <= points; p++) {
            const angle = (p / points) * Math.PI * 2;
            const waveAmp = (amplitude * 14 + 4) * Math.sin(angle * 6 + waveOffsetRef.current + w);
            const r = waveRadius + waveAmp;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = colorPrimary;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = Math.max(0.15, 0.6 - w * 0.18);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ==========================================
      // LAYER 5: Thinking Arc (Spinning arc)
      // ==========================================
      if (state === 'thinking') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(thinkingAngleRef.current);
        ctx.strokeStyle = '#40C4FF';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';

        // Arc 1
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius * 1.25, 0, Math.PI * 0.75);
        ctx.stroke();

        // Arc 2 opposite
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius * 1.25, Math.PI, Math.PI * 1.75);
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================
      // LAYER 6: Orbiting Particles (12 dots)
      // ==========================================
      if (state === 'listening' || state === 'speaking') {
        particlesRef.current.forEach((pt) => {
          pt.angle += pt.speed * (state === 'speaking' ? 1.6 : 1.0);
          const orbitR = currentRadius * 1.25 + pt.distOffset + amplitude * 18;
          const px = cx + Math.cos(pt.angle) * orbitR;
          const py = cy + Math.sin(pt.angle) * orbitR;

          ctx.fillStyle = state === 'speaking' ? '#E040FB' : '#FF1744';
          ctx.globalAlpha = pt.alpha + amplitude * 0.3;
          ctx.beginPath();
          ctx.arc(px, py, pt.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1.0;
      }

      // ==========================================
      // LAYER 7: Inner Highlight (Top-left 3D glare)
      // ==========================================
      const hx = cx - currentRadius * 0.38;
      const hy = cy - currentRadius * 0.38;
      const hr = currentRadius * 0.35;
      const highlightGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
      highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [state, amplitude, size]);

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer select-none transition-transform active:scale-95"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block"
      />
    </div>
  );
};
