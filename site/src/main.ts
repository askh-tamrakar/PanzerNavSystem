/**
 * Main application entry point for PanzerNavSystem
 */

import { ThemeManager } from './theme';
import { RadarRenderer } from './radar';
import { TankController } from './controller';
import { DriveDirection, ObstacleMode, ConnectionState, TelemetryData } from './types';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Manager
  const themeManager = new ThemeManager();
  const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
  const iconMoon = document.getElementById('theme-icon-moon') as HTMLElement;
  const iconSun = document.getElementById('theme-icon-sun') as HTMLElement;

  const updateThemeIcons = (theme: string) => {
    if (theme === 'dark') {
      iconMoon.style.display = 'block';
      iconSun.style.display = 'none';
    } else {
      iconMoon.style.display = 'none';
      iconSun.style.display = 'block';
    }
  };

  updateThemeIcons(themeManager.getTheme());

  themeToggleBtn.addEventListener('click', () => {
    const next = themeManager.toggleTheme();
    updateThemeIcons(next);
    radar.setTheme(next);
  });

  // 2. Radar Visualization Canvas
  const radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
  const radar = new RadarRenderer(radarCanvas);
  radar.setTheme(themeManager.getTheme());

  // 3. DOM Elements
  const connBadge = document.getElementById('conn-badge') as HTMLElement;
  const connText = document.getElementById('conn-text') as HTMLElement;
  const statusMsgBanner = document.getElementById('status-msg-banner') as HTMLElement;

  const obstacleBanner = document.getElementById('obstacle-banner') as HTMLElement;
  const obstacleStatusText = document.getElementById('obstacle-status-text') as HTMLElement;
  const obstacleDistanceText = document.getElementById('obstacle-distance-text') as HTMLElement;
  const obstacleModeBadge = document.getElementById('obstacle-mode-badge') as HTMLElement;

  const telemState = document.getElementById('telem-state') as HTMLElement;
  const telemDist = document.getElementById('telem-dist') as HTMLElement;
  const telemAngle = document.getElementById('telem-angle') as HTMLElement;
  const telemSpeed = document.getElementById('telem-speed') as HTMLElement;

  const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
  const speedDisplay = document.getElementById('speed-display') as HTMLElement;

  const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
  const btnReverse = document.getElementById('btn-reverse') as HTMLButtonElement;
  const btnLeft = document.getElementById('btn-left') as HTMLButtonElement;
  const btnRight = document.getElementById('btn-right') as HTMLButtonElement;
  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;

  const btnModeToggle = document.getElementById('btn-mode-toggle') as HTMLButtonElement;
  const btnModeTitle = document.getElementById('btn-mode-title') as HTMLElement;
  const btnEffect = document.getElementById('btn-effect') as HTMLButtonElement;

  const settingsToggleBtn = document.getElementById('settings-toggle-btn') as HTMLButtonElement;
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
  const wsUrlInput = document.getElementById('ws-url-input') as HTMLInputElement;
  const wsSaveBtn = document.getElementById('ws-save-btn') as HTMLButtonElement;

  // 4. Tank Controller Setup
  const controller = new TankController({
    onConnectionChange: (state: ConnectionState, message?: string) => {
      connBadge.className = `conn-badge ${state}`;
      connText.textContent = state.toUpperCase();

      if (message) {
        statusMsgBanner.textContent = message;
      }

      if (state === 'connected') {
        statusMsgBanner.textContent = `Connected to tank firmware. System operational.`;
      } else if (state === 'error' || state === 'disconnected') {
        telemState.textContent = 'DISCONNECTED';
      }
    },

    onTelemetry: (telemetry: TelemetryData) => {
      telemState.textContent = telemetry.state.toUpperCase();
      telemDist.textContent = telemetry.distCm >= 0 ? `${telemetry.distCm.toFixed(1)} cm` : 'Out of range';
      telemAngle.textContent = `${Math.round(telemetry.sweepAngle)}°`;
      telemSpeed.textContent = `${telemetry.speed}% / ${telemetry.uptime}s`;

      radar.setSweepAngle(telemetry.sweepAngle);
      radar.setTankMoving(telemetry.state === 'driving');
    },

    onScanSample: (sample) => {
      radar.addSample(sample.angle, sample.distCm, sample.valid);
    },

    onObstacleAlert: (obstacle: boolean, distCm: number) => {
      if (obstacle) {
        obstacleBanner.className = 'obstacle-alert danger';
        obstacleStatusText.textContent = '⚠ OBSTACLE DETECTED!';
        obstacleDistanceText.textContent = `${distCm.toFixed(1)} cm`;
      } else if (distCm > 0 && distCm < 45) {
        obstacleBanner.className = 'obstacle-alert warning';
        obstacleStatusText.textContent = 'CAUTION: PROXIMITY';
        obstacleDistanceText.textContent = `${distCm.toFixed(1)} cm`;
      } else {
        obstacleBanner.className = 'obstacle-alert clear';
        obstacleStatusText.textContent = 'PATH CLEAR';
        obstacleDistanceText.textContent = distCm >= 0 ? `${distCm.toFixed(1)} cm` : '-- cm';
      }
    },

    onModeChange: (mode: ObstacleMode) => {
      const isAuto = mode === 'auto';
      obstacleModeBadge.textContent = `MODE: ${isAuto ? 'AUTO STOP' : 'MANUAL'}`;
      btnModeTitle.textContent = `Mode: ${isAuto ? 'Auto Stop' : 'Manual'}`;
    },
  });

  // Initialize input field with current controller URL
  wsUrlInput.value = controller.getWsUrl();

  // 5. Directional Button Handlers
  const bindDriveButton = (button: HTMLButtonElement, dir: DriveDirection) => {
    const handleStart = (e: Event) => {
      e.preventDefault();
      button.classList.add('active');
      controller.startDrive(dir);
    };

    const handleEnd = (e: Event) => {
      e.preventDefault();
      button.classList.remove('active');
      controller.stopDrive();
    };

    // Use Pointer events for seamless mobile touch and desktop mouse support
    button.addEventListener('pointerdown', handleStart);
    button.addEventListener('pointerup', handleEnd);
    button.addEventListener('pointercancel', handleEnd);
    button.addEventListener('pointerleave', handleEnd);
  };

  bindDriveButton(btnForward, 'forward');
  bindDriveButton(btnReverse, 'reverse');
  bindDriveButton(btnLeft, 'left');
  bindDriveButton(btnRight, 'right');

  // Prominent Emergency Stop
  btnStop.addEventListener('click', (e) => {
    e.preventDefault();
    controller.stopDrive();
  });

  // 6. Keyboard Control
  const activeKeys = new Set<string>();

  window.addEventListener('keydown', (e) => {
    // Avoid capturing keys when user is typing in URL input
    if (document.activeElement === wsUrlInput) return;

    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault();
    }

    if (activeKeys.has(key)) return;
    activeKeys.add(key);

    if (key === ' ' || key === 'escape') {
      controller.stopDrive();
      btnStop.classList.add('active');
      setTimeout(() => btnStop.classList.remove('active'), 150);
      return;
    }

    if (key === 'w' || key === 'arrowup') {
      btnForward.classList.add('active');
      controller.startDrive('forward');
    } else if (key === 's' || key === 'arrowdown') {
      btnReverse.classList.add('active');
      controller.startDrive('reverse');
    } else if (key === 'a' || key === 'arrowleft') {
      btnLeft.classList.add('active');
      controller.startDrive('left');
    } else if (key === 'd' || key === 'arrowright') {
      btnRight.classList.add('active');
      controller.startDrive('right');
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    activeKeys.delete(key);

    if (key === 'w' || key === 'arrowup') btnForward.classList.remove('active');
    if (key === 's' || key === 'arrowdown') btnReverse.classList.remove('active');
    if (key === 'a' || key === 'arrowleft') btnLeft.classList.remove('active');
    if (key === 'd' || key === 'arrowright') btnRight.classList.remove('active');

    // If no drive keys are pressed, halt tank
    const hasMovementKey = Array.from(activeKeys).some((k) =>
      ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
    );

    if (!hasMovementKey) {
      controller.stopDrive();
    }
  });

  // 7. Speed Slider & Presets
  speedSlider.addEventListener('input', () => {
    const val = parseInt(speedSlider.value, 10);
    speedDisplay.textContent = `${val}%`;
    controller.setSpeed(val);
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetSpeed = parseInt((btn as HTMLElement).dataset.speed || '65', 10);
      speedSlider.value = targetSpeed.toString();
      speedDisplay.textContent = `${targetSpeed}%`;
      controller.setSpeed(targetSpeed);
    });
  });

  // 8. Obstacle Mode Toggle
  btnModeToggle.addEventListener('click', () => {
    const current = controller.getObstacleMode();
    const next = current === 'auto' ? 'manual' : 'auto';
    controller.setObstacleMode(next);
  });

  // 9. Harmless Simulated Effect Button
  btnEffect.addEventListener('click', () => {
    controller.triggerHarmlessEffect();
    statusMsgBanner.textContent = 'Simulated effect triggered (harmless LED / sound pulse).';
  });

  // 10. Settings Drawer & URL Configuration
  settingsToggleBtn.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.toggle('open');
    settingsToggleBtn.setAttribute('aria-expanded', isOpen.toString());
  });

  wsSaveBtn.addEventListener('click', () => {
    const url = wsUrlInput.value.trim();
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      alert('WebSocket URL must start with ws:// or wss://');
      return;
    }
    controller.setWsUrl(url);
    statusMsgBanner.textContent = `Target set to ${url}. Reconnecting...`;
  });
});
