/**
 * ControlPanel.tsx
 * Complete hardware and radar control suite:
 * - Start/Stop continuous scanning
 * - Angular resolution tuning (1°, 2°, 3°, 5°, 0.25°)
 * - Servo scan speed & mechanical settle delay
 * - Min/Max detection distance boundaries
 * - Calibration offset & temperature compensation controls
 * - Manual servo angle positioning & single ping
 * - Interactive Analog Joystick + Direction Keys + Speed slider
 * - Aiming & Steering auxiliary servo sliders
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RadarConfig, DriveDirection } from '../types/radar';

interface ControlPanelProps {
  config: RadarConfig;
  onUpdateConfig: (partial: Partial<RadarConfig>) => void;
  onManualAngle: (angle: number) => void;
  onPing: () => void;
  onDrive: (dir: DriveDirection, speed: number) => void;
  onStopDrive: () => void;
  onSteering: (left: number, right: number) => void;
  onAiming: (angle: number) => void;
  onEffect: () => void;
  onResetRadar: () => void;
  onClearObstacles: () => void;
  wsUrl: string;
  onSaveWsUrl: (url: string) => void;
  onResetWsUrl: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onUpdateConfig,
  onManualAngle,
  onPing,
  onDrive,
  onStopDrive,
  onSteering,
  onAiming,
  onEffect,
  onResetRadar,
  onClearObstacles,
  wsUrl,
  onSaveWsUrl,
  onResetWsUrl,
}) => {
  // Local state for sliders
  const [speed, setSpeed] = useState<number>(65);
  const [aimingAngle, setAimingAngle] = useState<number>(90);
  const [steeringAngle, setSteeringAngle] = useState<number>(90);
  const [manualAngle, setManualAngle] = useState<number>(90);
  const [wsInputUrl, setWsInputUrl] = useState<string>(wsUrl);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [activeDir, setActiveDir] = useState<DriveDirection>('stop');

  // Joystick refs
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const [joystickStatus, setJoystickStatus] = useState<string>('IDLE (CENTERED)');
  const isDraggingRef = useRef<boolean>(false);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    setWsInputUrl(wsUrl);
  }, [wsUrl]);

  // Joystick touch/mouse event handling
  const resetJoystick = useCallback(() => {
    isDraggingRef.current = false;
    pointerIdRef.current = null;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
    if (joystickBaseRef.current) {
      joystickBaseRef.current.classList.remove('dragging');
    }
    setJoystickStatus('IDLE (CENTERED)');
    setActiveDir('stop');
    onStopDrive();
  }, [onStopDrive]);

  const handleJoystickPointer = useCallback(
    (clientX: number, clientY: number) => {
      const base = joystickBaseRef.current;
      if (!base) return;

      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      const maxR = rect.width / 2 - 18; // ~55px
      const deadzone = 12;

      const clampedDist = Math.min(dist, maxR);
      const angleRad = Math.atan2(dy, dx);
      const kx = Math.cos(angleRad) * clampedDist;
      const ky = Math.sin(angleRad) * clampedDist;

      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
      }

      if (dist < deadzone) {
        if (activeDir !== 'stop') {
          setActiveDir('stop');
          setJoystickStatus('IDLE (CENTERED)');
          onStopDrive();
        }
        return;
      }

      const power = Math.min(1.0, (clampedDist - deadzone) / (maxR - deadzone));
      const angleDeg = angleRad * (180 / Math.PI);

      let dir: DriveDirection;
      if (angleDeg >= -135 && angleDeg < -45) dir = 'forward';
      else if (angleDeg >= 45 && angleDeg < 135) dir = 'reverse';
      else if (angleDeg >= -45 && angleDeg < 45) dir = 'right';
      else dir = 'left';

      setActiveDir(dir);
      setJoystickStatus(`${dir.toUpperCase()} • ${Math.round(power * 100)}%`);
      onDrive(dir, speed);
    },
    [activeDir, onDrive, onStopDrive, speed]
  );

  useEffect(() => {
    const base = joystickBaseRef.current;
    if (!base) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      base.setPointerCapture(e.pointerId);
      base.classList.add('dragging');
      handleJoystickPointer(e.clientX, e.clientY);
    };

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      handleJoystickPointer(e.clientX, e.clientY);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === pointerIdRef.current) {
        try {
          base.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        resetJoystick();
      }
    };

    base.addEventListener('pointerdown', onDown);
    base.addEventListener('pointermove', onMove);
    base.addEventListener('pointerup', onUp);
    base.addEventListener('pointercancel', onUp);
    base.addEventListener('lostpointercapture', resetJoystick);

    return () => {
      base.removeEventListener('pointerdown', onDown);
      base.removeEventListener('pointermove', onMove);
      base.removeEventListener('pointerup', onUp);
      base.removeEventListener('pointercancel', onUp);
      base.removeEventListener('lostpointercapture', resetJoystick);
    };
  }, [handleJoystickPointer, resetJoystick]);

  // Keyboard navigation support
  useEffect(() => {
    const activeKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      if (activeKeys.has(key)) return;
      activeKeys.add(key);

      if (key === ' ' || key === 'escape') {
        onStopDrive();
        setActiveDir('stop');
        return;
      }

      if (key === 'w' || key === 'arrowup') {
        setActiveDir('forward');
        onDrive('forward', speed);
      } else if (key === 's' || key === 'arrowdown') {
        setActiveDir('reverse');
        onDrive('reverse', speed);
      } else if (key === 'a' || key === 'arrowleft') {
        setActiveDir('left');
        onDrive('left', speed);
      } else if (key === 'd' || key === 'arrowright') {
        setActiveDir('right');
        onDrive('right', speed);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      activeKeys.delete(key);

      const hasMoveKey = Array.from(activeKeys).some((k) =>
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
      );

      if (!hasMoveKey && !isDraggingRef.current) {
        setActiveDir('stop');
        onStopDrive();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onDrive, onStopDrive, speed]);

  return (
    <div className="controls-column">
      {/* 1. Radar Scanning & Accuracy Calibration Controls */}
      <section className="panel-card" aria-labelledby="radar-settings-title">
        <div className="card-header">
          <h2 id="radar-settings-title" className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Radar Scanner & Accuracy Tuning
          </h2>
          <button
            className={`quick-btn ${config.scanning ? 'active' : ''}`}
            style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
            onClick={() => onUpdateConfig({ scanning: !config.scanning })}
          >
            {config.scanning ? '⏹ Pause Scan' : '▶ Start Scan'}
          </button>
        </div>

        {/* Angular Resolution Selector (1°, 2°, 3°, 5°, 0.25°) */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Angular Step Resolution:</span>
            <span className="box-val">{config.stepDeg}° per step</span>
          </div>
          <div className="slider-quick-buttons" style={{ marginTop: '0.35rem' }}>
            {[0.25, 1, 2, 3, 5, 10].map((deg) => (
              <button
                key={deg}
                className={`quick-btn ${config.stepDeg === deg ? 'active' : ''}`}
                onClick={() => onUpdateConfig({ stepDeg: deg })}
              >
                {deg}° {deg === 0.25 ? '(Smooth)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Scan Speed & Settling Delay */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Servo Mechanical Settle Delay:</span>
            <span className="box-val">{config.settleMs} ms</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="10"
            max="60"
            step="5"
            value={config.settleMs}
            onChange={(e) => onUpdateConfig({ settleMs: parseInt(e.target.value, 10) })}
            aria-label="Adjust servo settling delay"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span>10 ms (High Speed)</span>
            <span>25 ms (Balanced)</span>
            <span>60 ms (High Precision)</span>
          </div>
        </div>

        {/* Distance Range Thresholds (Min & Max cm) */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Detection Distance Scale:</span>
            <span className="box-val">{config.minDistCm} cm &ndash; {config.maxDistCm} cm</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Min Range (Blind Spot Filter):</span>
              <input
                type="range"
                className="range-slider"
                min="2"
                max="25"
                step="1"
                value={config.minDistCm}
                onChange={(e) => onUpdateConfig({ minDistCm: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Max Scale (Boundary):</span>
              <input
                type="range"
                className="range-slider"
                min="50"
                max="300"
                step="25"
                value={config.maxDistCm}
                onChange={(e) => onUpdateConfig({ maxDistCm: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
        </div>

        {/* Temperature Compensation & Calibration Offset (Requirement 4.A & 1) */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Acoustic Calibration & Ambient Temp:</span>
            <span className="box-val">
              {config.tempC}°C &bull; Offset: {config.calibOffsetCm >= 0 ? '+' : ''}{config.calibOffsetCm} cm
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
            <div>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Air Temp (°C): {config.tempC}°C ({(331.3 + 0.606 * config.tempC).toFixed(1)} m/s)
              </label>
              <input
                type="range"
                className="range-slider"
                min="0"
                max="45"
                step="1"
                value={config.tempC}
                onChange={(e) => onUpdateConfig({ tempC: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Distance Calib Offset (cm):
              </label>
              <input
                type="number"
                className="text-input"
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                step="0.5"
                min="-15"
                max="15"
                value={config.calibOffsetCm}
                onChange={(e) => onUpdateConfig({ calibOffsetCm: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        {/* Manual Servo Position & Single Sonar Ping */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Manual Servo Positioning:</span>
            <span className="box-val">{manualAngle}°</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="0"
            max="180"
            step="1"
            value={manualAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setManualAngle(val);
              onManualAngle(val);
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button className="quick-btn" style={{ flex: 1 }} onClick={onPing}>
              📡 Single Ping Echo
            </button>
            <button className="quick-btn" style={{ flex: 1 }} onClick={onResetRadar}>
              🔄 Reset Radar Scope
            </button>
            <button className="quick-btn" style={{ flex: 1 }} onClick={onClearObstacles}>
              🧹 Clear Targets
            </button>
          </div>
        </div>
      </section>

      {/* 2. Tactical Propulsion Control (Joystick + Keys + Speed) */}
      <section className="panel-card" aria-labelledby="propulsion-panel-title">
        <div className="card-header">
          <h2 id="propulsion-panel-title" className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Propulsion Servos (Profile B: 8 Servos)
          </h2>
          <span className="telem-label">PROFILE B ACTIVE</span>
        </div>

        <div className="propulsion-controls-wrapper">
          {/* Virtual Analog Joystick */}
          <div className="joystick-card">
            <div className="box-header" style={{ justifyContent: 'center', marginBottom: '0.4rem' }}>
              <span className="box-label">🕹 Virtual Joystick</span>
            </div>
            <div
              ref={joystickBaseRef}
              className="joystick-base"
              aria-label="Analog Touch/Mouse Joystick"
              role="slider"
              aria-valuetext={joystickStatus}
            >
              <div className="joystick-ring ring-outer" />
              <div className="joystick-ring ring-mid" />
              <div className="joystick-ring ring-inner" />
              <div className="joystick-axis-h" />
              <div className="joystick-axis-v" />
              <div ref={joystickKnobRef} className="joystick-knob">
                <div className="joystick-knob-core" />
              </div>
            </div>
            <div className="joystick-status">{joystickStatus}</div>
          </div>

          {/* D-Pad Buttons */}
          <div className="dpad-container">
            <div className="box-header" style={{ justifyContent: 'center', marginBottom: '0.4rem' }}>
              <span className="box-label">🔲 Direction Keys</span>
            </div>
            <div className="dpad-grid" role="group" aria-label="Direction Controls">
              <button
                className={`ctrl-btn btn-up ${activeDir === 'forward' ? 'active' : ''}`}
                onPointerDown={() => { setActiveDir('forward'); onDrive('forward', speed); }}
                onPointerUp={() => { setActiveDir('stop'); onStopDrive(); }}
                title="Forward (W / ↑)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-8 8h6v8h4v-8h6z" /></svg>
              </button>

              <button
                className={`ctrl-btn btn-left ${activeDir === 'left' ? 'active' : ''}`}
                onPointerDown={() => { setActiveDir('left'); onDrive('left', speed); }}
                onPointerUp={() => { setActiveDir('stop'); onStopDrive(); }}
                title="Turn Left (A / ←)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l8-8v6h8v4h-8v6z" /></svg>
              </button>

              <button
                className="ctrl-btn btn-stop"
                onClick={() => { setActiveDir('stop'); onStopDrive(); }}
                title="Halt (Space)"
              >
                STOP
              </button>

              <button
                className={`ctrl-btn btn-right ${activeDir === 'right' ? 'active' : ''}`}
                onPointerDown={() => { setActiveDir('right'); onDrive('right', speed); }}
                onPointerUp={() => { setActiveDir('stop'); onStopDrive(); }}
                title="Turn Right (D / →)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12l-8-8v6h-8v4h8v6z" /></svg>
              </button>

              <button
                className={`ctrl-btn btn-down ${activeDir === 'reverse' ? 'active' : ''}`}
                onPointerDown={() => { setActiveDir('reverse'); onDrive('reverse', speed); }}
                onPointerUp={() => { setActiveDir('stop'); onStopDrive(); }}
                title="Reverse (S / ↓)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20l8-8h-6v-8h-4v8h-6z" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Speed Slider */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Propulsion Speed Limit:</span>
            <span className="box-val">{speed}%</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="10"
            max="100"
            step="5"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            aria-label="Speed limit"
          />
          <div className="slider-quick-buttons">
            <button className="quick-btn" onClick={() => setSpeed(35)}>35% Crawl</button>
            <button className="quick-btn" onClick={() => setSpeed(65)}>65% Cruise</button>
            <button className="quick-btn" onClick={() => setSpeed(100)}>100% Boost</button>
          </div>
        </div>

        <div className="kbd-hint">
          Keyboard: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>&uarr;</kbd><kbd>&larr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd> | Stop: <kbd>Space</kbd>
        </div>
      </section>

      {/* 3. Auxiliary Actuators (Turret Aiming Pan & Steering Servos) */}
      <section className="panel-card" aria-labelledby="aux-actuators-title">
        <div className="card-header">
          <h2 id="aux-actuators-title" className="card-title">Aiming & Steering Servos</h2>
          <span className="telem-label">3 AUX CHANNELS</span>
        </div>

        {/* Aiming Servo */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Turret Pan Aiming Servo:</span>
            <span className="box-val">{aimingAngle}°</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="30"
            max="150"
            step="2"
            value={aimingAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setAimingAngle(val);
              onAiming(val);
            }}
          />
          <div className="slider-quick-buttons">
            <button className="quick-btn" onClick={() => { setAimingAngle(45); onAiming(45); }}>45° Left</button>
            <button className="quick-btn" onClick={() => { setAimingAngle(90); onAiming(90); }}>90° Center</button>
            <button className="quick-btn" onClick={() => { setAimingAngle(135); onAiming(135); }}>135° Right</button>
          </div>
        </div>

        {/* Steering Servos */}
        <div className="control-box">
          <div className="box-header">
            <span className="box-label">Dual Steering Servos (Left & Right):</span>
            <span className="box-val">{steeringAngle}°</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="45"
            max="135"
            step="1"
            value={steeringAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setSteeringAngle(val);
              onSteering(val, val);
            }}
          />
          <div className="slider-quick-buttons">
            <button className="quick-btn" onClick={() => { setSteeringAngle(60); onSteering(60, 60); }}>60° Left</button>
            <button className="quick-btn" onClick={() => { setSteeringAngle(90); onSteering(90, 90); }}>90° Center</button>
            <button className="quick-btn" onClick={() => { setSteeringAngle(120); onSteering(120, 120); }}>120° Right</button>
          </div>
        </div>

        <button className="action-btn btn-effect" style={{ marginTop: '0.5rem', width: '100%' }} onClick={onEffect}>
          ⚡ Simulated Muzzle Flash / Sound (Harmless)
        </button>
      </section>

      {/* 4. Connection Settings Drawer */}
      <section className="panel-card">
        <button
          className="settings-toggle"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((prev) => !prev)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          ESP-12E WebSocket Connection Settings
        </button>

        {settingsOpen && (
          <div className="settings-content open" style={{ marginTop: '0.65rem' }}>
            <label htmlFor="ws-url-input-ctrl" className="telem-label">Target ESP8266 WebSocket Endpoint</label>
            <div className="input-row">
              <input
                type="text"
                id="ws-url-input-ctrl"
                className="text-input"
                value={wsInputUrl}
                onChange={(e) => setWsInputUrl(e.target.value)}
                placeholder="ws://192.168.4.1:81/"
              />
              <button className="save-btn" onClick={() => onSaveWsUrl(wsInputUrl)}>
                Connect
              </button>
              <button
                className="save-btn"
                style={{ background: 'var(--bg-card-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                onClick={onResetWsUrl}
              >
                Reset AP
              </button>
            </div>
            <div className="input-help">
              Default AP mode endpoint is <code>ws://192.168.4.1:81/</code>. When served from ESP LittleFS flash, connection auto-resolves to the host.
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
