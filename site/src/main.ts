/**
 * Main application entry point for PanzerNavSystem
 * Supports 8 Actuators:
 * - 4 Propulsion channels (Forward/Reverse/Turn/Speed/Stop)
 * - 2 Steering servos (Left & Right)
 * - 1 Aiming servo (Left / Right pan)
 * - 1 Scanner servo (Ultrasonic sweep)
 */

import { ThemeManager } from './theme';
import { RadarRenderer } from './radar';
import { TankController } from './controller';
import {
  DriveDirection,
  ObstacleMode,
  HardwareProfile,
  ConnectionState,
  TelemetryData,
} from './types';

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

  const reconnectCard = document.getElementById('reconnect-card') as HTMLElement;
  const btnReconnectNow = document.getElementById('btn-reconnect-now') as HTMLButtonElement;
  const netApLabel = document.getElementById('net-ap-label') as HTMLElement;
  const netClientsCount = document.getElementById('net-clients-count') as HTMLElement;
  const telemWifiSsid = document.getElementById('telem-wifi-ssid') as HTMLElement;
  const telemWifiDetails = document.getElementById('telem-wifi-details') as HTMLElement;

  const profileBanner = document.getElementById('profile-banner') as HTMLElement;
  const profileTitle = document.getElementById('profile-title') as HTMLElement;
  const profileDesc = document.getElementById('profile-desc') as HTMLElement;
  const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
  const dpadOverlay = document.getElementById('dpad-overlay') as HTMLElement;
  const propulsionModeLabel = document.getElementById('propulsion-mode-label') as HTMLElement;

  const obstacleBanner = document.getElementById('obstacle-banner') as HTMLElement;
  const obstacleStatusText = document.getElementById('obstacle-status-text') as HTMLElement;
  const obstacleDistanceText = document.getElementById('obstacle-distance-text') as HTMLElement;
  const obstacleModeBadge = document.getElementById('obstacle-mode-badge') as HTMLElement;

  const telemState = document.getElementById('telem-state') as HTMLElement;
  const telemDist = document.getElementById('telem-dist') as HTMLElement;
  const telemAngle = document.getElementById('telem-angle') as HTMLElement;
  const telemSpeed = document.getElementById('telem-speed') as HTMLElement;
  const telemAiming = document.getElementById('telem-aiming') as HTMLElement;
  const telemSteering = document.getElementById('telem-steering') as HTMLElement;
  const telemProfile = document.getElementById('telem-profile') as HTMLElement;
  const telemHeap = document.getElementById('telem-heap') as HTMLElement;

  const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
  const speedDisplay = document.getElementById('speed-display') as HTMLElement;

  const aimingSlider = document.getElementById('aiming-slider') as HTMLInputElement;
  const aimingDisplay = document.getElementById('aiming-display') as HTMLElement;
  const btnAimLeft = document.getElementById('btn-aim-left') as HTMLButtonElement;
  const btnAimCenter = document.getElementById('btn-aim-center') as HTMLButtonElement;
  const btnAimRight = document.getElementById('btn-aim-right') as HTMLButtonElement;

  const steeringSlider = document.getElementById('steering-slider') as HTMLInputElement;
  const steeringDisplay = document.getElementById('steering-display') as HTMLElement;
  const btnSteerLeft = document.getElementById('btn-steer-left') as HTMLButtonElement;
  const btnSteerCenter = document.getElementById('btn-steer-center') as HTMLButtonElement;
  const btnSteerRight = document.getElementById('btn-steer-right') as HTMLButtonElement;

  const scannerLimitsDisplay = document.getElementById('scanner-limits-display') as HTMLElement;
  const btnScanModeAuto = document.getElementById('btn-scan-mode-auto') as HTMLButtonElement;
  const btnScanModeManual = document.getElementById('btn-scan-mode-manual') as HTMLButtonElement;
  const scannerStepVal = document.getElementById('scanner-step-val') as HTMLElement;
  const stepButtons = [
    { el: document.getElementById('btn-step-5') as HTMLButtonElement, val: 5 },
    { el: document.getElementById('btn-step-10') as HTMLButtonElement, val: 10 },
    { el: document.getElementById('btn-step-15') as HTMLButtonElement, val: 15 },
    { el: document.getElementById('btn-step-20') as HTMLButtonElement, val: 20 },
    { el: document.getElementById('btn-step-30') as HTMLButtonElement, val: 30 },
    { el: document.getElementById('btn-step-45') as HTMLButtonElement, val: 45 },
  ];
  const btnScanFull = document.getElementById('btn-scan-full') as HTMLButtonElement;
  const btnScanWide = document.getElementById('btn-scan-wide') as HTMLButtonElement;
  const btnScanNarrow = document.getElementById('btn-scan-narrow') as HTMLButtonElement;
  const scannerAutoPanel = document.getElementById('scanner-auto-panel') as HTMLElement;
  const scannerManualPanel = document.getElementById('scanner-manual-panel') as HTMLElement;
  const scannerManualAngleDisplay = document.getElementById('scanner-manual-angle-display') as HTMLElement;
  const btnStepLeft = document.getElementById('btn-step-left') as HTMLButtonElement;
  const btnStepRight = document.getElementById('btn-step-right') as HTMLButtonElement;
  const btnScanPing = document.getElementById('btn-scan-ping') as HTMLButtonElement;
  const scannerSlider = document.getElementById('scanner-slider') as HTMLInputElement;
  const snapButtons = [
    { el: document.getElementById('btn-snap-0') as HTMLButtonElement, angle: 0 },
    { el: document.getElementById('btn-snap-45') as HTMLButtonElement, angle: 45 },
    { el: document.getElementById('btn-snap-90') as HTMLButtonElement, angle: 90 },
    { el: document.getElementById('btn-snap-135') as HTMLButtonElement, angle: 135 },
    { el: document.getElementById('btn-snap-180') as HTMLButtonElement, angle: 180 },
  ];

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
  const wsResetBtn = document.getElementById('ws-reset-btn') as HTMLButtonElement;

  // 4. UI Helper: Update Profile UI
  const updateProfileUI = (profile: HardwareProfile) => {
    profileSelect.value = profile;

    if (profile === 'unconfirmed') {
      profileBanner.className = 'profile-banner unconfirmed';
      profileTitle.textContent = 'PROFILE: UNCONFIRMED';
      profileDesc.textContent = 'Propulsion actuators unverified. Select active profile:';
      dpadOverlay.classList.add('visible');
      propulsionModeLabel.textContent = 'PROFILE: UNCONFIRMED';
      telemProfile.textContent = 'UNCONFIRMED';
    } else if (profile === 'profile_a_dc') {
      profileBanner.className = 'profile-banner confirmed';
      profileTitle.textContent = 'PROFILE A: 4 DC MOTORS';
      profileDesc.textContent = '2x L298N drivers active. 4 servos on auxiliary channels.';
      dpadOverlay.classList.remove('visible');
      propulsionModeLabel.textContent = 'PROFILE A: 4 DC MOTORS (2x L298N)';
      telemProfile.textContent = 'PROFILE A (DC)';
    } else if (profile === 'profile_b_servo') {
      profileBanner.className = 'profile-banner confirmed';
      profileTitle.textContent = 'PROFILE B: 4 PROPULSION SERVOS';
      profileDesc.textContent = 'All 8 actuators driven via servo controller. 2x L298N unused.';
      dpadOverlay.classList.remove('visible');
      propulsionModeLabel.textContent = 'PROFILE B: 4 PROPULSION SERVOS';
      telemProfile.textContent = 'PROFILE B (SERVOS)';
    }
  };

  // 5. Tank Controller Setup
  const controller = new TankController({
    onConnectionChange: (state: ConnectionState, message?: string) => {
      connBadge.className = `conn-badge ${state}`;
      connText.textContent = state.toUpperCase();

      if (message) {
        statusMsgBanner.textContent = message;
      }

      if (state === 'connected') {
        statusMsgBanner.textContent = `Connected to firmware. 8-actuator system ready.`;
        if (reconnectCard) reconnectCard.classList.remove('visible');
      } else if (state === 'error' || state === 'disconnected') {
        telemState.textContent = 'DISCONNECTED';
        if (reconnectCard) reconnectCard.classList.add('visible');
      }
    },

    onProfileChange: (profile: HardwareProfile) => {
      updateProfileUI(profile);
    },

    onTelemetry: (telemetry: TelemetryData) => {
      telemState.textContent = telemetry.state.toUpperCase();
      telemDist.textContent = telemetry.distCm >= 0 ? `${telemetry.distCm.toFixed(1)} cm` : 'Out of range';
      telemAngle.textContent = `${Math.round(telemetry.sweepAngle)}°`;
      telemSpeed.textContent = `${telemetry.speed}% / ${telemetry.uptime}s`;

      telemAiming.textContent = `${Math.round(telemetry.aimingAngle)}°`;
      telemSteering.textContent = `${Math.round(telemetry.steeringLeftAngle)}° / ${Math.round(telemetry.steeringRightAngle)}°`;

      if (telemetry.freeHeap) {
        telemHeap.textContent = `${Math.round(telemetry.freeHeap / 1024)} KB`;
      }

      if (telemetry.apSsid) {
        if (telemWifiSsid) telemWifiSsid.textContent = telemetry.apSsid;
        if (netApLabel) netApLabel.textContent = `${telemetry.apSsid} (${telemetry.apIp || '192.168.4.1'})`;
      }

      if (typeof telemetry.apClients === 'number') {
        const clientText = `${telemetry.apClients} Client${telemetry.apClients === 1 ? '' : 's'}`;
        if (netClientsCount) netClientsCount.textContent = `${clientText} Connected`;
        if (telemWifiDetails) telemWifiDetails.textContent = `${clientText} / ${telemetry.wifiRssi ? telemetry.wifiRssi + ' dBm' : 'Local AP'}`;
      }

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

  wsUrlInput.value = controller.getWsUrl();
  updateProfileUI(controller.getHardwareProfile());

  // Profile selection listener
  profileSelect.addEventListener('change', () => {
    const selected = profileSelect.value as HardwareProfile;
    controller.setHardwareProfile(selected);
    updateProfileUI(selected);
  });

  // 6. Aiming Servo Handlers (Channel: Turret Pan)
  aimingSlider.addEventListener('input', () => {
    const angle = parseInt(aimingSlider.value, 10);
    aimingDisplay.textContent = `${angle}°`;
    controller.setAiming(angle);
  });

  btnAimLeft.addEventListener('click', () => {
    aimingSlider.value = '45';
    aimingDisplay.textContent = '45°';
    controller.setAiming(45);
  });

  btnAimCenter.addEventListener('click', () => {
    aimingSlider.value = '90';
    aimingDisplay.textContent = '90°';
    controller.setAiming(90);
  });

  btnAimRight.addEventListener('click', () => {
    aimingSlider.value = '135';
    aimingDisplay.textContent = '135°';
    controller.setAiming(135);
  });

  // 7. Steering Servos Handlers (Dual Steering Channels)
  steeringSlider.addEventListener('input', () => {
    const angle = parseInt(steeringSlider.value, 10);
    steeringDisplay.textContent = `${angle}° ${angle === 90 ? '(Straight)' : angle < 90 ? '(Left)' : '(Right)'}`;
    controller.setSteering(angle, angle);
  });

  btnSteerLeft.addEventListener('click', () => {
    steeringSlider.value = '60';
    steeringDisplay.textContent = '60° (Left)';
    controller.setSteering(60, 60);
  });

  btnSteerCenter.addEventListener('click', () => {
    steeringSlider.value = '90';
    steeringDisplay.textContent = '90° (Straight)';
    controller.setSteering(90, 90);
  });

  btnSteerRight.addEventListener('click', () => {
    steeringSlider.value = '120';
    steeringDisplay.textContent = '120° (Right)';
    controller.setSteering(120, 120);
  });

  // 8. Scanner Servo Limits & Manual Stepping Handlers (0° to 180°, divisors of 180)
  let currentScanMin = 0;
  let currentScanMax = 180;
  let currentScanStep = 10;
  let isScanAuto = true;
  let currentManualAngle = 90;

  const updateScannerUI = () => {
    if (isScanAuto) {
      btnScanModeAuto.classList.add('active');
      btnScanModeManual.classList.remove('active');
      scannerAutoPanel.style.display = 'block';
      scannerManualPanel.style.display = 'none';
      scannerLimitsDisplay.textContent = `AUTO (${currentScanMin}°–${currentScanMax}°, ${currentScanStep}° step)`;
    } else {
      btnScanModeAuto.classList.remove('active');
      btnScanModeManual.classList.add('active');
      scannerAutoPanel.style.display = 'none';
      scannerManualPanel.style.display = 'block';
      scannerLimitsDisplay.textContent = `MANUAL (${currentManualAngle}°, ${currentScanStep}° step)`;
      scannerManualAngleDisplay.textContent = `Angle: ${currentManualAngle}°`;
      btnStepLeft.textContent = `◀ Step Left (-${currentScanStep}°)`;
      btnStepRight.textContent = `Step Right (+${currentScanStep}°) ▶`;
    }
    scannerStepVal.textContent = `${currentScanStep}° (${180 / currentScanStep} steps)`;
    scannerSlider.step = currentScanStep.toString();
    scannerSlider.value = currentManualAngle.toString();

    stepButtons.forEach(({ el, val }) => {
      if (val === currentScanStep) el.classList.add('active');
      else el.classList.remove('active');
    });
  };

  btnScanModeAuto.addEventListener('click', () => {
    isScanAuto = true;
    updateScannerUI();
    controller.setScannerConfig(currentScanMin, currentScanMax, currentScanStep, 'auto');
  });

  btnScanModeManual.addEventListener('click', () => {
    isScanAuto = false;
    updateScannerUI();
    controller.setScannerConfig(currentScanMin, currentScanMax, currentScanStep, 'manual');
    controller.scannerSetManualAngle(currentManualAngle);
  });

  stepButtons.forEach(({ el, val }) => {
    el.addEventListener('click', () => {
      currentScanStep = val;
      // Snap current manual angle to multiple of new step
      currentManualAngle = Math.round(currentManualAngle / currentScanStep) * currentScanStep;
      currentManualAngle = Math.max(0, Math.min(180, currentManualAngle));
      updateScannerUI();
      if (isScanAuto) {
        controller.setScannerConfig(currentScanMin, currentScanMax, currentScanStep, 'auto');
      } else {
        controller.setScannerConfig(currentScanMin, currentScanMax, currentScanStep, 'manual');
        controller.scannerSetManualAngle(currentManualAngle);
      }
    });
  });

  btnScanFull.addEventListener('click', () => {
    currentScanMin = 0;
    currentScanMax = 180;
    btnScanFull.classList.add('active');
    btnScanWide.classList.remove('active');
    btnScanNarrow.classList.remove('active');
    updateScannerUI();
    controller.setScannerConfig(0, 180, currentScanStep, 'auto');
  });

  btnScanWide.addEventListener('click', () => {
    currentScanMin = 30;
    currentScanMax = 150;
    btnScanFull.classList.remove('active');
    btnScanWide.classList.add('active');
    btnScanNarrow.classList.remove('active');
    updateScannerUI();
    controller.setScannerConfig(30, 150, currentScanStep, 'auto');
  });

  btnScanNarrow.addEventListener('click', () => {
    currentScanMin = 45;
    currentScanMax = 135;
    btnScanFull.classList.remove('active');
    btnScanWide.classList.remove('active');
    btnScanNarrow.classList.add('active');
    updateScannerUI();
    controller.setScannerConfig(45, 135, currentScanStep, 'auto');
  });

  btnStepLeft.addEventListener('click', () => {
    isScanAuto = false;
    currentManualAngle = Math.max(0, currentManualAngle - currentScanStep);
    updateScannerUI();
    controller.scannerStepLeft(currentScanStep);
  });

  btnStepRight.addEventListener('click', () => {
    isScanAuto = false;
    currentManualAngle = Math.min(180, currentManualAngle + currentScanStep);
    updateScannerUI();
    controller.scannerStepRight(currentScanStep);
  });

  btnScanPing.addEventListener('click', () => {
    controller.scannerTriggerPing();
  });

  scannerSlider.addEventListener('input', () => {
    isScanAuto = false;
    currentManualAngle = parseInt(scannerSlider.value, 10);
    updateScannerUI();
    controller.scannerSetManualAngle(currentManualAngle);
  });

  snapButtons.forEach(({ el, angle }) => {
    el.addEventListener('click', () => {
      isScanAuto = false;
      currentManualAngle = angle;
      updateScannerUI();
      controller.scannerSetManualAngle(angle);
    });
  });

  // 9. Directional Button Handlers (Propulsion)
  const bindDriveButton = (button: HTMLButtonElement, dir: DriveDirection) => {
    const handleStart = (e: Event) => {
      e.preventDefault();
      if (controller.getHardwareProfile() === 'unconfirmed') {
        alert('Please select Profile A or Profile B before driving.');
        return;
      }
      button.classList.add('active');
      controller.startDrive(dir);
    };

    const handleEnd = (e: Event) => {
      e.preventDefault();
      button.classList.remove('active');
      controller.stopDrive();
    };

    button.addEventListener('pointerdown', handleStart);
    button.addEventListener('pointerup', handleEnd);
    button.addEventListener('pointercancel', handleEnd);
    button.addEventListener('pointerleave', handleEnd);
  };

  bindDriveButton(btnForward, 'forward');
  bindDriveButton(btnReverse, 'reverse');
  bindDriveButton(btnLeft, 'left');
  bindDriveButton(btnRight, 'right');

  btnStop.addEventListener('click', (e) => {
    e.preventDefault();
    controller.stopDrive();
  });

  // 10. Keyboard Navigation
  const activeKeys = new Set<string>();

  window.addEventListener('keydown', (e) => {
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

    const hasMovementKey = Array.from(activeKeys).some((k) =>
      ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
    );

    if (!hasMovementKey) {
      controller.stopDrive();
    }
  });

  // 11. Speed Slider & Presets
  speedSlider.addEventListener('input', () => {
    const val = parseInt(speedSlider.value, 10);
    speedDisplay.textContent = `${val}%`;
    controller.setSpeed(val);
  });

  document.querySelectorAll('.preset-speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetSpeed = parseInt((btn as HTMLElement).dataset.speed || '65', 10);
      speedSlider.value = targetSpeed.toString();
      speedDisplay.textContent = `${targetSpeed}%`;
      controller.setSpeed(targetSpeed);
    });
  });

  // 12. Safety Mode Toggle
  btnModeToggle.addEventListener('click', () => {
    const current = controller.getObstacleMode();
    const next = current === 'auto' ? 'manual' : 'auto';
    controller.setObstacleMode(next);
  });

  // 13. Harmless Simulated Effect Button
  btnEffect.addEventListener('click', () => {
    controller.triggerHarmlessEffect();
    statusMsgBanner.textContent = 'Simulated effect triggered (harmless LED / sound pulse).';
  });

  // 14. Settings Drawer & Connection Reconnect
  if (btnReconnectNow) {
    btnReconnectNow.addEventListener('click', () => {
      statusMsgBanner.textContent = 'Attempting reconnection to tank...';
      controller.reconnect();
    });
  }

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

  if (wsResetBtn) {
    wsResetBtn.addEventListener('click', () => {
      const defaultUrl = 'ws://192.168.4.1:81/';
      wsUrlInput.value = defaultUrl;
      controller.setWsUrl(defaultUrl);
      statusMsgBanner.textContent = `Reset to Tank AP default: ${defaultUrl}. Reconnecting...`;
    });
  }
});
