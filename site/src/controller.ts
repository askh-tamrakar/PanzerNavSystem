/**
 * Tank Controller & WebSocket Transport Client
 */

import {
  DriveDirection,
  ObstacleMode,
  TelemetryData,
  ScanSample,
  ConnectionState,
} from './types';
import {
  buildDriveMessage,
  buildStopMessage,
  buildModeMessage,
  buildEffectMessage,
  buildPingMessage,
  serializeMessage,
  parseServerMessage,
  SPEED_MIN,
  SPEED_MAX,
} from './protocol';

const STORAGE_WS_KEY = 'panzer_nav_ws_url';
const DEFAULT_SPEED = 65;

export interface ControllerCallbacks {
  onConnectionChange: (state: ConnectionState, message?: string) => void;
  onTelemetry: (telemetry: TelemetryData) => void;
  onScanSample: (sample: ScanSample) => void;
  onObstacleAlert: (obstacle: boolean, distCm: number) => void;
  onModeChange: (mode: ObstacleMode) => void;
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

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public setSpeed(speed: number): void {
    const bounded = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(speed)));
    if (this.currentSpeed === bounded) return;
    this.currentSpeed = bounded;

    // If currently driving, update firmware with new speed
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

  public startDrive(dir: DriveDirection): void {
    if (this.currentDirection === dir) {
      // Avoid spamming identical drive command
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

    // If served from ESP8266 LittleFS web server, hostname is the ESP's IP
    const host = window.location.hostname;
    if (host && host !== '' && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:81/`;
    }

    // Default fallback to standard ESP Access Point IP
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

      // Sync initial mode
      const modeMsg = buildModeMessage(this.obstacleMode);
      this.sendRaw(serializeMessage(modeMsg));

      // Start ping heartbeat
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
        this.callbacks.onTelemetry(msg);
        this.callbacks.onObstacleAlert(msg.obstacle, msg.distCm);
        if (msg.state === 'obstacle_stop' && this.currentDirection !== 'stop') {
          // Firmware auto-stopped motors due to obstacle
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
    // Exponential backoff capped at 6 seconds
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
    // Safety critical: stop motors if page loses focus, user switches tabs, or page unloads
    window.addEventListener('blur', () => this.stopDrive());
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopDrive();
      }
    });
    window.addEventListener('beforeunload', () => this.stopDrive());
  }
}
