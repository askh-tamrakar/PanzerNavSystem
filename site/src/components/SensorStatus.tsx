/**
 * SensorStatus.tsx
 * Comprehensive hardware diagnostics and physical sensor telemetry panel.
 * Displays ESP8266 WebSocket health, HC-SR04 ultrasonic echo statistics,
 * servo scanning metrics, timing benchmarks, and essential acoustic limitations.
 */

import React from 'react';
import { SensorDiagnostics, TelemetryData } from '../types/radar';

interface SensorStatusProps {
  diagnostics: SensorDiagnostics;
  telemetry: TelemetryData;
}

export const SensorStatus: React.FC<SensorStatusProps> = ({
  diagnostics,
  telemetry,
}) => {
  const isConnected = diagnostics.connected;
  const cycleSec = (diagnostics.scanCycleDurationMs / 1000).toFixed(1);

  return (
    <section className="panel-card diagnostics-panel-card" aria-labelledby="status-panel-title">
      <div className="card-header">
        <h2 id="status-panel-title" className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Sensor Diagnostics & System Telemetry
        </h2>
        <span className={`conn-badge ${diagnostics.wsState}`}>
          <span className="conn-dot" />
          {diagnostics.wsState.toUpperCase()}
        </span>
      </div>

      {/* Real-time Diagnostics Grid */}
      <div className="telemetry-grid">
        <div className="telem-cell">
          <span className="telem-label">ESP8266 Health</span>
          <span className="telem-val" style={{ color: isConnected ? '#10b981' : '#ef4444' }}>
            {isConnected ? 'ONLINE (AP)' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">HC-SR04 Echo Status</span>
          <span className="telem-val" style={{ color: diagnostics.sensorOk ? '#10b981' : '#f59e0b' }}>
            {diagnostics.sensorOk ? 'SAMPLING (3x)' : 'FAULT / NO ECHO'}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Servo Sweep Angle</span>
          <span className="telem-val">{diagnostics.currentAngle.toFixed(1)}°</span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Latest Distance</span>
          <span className="telem-val">
            {diagnostics.currentDistance > 0 ? `${diagnostics.currentDistance.toFixed(1)} cm` : '--'}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Active Targets</span>
          <span className="telem-val">{diagnostics.totalObstacles} Tracks</span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Total Readings</span>
          <span className="telem-val">{telemetry.totalReadings || 0}</span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Echo Timeouts</span>
          <span className="telem-val" style={{ color: diagnostics.timeoutCount > 20 ? '#f59e0b' : 'inherit' }}>
            {diagnostics.timeoutCount}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Rejected Outliers</span>
          <span className="telem-val" style={{ color: diagnostics.invalidReadingCount > 20 ? '#f59e0b' : 'inherit' }}>
            {diagnostics.invalidReadingCount}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Scan Cycle Time</span>
          <span className="telem-val">
            {diagnostics.scanCycleDurationMs > 0 ? `${cycleSec}s` : 'Calculating...'}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Reading Variance</span>
          <span className="telem-val">&plusmn;{diagnostics.variance.toFixed(1)} cm</span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Free Heap Memory</span>
          <span className="telem-val">
            {telemetry.freeHeap ? `${Math.round(telemetry.freeHeap / 1024)} KB` : '--'}
          </span>
        </div>

        <div className="telem-cell">
          <span className="telem-label">Wi-Fi Signal / AP</span>
          <span className="telem-val">
            {telemetry.wifiRssi ? `${telemetry.wifiRssi} dBm` : 'Direct AP'}
          </span>
        </div>
      </div>

      {/* Acoustic Sensor Physical Limitations Box (Requirement 12.K) */}
      <div className="limitations-banner" style={{ marginTop: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#f59e0b' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          HC-SR04 Acoustic & Physical Sensor Characteristics
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          The HC-SR04 emits a 40 kHz ultrasonic wave with an inherent beam cone angle of approximately ~15°. It does not form an optical laser line or true microwave radar beam. Acoustic reflections off specular surfaces angled &gt;45° may bounce away without returning an echo. Soft textiles absorb echoes, while multiple nearby targets within the beam width merge into one reading. Approximate width estimates are computed mathematically and clearly denoted.
        </p>
      </div>
    </section>
  );
};
