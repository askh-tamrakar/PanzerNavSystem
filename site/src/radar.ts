/**
 * Ultrasonic Sweep Visualization (Radar-Style Display)
 *
 * NOTE: This is a polar visualization of raw ultrasonic distance samples
 * mapped to the scanning servo angle. It is NOT true radar, computer vision,
 * or object recognition.
 */

import { ScanSample } from './types';
import { Theme } from './theme';

export interface RadarConfig {
  minAngle: number;       // Min servo angle (e.g. 20..30 deg)
  maxAngle: number;       // Max servo angle (e.g. 150..160 deg)
  maxDistanceCm: number;  // Max distance scale in cm (e.g. 100 cm)
  distanceSteps: number[];// Ring markers (e.g. [25, 50, 75, 100])
  sampleTtlMs: number;    // How long samples remain visible before fading (e.g. 10000 ms)
  obstacleWarnCm: number; // Obstacle warning threshold in cm
}

export class RadarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RadarConfig;
  private samples: ScanSample[] = [];
  private currentSweepAngle: number = 90;
  private currentTheme: Theme = 'dark';
  private animationFrameId: number | null = null;
  private isTankMoving: boolean = false;

  constructor(canvas: HTMLCanvasElement, customConfig?: Partial<RadarConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available');
    }
    this.ctx = ctx;

    this.config = {
      minAngle: 0,
      maxAngle: 180,
      maxDistanceCm: 100,
      distanceSteps: [25, 50, 75, 100],
      sampleTtlMs: 8000,
      obstacleWarnCm: 25,
      ...customConfig,
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startLoop();
  }

  public setTheme(theme: Theme): void {
    this.currentTheme = theme;
  }

  public setTankMoving(moving: boolean): void {
    this.isTankMoving = moving;
  }

  public setSweepAngle(angle: number): void {
    this.currentSweepAngle = angle;
  }

  public addSample(angle: number, distCm: number, valid: boolean): void {
    // Add sample with current timestamp
    const now = Date.now();
    this.currentSweepAngle = angle;

    // Filter out very old samples for same approximate angle bin
    this.samples = this.samples.filter(
      (s) => Math.abs(s.angle - angle) > 3 || now - s.timestamp < 1000
    );

    this.samples.push({
      angle,
      distCm,
      valid,
      timestamp: now,
    });

    // Prune expired samples
    this.pruneOldSamples(now);
  }

  public clear(): void {
    this.samples = [];
  }

  private pruneOldSamples(now: number): void {
    this.samples = this.samples.filter((s) => now - s.timestamp <= this.config.sampleTtlMs);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startLoop(): void {
    const render = () => {
      this.draw();
      this.animationFrameId = requestAnimationFrame(render);
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private draw(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const ctx = this.ctx;
    const isDark = this.currentTheme === 'dark';

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Semicircle origin at bottom center
    const originX = width / 2;
    const originY = height - 24;
    const radius = Math.min(width * 0.46, height - 36);

    if (radius <= 10) return;

    // Palette tokens
    const gridColor = isDark ? 'rgba(0, 229, 255, 0.16)' : 'rgba(0, 119, 170, 0.18)';
    const gridStrongColor = isDark ? 'rgba(0, 229, 255, 0.32)' : 'rgba(0, 119, 170, 0.35)';
    const textColor = isDark ? 'rgba(165, 243, 252, 0.75)' : 'rgba(15, 43, 72, 0.75)';
    const sweepLineColor = isDark ? '#00e5ff' : '#0077aa';
    const clearBlipColor = isDark ? '#10b981' : '#059669';
    const warnBlipColor = isDark ? '#f59e0b' : '#d97706';
    const critBlipColor = isDark ? '#ef4444' : '#dc2626';

    // 1. Draw polar background arc
    ctx.beginPath();
    ctx.arc(originX, originY, radius, Math.PI, 2 * Math.PI, false);
    ctx.fillStyle = isDark ? 'rgba(13, 22, 35, 0.85)' : 'rgba(235, 242, 250, 0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = gridStrongColor;
    ctx.stroke();

    // 2. Draw concentric distance rings
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const dist of this.config.distanceSteps) {
      const r = (dist / this.config.maxDistanceCm) * radius;
      ctx.beginPath();
      ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI, false);
      ctx.strokeStyle = dist === this.config.obstacleWarnCm ? 'rgba(239, 68, 68, 0.4)' : gridColor;
      ctx.setLineDash(dist === this.config.obstacleWarnCm ? [4, 4] : []);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring label on 90 degree vertical axis
      ctx.fillStyle = dist === this.config.obstacleWarnCm ? (isDark ? '#fca5a5' : '#b91c1c') : textColor;
      ctx.fillText(`${dist} cm`, originX, originY - r - 2);
    }

    // 3. Draw radial angle lines (0°, 30°, 60°, 90°, 120°, 150°, 180°)
    const angleLabels = [0, 30, 45, 60, 90, 120, 135, 150, 180];
    for (const deg of angleLabels) {
      // 0 deg is left (East = 0 in standard math, but radar 0 deg is left, 90 is forward, 180 is right)
      // Math rad: 0 deg = PI, 90 deg = 1.5 * PI, 180 deg = 2 * PI
      const rad = Math.PI + (deg * Math.PI) / 180;
      const x = originX + Math.cos(rad) * radius;
      const y = originY + Math.sin(rad) * radius;

      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = deg === 90 ? gridStrongColor : gridColor;
      ctx.lineWidth = deg === 90 ? 1.5 : 1;
      ctx.stroke();

      // Outer angle label
      const labelX = originX + Math.cos(rad) * (radius + 14);
      const labelY = originY + Math.sin(rad) * (radius + 14);
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(`${deg}°`, labelX, labelY);
    }

    // 4. Draw samples with freshness decay
    const now = Date.now();
    for (const sample of this.samples) {
      const ageMs = now - sample.timestamp;
      if (ageMs > this.config.sampleTtlMs) continue;

      const alpha = Math.max(0.1, 1 - ageMs / this.config.sampleTtlMs);

      // Handle invalid or out-of-range echo
      if (!sample.valid || sample.distCm <= 0 || sample.distCm > this.config.maxDistanceCm) {
        // Draw faint grey hash mark at outer boundary for "no reflection / out of range"
        const rad = Math.PI + (sample.angle * Math.PI) / 180;
        const x = originX + Math.cos(rad) * (radius - 4);
        const y = originY + Math.sin(rad) * (radius - 4);

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? `rgba(156, 163, 175, ${alpha * 0.4})` : `rgba(107, 114, 128, ${alpha * 0.4})`;
        ctx.fill();
        continue;
      }

      // Valid reflection inside measurable range
      const sampleR = (sample.distCm / this.config.maxDistanceCm) * radius;
      const rad = Math.PI + (sample.angle * Math.PI) / 180;
      const sx = originX + Math.cos(rad) * sampleR;
      const sy = originY + Math.sin(rad) * sampleR;

      let color = clearBlipColor;
      if (sample.distCm < this.config.obstacleWarnCm) {
        color = critBlipColor;
      } else if (sample.distCm < this.config.obstacleWarnCm * 1.6) {
        color = warnBlipColor;
      }

      // Sample glow halo
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fill();

      // Sample solid center
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 5. Draw active sweep needle & trailing sector
    const sweepRad = Math.PI + (this.currentSweepAngle * Math.PI) / 180;
    const sweepX = originX + Math.cos(sweepRad) * radius;
    const sweepY = originY + Math.sin(sweepRad) * radius;

    // Sweep needle
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(sweepX, sweepY);
    ctx.strokeStyle = sweepLineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center pivot point
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = sweepLineColor;
    ctx.fill();

    // Current angle indicator badge
    ctx.fillStyle = isDark ? '#00e5ff' : '#0077aa';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`SERVO: ${Math.round(this.currentSweepAngle)}°`, originX, originY + 6);

    // 6. Tank movement notice if tank is currently traveling
    if (this.isTankMoving) {
      ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⚠ Movement skew active: samples relative to moving base', 12, 10);
    }
  }
}
