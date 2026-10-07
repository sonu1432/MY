import React, { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  amplitude: number; // 0.0 to 1.0 (RMS normalized)
  active?: boolean;
  width?: number;    // default 200
  height?: number;   // default 40
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  amplitude,
  active = true,
  width = 200,
  height = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heightsRef = useRef<number[]>(new Array(20).fill(3));
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const barCount = 20;
    const barWidth = Math.floor((width - (barCount - 1) * 3) / barCount);
    const gap = 3;

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const targetBase = active ? Math.max(3, amplitude * height * 0.95) : 3;

      for (let i = 0; i < barCount; i++) {
        // Organic frequency distribution curve across bars (higher in center)
        const centerFactor = 1.0 - Math.abs((i - barCount / 2) / (barCount / 2)) * 0.5;
        const jitter = active ? (Math.sin(Date.now() * 0.015 + i * 0.8) * 0.25 + 0.8) : 1;
        const target = Math.max(3, targetBase * centerFactor * jitter);

        // Lerp height: barHeights[i] += (target - current) * 0.3f
        heightsRef.current[i] += (target - heightsRef.current[i]) * 0.3;
        const currentH = Math.min(height, Math.max(3, heightsRef.current[i]));

        const x = i * (barWidth + gap) + 4;
        const y = (height - currentH) / 2;

        // Alpha varying by height (150..255)
        const alpha = Math.min(1, 0.55 + (currentH / height) * 0.45);
        ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;

        // Rounded vertical bar
        const r = Math.min(barWidth / 2, currentH / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, currentH, r);
        ctx.fill();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [amplitude, active, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block select-none"
    />
  );
};
