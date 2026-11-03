/**
 * RadarCanvas.tsx
 * High-performance HTML Canvas tactical phosphor-green CRT radar PPI scope.
 * Directly recreates the military/marine radar aesthetic from the user's reference:
 * - Phosphor green CRT color palette (#00ff41 / #39ff14 / #000a02)
 * - Faint matrix grid backdrop with crisp polar range rings & radial spokes
 * - Sweeping phosphor beam with trailing decay sector
 * - Glowing phosphor target blips with tactical tracking corner brackets [  ]
 * - HUD data panels in top corners with live target telemetry
 */

import React, { useRef, useEffect } from 'react';
import { ScanSample, TrackedObstacle } from '../types/radar';

interface RadarCanvasProps {
  currentSweepAngle: number;
  samples: ScanSample[];
  trackedObstacles: TrackedObstacle[];
  maxDistanceCm: number;
  isScanning: boolean;
  tempC?: number;
  calibOffsetCm?: number;
}

export const RadarCanvas: React.FC<RadarCanvasProps> = ({
  currentSweepAngle,
  samples,
  trackedObstacles,
  maxDistanceCm,
  isScanning,
  tempC = 20.0,
  calibOffsetCm = 0.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep references to props so the 60fps render loop always has latest state
  const stateRef = useRef({
    currentSweepAngle,
    samples,
    trackedObstacles,
    maxDistanceCm,
    isScanning,
    tempC,
    calibOffsetCm,
  });

  useEffect(() => {
    stateRef.current = {
      currentSweepAngle,
      samples,
      trackedObstacles,
      maxDistanceCm,
      isScanning,
      tempC,
      calibOffsetCm,
    };
  }, [currentSweepAngle, samples, trackedObstacles, maxDistanceCm, isScanning, tempC, calibOffsetCm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const {
        currentSweepAngle: angle,
        samples: currentSamples,
        trackedObstacles: obstacles,
        maxDistanceCm: maxDist,
        isScanning: scanning,
        tempC: temp,
        calibOffsetCm: offset,
      } = stateRef.current;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Deep Phosphor CRT Background
      ctx.fillStyle = '#010a03';
      ctx.fillRect(0, 0, width, height);

      // 2. Background Cartesian Matrix Grid (Subtle green phosphor grid)
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 28;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Semicircle Scope Center & Radius
      const originX = width / 2;
      const originY = height - 28;
      const radius = Math.min(width * 0.46, height - 52);

      if (radius > 15) {
        // 3. Polar Scope Background Semicircle
        ctx.beginPath();
        ctx.arc(originX, originY, radius, Math.PI, 2 * Math.PI, false);
        ctx.fillStyle = 'rgba(0, 20, 5, 0.65)';
        ctx.fill();

        // Outer Scope Boundary Ring (Double phosphor glowing ring)
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 4. Concentric Range Rings & Labels
        const rangeSteps = [0.25, 0.5, 0.75, 1.0];
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        rangeSteps.forEach((frac) => {
          const r = radius * frac;
          const distVal = Math.round(maxDist * frac);

          ctx.beginPath();
          ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI, false);
          ctx.strokeStyle = frac === 1.0 ? 'rgba(0, 255, 65, 0.6)' : 'rgba(0, 255, 65, 0.22)';
          ctx.lineWidth = frac === 1.0 ? 1.5 : 1;
          ctx.stroke();

          // Range markings along vertical axis (90°)
          ctx.fillStyle = '#39ff14';
          ctx.fillText(`${distVal}cm`, originX, originY - r - 2);
        });

        // 5. Radial Spokes and Angle Markers (every 15° matching military standard)
        const angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
        ctx.font = 'bold 9px monospace';
        ctx.textBaseline = 'middle';

        angles.forEach((deg) => {
          const rad = Math.PI + (deg * Math.PI) / 180;
          const x = originX + Math.cos(rad) * radius;
          const y = originY + Math.sin(rad) * radius;

          const isMajor = deg === 90 || deg === 0 || deg === 180;
          const isSemi = deg === 45 || deg === 135;

          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = isMajor
            ? 'rgba(0, 255, 65, 0.45)'
            : isSemi
            ? 'rgba(0, 255, 65, 0.3)'
            : 'rgba(0, 255, 65, 0.16)';
          ctx.lineWidth = isMajor ? 1.5 : 1.0;
          ctx.stroke();

          // Outer degree labels
          const labelDist = radius + 15;
          const lx = originX + Math.cos(rad) * labelDist;
          const ly = originY + Math.sin(rad) * labelDist;

          ctx.fillStyle = isMajor ? '#39ff14' : 'rgba(0, 255, 65, 0.75)';
          ctx.fillText(`${deg}°`, lx, ly);
        });

        // Minor tick marks every 5 degrees around outer perimeter
        for (let d = 0; d <= 180; d += 5) {
          if (angles.includes(d)) continue;
          const rad = Math.PI + (d * Math.PI) / 180;
          const x1 = originX + Math.cos(rad) * radius;
          const y1 = originY + Math.sin(rad) * radius;
          const x2 = originX + Math.cos(rad) * (radius - 5);
          const y2 = originY + Math.sin(rad) * (radius - 5);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = 'rgba(0, 255, 65, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 6. Trailing Phosphor Decay Sector (behind the sweeping needle)
        if (scanning) {
          const sweepRad = Math.PI + (angle * Math.PI) / 180;
          const trailAngleSpan = (24 * Math.PI) / 180;

          // Draw fading trailing sector
          const sectorSteps = 12;
          for (let i = 0; i < sectorSteps; i++) {
            const startFrac = i / sectorSteps;
            const endFrac = (i + 1) / sectorSteps;
            const a1 = sweepRad - trailAngleSpan * (1 - startFrac);
            const a2 = sweepRad - trailAngleSpan * (1 - endFrac);

            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.arc(originX, originY, radius, a1, a2, false);
            ctx.closePath();

            const alpha = 0.22 * Math.pow(endFrac, 2);
            ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
            ctx.fill();
          }
        }

        // 7. Render Raw Sensor Blips with Controlled Persistence
        const now = Date.now();
        currentSamples.forEach((s) => {
          const age = now - s.timestamp;
          if (age > 7000) return;
          const alpha = Math.max(0.12, 1 - age / 7000);

          if (!s.valid || s.distCm <= 0 || s.distCm > maxDist) return;

          const r = (s.distCm / maxDist) * radius;
          const rad = Math.PI + (s.angle * Math.PI) / 180;
          const bx = originX + Math.cos(rad) * r;
          const by = originY + Math.sin(rad) * r;

          // Outer phosphor bloom
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(0, 255, 65, ${alpha * 0.35})`;
          ctx.fill();

          // Sharp blip dot
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(165, 255, 180, ${alpha * 0.85})`;
          ctx.fill();
        });

        // 8. Tracked Obstacle Reticles [  ] (Matching reference CRT photo!)
        obstacles.forEach((obs) => {
          if (obs.status === 'LOST') return;
          if (obs.distance <= 0 || obs.distance > maxDist) return;

          const r = (obs.distance / maxDist) * radius;
          const rad = Math.PI + (obs.angle * Math.PI) / 180;
          const ox = originX + Math.cos(rad) * r;
          const oy = originY + Math.sin(rad) * r;

          const isDanger = obs.isClosest && obs.distance < 25;
          const reticleColor = isDanger ? '#ff3344' : obs.isClosest ? '#ffb700' : '#00ff41';

          // A. Glowing target blip center
          ctx.beginPath();
          ctx.arc(ox, oy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff'; // White-hot core
          ctx.shadowColor = reticleColor;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Outer glow ring
          ctx.beginPath();
          ctx.arc(ox, oy, 8, 0, 2 * Math.PI);
          ctx.strokeStyle = reticleColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // B. Tactical 4-Corner Targeting Brackets [  ]
          const boxSize = 14;
          const cornerLen = 5;

          ctx.strokeStyle = reticleColor;
          ctx.lineWidth = 1.5;

          // Top-Left corner
          ctx.beginPath();
          ctx.moveTo(ox - boxSize, oy - boxSize + cornerLen);
          ctx.lineTo(ox - boxSize, oy - boxSize);
          ctx.lineTo(ox - boxSize + cornerLen, oy - boxSize);
          ctx.stroke();

          // Top-Right corner
          ctx.beginPath();
          ctx.moveTo(ox + boxSize - cornerLen, oy - boxSize);
          ctx.lineTo(ox + boxSize, oy - boxSize);
          ctx.lineTo(ox + boxSize, oy - boxSize + cornerLen);
          ctx.stroke();

          // Bottom-Left corner
          ctx.beginPath();
          ctx.moveTo(ox - boxSize, oy + boxSize - cornerLen);
          ctx.lineTo(ox - boxSize, oy + boxSize);
          ctx.lineTo(ox - boxSize + cornerLen, oy + boxSize);
          ctx.stroke();

          // Bottom-Right corner
          ctx.beginPath();
          ctx.moveTo(ox + boxSize - cornerLen, oy + boxSize);
          ctx.lineTo(ox + boxSize, oy + boxSize);
          ctx.lineTo(ox + boxSize, oy + boxSize - cornerLen);
          ctx.stroke();

          // C. Target Data Callout Tag
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const tagX = ox + boxSize + 4;
          const tagY = oy - boxSize;

          ctx.fillStyle = reticleColor;
          ctx.fillText(`[${obs.id}] ${obs.distance.toFixed(1)}cm`, tagX, tagY);
          ctx.fillStyle = 'rgba(0, 255, 65, 0.8)';
          ctx.fillText(`W:~${obs.approxWidthCm}cm (${obs.confidence}%)`, tagX, tagY + 11);

          // D. Closest collision alert line to origin
          if (isDanger) {
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(originX, originY);
            ctx.lineTo(ox, oy);
            ctx.strokeStyle = 'rgba(255, 51, 68, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });

        // 9. Active Rotating Sweep Needle
        const sweepRad = Math.PI + (angle * Math.PI) / 180;
        const sweepX = originX + Math.cos(sweepRad) * radius;
        const sweepY = originY + Math.sin(sweepRad) * radius;

        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(sweepX, sweepY);
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Center Pivot Concentric Rings
        ctx.beginPath();
        ctx.arc(originX, originY, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff41';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(originX, originY, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // 10. Tactical HUD Readout Panels in Corners (Directly matching user's image!)
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Top-Left HUD Card (Autotune & Sensor Diagnostics)
      const hudL_X = 14;
      const hudL_Y = 12;

      ctx.fillStyle = 'rgba(0, 18, 5, 0.75)';
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.35)';
      ctx.lineWidth = 1;
      ctx.fillRect(hudL_X - 4, hudL_Y - 4, 150, 84);
      ctx.strokeRect(hudL_X - 4, hudL_Y - 4, 150, 84);

      ctx.fillStyle = '#39ff14';
      ctx.fillText('AUTOTUNE: ACTIVE', hudL_X, hudL_Y);
      ctx.fillStyle = 'rgba(0, 255, 65, 0.8)';
      ctx.fillText('DISP: CRT PPI SCOPE', hudL_X, hudL_Y + 13);
      ctx.fillText('ANT 1: HC-SR04', hudL_X, hudL_Y + 26);
      ctx.fillText(`SWEEP: 0°-180°`, hudL_X, hudL_Y + 39);
      ctx.fillText(`TRACKS: ${obstacles.filter((o) => o.status !== 'LOST').length} DETECTED`, hudL_X, hudL_Y + 52);
      ctx.fillText(`TEMP: ${temp.toFixed(1)}°C`, hudL_X, hudL_Y + 65);

      // Top-Right HUD Card (Navigation & Target Coordinates)
      const hudR_W = 160;
      const hudR_X = width - hudR_W - 14;
      const hudR_Y = 12;

      ctx.fillStyle = 'rgba(0, 18, 5, 0.75)';
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.35)';
      ctx.lineWidth = 1;
      ctx.fillRect(hudR_X - 4, hudR_Y - 4, hudR_W, 84);
      ctx.strokeRect(hudR_X - 4, hudR_Y - 4, hudR_W, 84);

      ctx.fillStyle = '#39ff14';
      ctx.fillText(`SERVO: ${angle.toFixed(1)}°`, hudR_X, hudR_Y);
      ctx.fillStyle = 'rgba(0, 255, 65, 0.8)';
      ctx.fillText(`STATUS: ${scanning ? 'SWEEPING' : 'HOLD'}`, hudR_X, hudR_Y + 13);
      ctx.fillText(`MAX RANGE: ${maxDist} CM`, hudR_X, hudR_Y + 26);
      ctx.fillText(`CALIB: ${offset >= 0 ? '+' : ''}${offset.toFixed(1)} CM`, hudR_X, hudR_Y + 39);

      const closest = obstacles.find((o) => o.isClosest && o.status !== 'LOST');
      if (closest) {
        ctx.fillStyle = closest.distance < 25 ? '#ff3344' : '#ffb700';
        ctx.fillText(`CLOSEST: [${closest.id}] ${closest.distance.toFixed(1)}cm`, hudR_X, hudR_Y + 52);
        ctx.fillText(`BEARING: ${closest.angle.toFixed(1)}°`, hudR_X, hudR_Y + 65);
      } else {
        ctx.fillStyle = 'rgba(0, 255, 65, 0.5)';
        ctx.fillText('CLOSEST: NONE', hudR_X, hudR_Y + 52);
        ctx.fillText('BEARING: --', hudR_X, hudR_Y + 65);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="radar-scope-wrapper">
      <canvas
        ref={canvasRef}
        className="radar-crt-canvas"
        aria-label="Tactical Phosphor Ultrasonic Radar PPI Scope"
      />
    </div>
  );
};
