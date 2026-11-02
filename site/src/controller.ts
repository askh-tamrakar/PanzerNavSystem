/**
 * Tank Controller & WebSocket Transport Client
 * Manages 8 actuators:
 * - 4 Propulsion channels (Forward/Reverse/Speed/Stop)
 * - 2 Steering servos (Left & Right angle)
 * - 1 Aiming servo (Pan angle)
 * - 1 Ultrasonic scanner servo
 */

import {
  DriveDirection,
  ObstacleMode,
  HardwareProfile,
  TelemetryData,
  ScanSample,
  ConnectionState,
} from './types';
import {
  buildDriveMessage,
  buildSteeringMessage,
  buildAimingMessage,
  buildScannerConfigMessage,
  buildScannerManualMessage,
  buildProfileSelectMessage,
  buildStopMessage,
  buildModeMessage,
  buildEffectMessage,
  buildPingMessage,
  serializeMessage,
  parseServerMessage,
  SPEED_MIN,
  SPEED_MAX,
  STEERING_MIN_ANGLE,
  STEERING_MAX_ANGLE,
  STEERING_CENTER_ANGLE,
  AIMING_MIN_ANGLE,
  AIMING_MAX_ANGLE,
  AIMING_CENTER_ANGLE,
} from './protocol';

const STORAGE_WS_KEY = 'panzer_nav_ws_url';
const DEFAULT_SPEED = 65;

export interface ControllerCallbacks {
  onConnectionChange: (state: ConnectionState, message?: string) => void;
  onTelemetry: (telemetry: TelemetryData) => void;
  onScanSample: (sample: ScanSample) => void;
  onObstacleAlert: (obstacle: boolean, distCm: number) => void;
  onModeChange: (mode: ObstacleMode) => void;
  onProfileChange: (profile: HardwareProfile) => void;
}

export class TankController {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;

  private currentDirection: DriveDirection = 'stop';
  private currentSpeed: number = DEFAULT_SPEED;
  private obstacleMode: ObstacleMode = 'auto';
  private hardwareProfile: HardwareProfile = 'unconfirmed';

  private steeringLeft: number = STEERING_CENTER_ANGLE;
  private steeringRight: number = STEERING_CENTER_ANGLE;
  private aimingAngle: number = AIMING_CENTER_ANGLE;

  private callbacks: ControllerCallbacks;
  private isAutoReconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;

  constructor(callbacks: ControllerCallbacks) {
    this.callbacks = callbacks;
    this.wsUrl = this.resolveInitialWsUrl();

    this.bindWindowEvents();
    this.connect();
  }

  public getWsUrl(): string {
    return this.wsUrl;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public setWsUrl(url: string): void {
    if (url === this.wsUrl) return;
    this.wsUrl = url.trim();
    localStorage.setItem(STORAGE_WS_KEY, this.wsUrl);
    this.reconnect();
  }

  public getHardwareProfile(): HardwareProfile {
    return this.hardwareProfile;
  }

  public setHardwareProfile(profile: HardwareProfile): void {
    this.hardwareProfile = profile;
    this.callbacks.onProfileChange(profile);
    if (this.isConnected()) {
      try {
        const msg = buildProfileSelectMessage(profile);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send profile select message:', e);
      }
    }
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public setSpeed(speed: number): void {
    const bounded = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(speed)));
    if (this.currentSpeed === bounded) return;
    this.currentSpeed = bounded;

    if (this.currentDirection !== 'stop') {
      this.sendDrive(this.currentDirection, this.currentSpeed);
    }
  }

  public getObstacleMode(): ObstacleMode {
    return this.obstacleMode;
  }

  public setObstacleMode(mode: ObstacleMode): void {
    this.obstacleMode = mode;
    this.callbacks.onModeChange(mode);
    if (this.isConnected()) {
      try {
        const msg = buildModeMessage(mode);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send mode command:', e);
      }
    }
  }

  public setSteering(leftAngle: number, rightAngle: number): void {
    this.steeringLeft = Math.max(STEERING_MIN_ANGLE, Math.min(STEERING_MAX_ANGLE, Math.round(leftAngle)));
    this.steeringRight = Math.max(STEERING_MIN_ANGLE, Math.min(STEERING_MAX_ANGLE, Math.round(rightAngle)));
    if (this.isConnected()) {
      try {
        const msg = buildSteeringMessage(this.steeringLeft, this.steeringRight);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send steering command:', e);
      }
    }
  }

  public getSteering(): { left: number; right: number } {
    return { left: this.steeringLeft, right: this.steeringRight };
  }

  public setAiming(angle: number): void {
    this.aimingAngle = Math.max(AIMING_MIN_ANGLE, Math.min(AIMING_MAX_ANGLE, Math.round(angle)));
    if (this.isConnected()) {
      try {
        const msg = buildAimingMessage(this.aimingAngle);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send aiming command:', e);
      }
    }
  }

  public getAiming(): number {
    return this.aimingAngle;
  }

