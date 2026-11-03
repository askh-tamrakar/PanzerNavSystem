/**
 * App.tsx
 * Main application dashboard integrating:
 * - Phosphor CRT Radar PPI Scope (RadarCanvas)
 * - Intelligent Obstacle Detection & Telemetry (ObstaclePanel)
 * - Comprehensive Sensor Diagnostics (SensorStatus)
 * - Complete Hardware & Tank Control Suite (ControlPanel)
 */

import React, { useState } from 'react';
import { useRadarSocket } from './hooks/useRadarSocket';
import { RadarCanvas } from './components/RadarCanvas';
import { ObstaclePanel } from './components/ObstaclePanel';
import { SensorStatus } from './components/SensorStatus';
import { ControlPanel } from './components/ControlPanel';

export const App: React.FC = () => {
  const {
    wsUrl,
    setWsUrl,
    reconnect,
    connectionState,
    statusMessage,
    currentSweepAngle,
    samples,
    trackedObstacles,
    closestObstacle,
    config,
    updateConfig,
    telemetry,
    diagnostics,
    sendManualAngle,
    sendPing,
    sendDrive,
    stopDrive,
    sendSteering,
    sendAiming,
    sendEffect,
    clearObstacles,
    resetRadar,
  } = useRadarSocket();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="app-container" data-theme={theme}>
      {/* 1. Tactical Header */}
      <header className="app-header">
        <div className="brand-group">
          <svg className="brand-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#000c04" stroke="#00ff41" strokeWidth="1.5" />
            <circle cx="32" cy="32" r="22" stroke="#00ff41" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="32" cy="32" r="14" stroke="#00ff41" strokeWidth="1" />
            <line x1="32" y1="10" x2="32" y2="54" stroke="#00ff41" strokeWidth="1" opacity="0.6" />
            <line x1="10" y1="32" x2="54" y2="32" stroke="#00ff41" strokeWidth="1" opacity="0.6" />
            <circle cx="32" cy="32" r="4" fill="#39ff14" />
          </svg>
          <div>
            <h1 className="app-title">PANZER TACTICAL RADAR</h1>
            <div className="app-subtitle">ESP-12E &bull; HC-SR04 &bull; 8-SERVO SYSTEM (PROFILE B)</div>
          </div>
        </div>

        <div className="header-actions">
          {/* Connection Status Badge */}
          <div className={`conn-badge ${connectionState}`} role="status">
            <span className="conn-dot" />
            <span>{connectionState.toUpperCase()}</span>
          </div>

          {/* Theme Toggle */}
          <button
            className="btn-icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle phosphor theme"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* 2. Wi-Fi Access Point Status Banner */}
      <div className="net-banner" role="status">
        <div className="net-banner-left">
          <span className="net-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span>{telemetry.apSsid || 'PanzerTank-AP'} ({telemetry.apIp || '192.168.4.1'})</span>
          </span>
          <span className="net-badge-no-inet">Direct Tank AP &bull; No Router Required</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {statusMessage}
        </div>
      </div>

      {/* 3. Main Dashboard Grid */}
      <main className="app-main">
        {/* Left Column: Phosphor Radar Scope & Target Tracking List */}
        <div>
          {/* Offline Reconnection Troubleshooting Alert */}
          {!isConnected && (
            <div className="reconnect-card visible" role="alert">
              <div className="reconnect-card-title">
                <span>⚠ Tank Connection Offline</span>
                <button className="btn-reconnect" onClick={reconnect}>
                  Reconnect Now
                </button>
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', lineHeight: 1.5 }}>
                Ensure your phone/PC Wi-Fi is connected to <strong>PanzerTank-AP</strong> (password: <code>panzer123456</code>). Mobile data & private DNS should be disabled on phone.
              </div>
            </div>
          )}

          {/* CRT Phosphor Green Radar Canvas */}
          <section className="panel-card" style={{ padding: '0.75rem', overflow: 'hidden' }}>
            <RadarCanvas
              currentSweepAngle={currentSweepAngle}
              samples={samples}
              trackedObstacles={trackedObstacles}
              maxDistanceCm={config.maxDistCm}
              isScanning={config.scanning}
              tempC={config.tempC}
              calibOffsetCm={config.calibOffsetCm}
            />
          </section>

          {/* Advanced Obstacle Telemetry & Tracking Table */}
          <ObstaclePanel
            obstacles={trackedObstacles}
            closestObstacle={closestObstacle}
            onClearObstacles={clearObstacles}
          />
        </div>

        {/* Right Column: Hardware & Scanner Tuning Controls */}
        <div>
          <ControlPanel
            config={config}
            onUpdateConfig={updateConfig}
            onManualAngle={sendManualAngle}
            onPing={sendPing}
            onDrive={sendDrive}
            onStopDrive={stopDrive}
            onSteering={sendSteering}
            onAiming={sendAiming}
            onEffect={sendEffect}
            onResetRadar={resetRadar}
            onClearObstacles={clearObstacles}
            wsUrl={wsUrl}
            onSaveWsUrl={setWsUrl}
            onResetWsUrl={() => setWsUrl('ws://192.168.4.1:81/')}
          />
        </div>
      </main>

      {/* 4. Full-Width Sensor Diagnostics & Physical Limitations Footer */}
      <footer style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 1rem 2rem' }}>
        <SensorStatus diagnostics={diagnostics} telemetry={telemetry} />
      </footer>
    </div>
  );
};

export default App;