  public setScannerConfig(minAngle: number, maxAngle: number, stepDeg: number, mode: 'auto' | 'manual' = 'auto'): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerConfigMessage(minAngle, maxAngle, stepDeg, mode);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner config command:', e);
      }
    }
  }

  public scannerStepLeft(stepDeg?: number): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerManualMessage('step_left', undefined, stepDeg);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner step left command:', e);
      }
    }
  }

  public scannerStepRight(stepDeg?: number): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerManualMessage('step_right', undefined, stepDeg);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner step right command:', e);
      }
    }
  }

  public scannerSetManualAngle(angle: number): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerManualMessage('set_angle', angle);
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner manual angle command:', e);
      }
    }
  }

  public scannerTriggerPing(): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerManualMessage('ping');
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner ping command:', e);
      }
    }
  }

  public scannerSetAuto(): void {
    if (this.isConnected()) {
      try {
        const msg = buildScannerManualMessage('auto');
        this.sendRaw(serializeMessage(msg));
      } catch (e) {
        console.error('Failed to send scanner auto command:', e);
      }
    }
  }

  public startDrive(dir: DriveDirection): void {
    if (this.hardwareProfile === 'unconfirmed') {
      console.warn('Drive blocked: hardware profile is unconfirmed.');
      this.callbacks.onConnectionChange(
        this.connectionState,
        'Cannot drive: Hardware profile is unconfirmed. Confirm Profile A or B in settings.'
      );
      return;
    }

    if (this.currentDirection === dir) {
      return;
    }
    this.currentDirection = dir;
    this.sendDrive(dir, this.currentSpeed);
  }

  public stopDrive(): void {
    if (this.currentDirection === 'stop') {
      return;
    }
    this.currentDirection = 'stop';
    this.sendStop();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public triggerHarmlessEffect(): void {
    if (!this.isConnected()) return;
    try {
      const msg = buildEffectMessage();
      this.sendRaw(serializeMessage(msg));
    } catch (e) {
      console.error('Failed to send simulation effect command:', e);
    }
  }

  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  public disconnect(): void {
    this.isAutoReconnectEnabled = false;
    this.clearTimers();
    if (this.ws) {
      try {
        this.stopDrive();
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
    this.updateState('disconnected', 'Disconnected by user');
  }

  private resolveInitialWsUrl(): string {
    const saved = localStorage.getItem(STORAGE_WS_KEY);
    if (saved && saved.startsWith('ws://')) {
      return saved;
    }

    const host = window.location.hostname;
    if (host && host !== '' && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:81/`;
    }

    return 'ws://192.168.4.1:81/';
  }

  private connect(): void {
    this.isAutoReconnectEnabled = true;
    this.clearTimers();
    this.updateState('connecting', `Connecting to ${this.wsUrl}...`);

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (err) {
      this.updateState('error', `Invalid WebSocket URL: ${err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateState('connected', `Connected to ${this.wsUrl}`);

      // Sync mode and profile
      const modeMsg = buildModeMessage(this.obstacleMode);
      this.sendRaw(serializeMessage(modeMsg));

      if (this.hardwareProfile !== 'unconfirmed') {
        const profMsg = buildProfileSelectMessage(this.hardwareProfile);
        this.sendRaw(serializeMessage(profMsg));
      }

      this.pingInterval = window.setInterval(() => {
        if (this.isConnected()) {
          try {
            this.sendRaw(serializeMessage(buildPingMessage()));
          } catch {
            // Handled by ws error/close
          }
        }
      }, 1500);
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const msg = parseServerMessage(event.data);
      if (!msg) return;

      if (msg.type === 'telemetry') {
        if (msg.profile && msg.profile !== this.hardwareProfile) {
          this.hardwareProfile = msg.profile;
          this.callbacks.onProfileChange(msg.profile);
        }
        if (typeof msg.steeringLeftAngle === 'number') this.steeringLeft = msg.steeringLeftAngle;
        if (typeof msg.steeringRightAngle === 'number') this.steeringRight = msg.steeringRightAngle;
        if (typeof msg.aimingAngle === 'number') this.aimingAngle = msg.aimingAngle;

        this.callbacks.onTelemetry(msg);
        this.callbacks.onObstacleAlert(msg.obstacle, msg.distCm);
        if (msg.state === 'obstacle_stop' && this.currentDirection !== 'stop') {
          this.currentDirection = 'stop';
        }
      } else if (msg.type === 'scan') {
        this.callbacks.onScanSample({
          angle: msg.angle,
          distCm: msg.distCm,
          valid: msg.valid,
          timestamp: Date.now(),
        });
      }
    };

    this.ws.onerror = () => {
      this.updateState('error', 'Connection error. Check network and ESP IP.');
    };

    this.ws.onclose = () => {
      this.currentDirection = 'stop';
      this.updateState('disconnected', 'Connection closed');
      this.clearTimers();
      if (this.isAutoReconnectEnabled) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectAttempts++;
    const delay = Math.min(6000, 1000 * Math.min(6, this.reconnectAttempts));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isAutoReconnectEnabled) {
        this.connect();
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private updateState(state: ConnectionState, message?: string): void {
    this.connectionState = state;
    this.callbacks.onConnectionChange(state, message);
  }

  private sendDrive(dir: DriveDirection, speed: number): void {
    if (!this.isConnected()) return;
    try {
      const msg = buildDriveMessage(dir, speed);
      this.sendRaw(serializeMessage(msg));
    } catch (e) {
      console.error('Failed to send drive command:', e);
    }
  }

  private sendStop(): void {
    if (!this.isConnected()) return;
    try {
      const msg = buildStopMessage();
      this.sendRaw(serializeMessage(msg));
    } catch (e) {
      console.error('Failed to send stop command:', e);
    }
  }

  private sendRaw(payload: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  private bindWindowEvents(): void {
    window.addEventListener('blur', () => this.stopDrive());
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopDrive();
      }
    });
    window.addEventListener('beforeunload', () => this.stopDrive());
  }
}
