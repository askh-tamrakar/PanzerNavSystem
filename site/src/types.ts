/**
 * Types and interfaces for PanzerNavSystem Wi-Fi Tank Control
 */

export type DriveDirection = 'forward' | 'reverse' | 'left' | 'right' | 'stop';
export type ObstacleMode = 'auto' | 'manual';
export type TankState = 'idle' | 'driving' | 'obstacle_stop' | 'fault';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScanSample {
  angle: number;       // Angle in degrees (e.g. 30..150)
  distCm: number;      // Distance in centimeters (-1 for out of range / no echo)
  valid: boolean;      // True if valid reflection detected
  timestamp: number;   // Timestamp (ms) when received by client
}

export interface TelemetryData {
  v: number;                 // Protocol version
  uptime: number;            // System uptime in seconds
  state: TankState;          // Current operational state
  obstacleMode: ObstacleMode;// Current obstacle stop mode
  obstacle: boolean;         // True if obstacle detected ahead
  distCm: number;            // Latest raw distance reading in cm (-1 if invalid)
  sweepAngle: number;        // Current servo position in degrees
  speed: number;             // Current configured motor speed (0..100)
  wifiRssi?: number;         // Wi-Fi signal strength in dBm
  freeHeap?: number;         // ESP8266 free heap memory in bytes
}

// Client-to-ESP Messages
export interface DriveCommandMessage {
  type: 'drive';
  dir: DriveDirection;
  speed: number;             // Bounded integer 0..100
}

export interface StopCommandMessage {
  type: 'stop';
}

export interface ModeCommandMessage {
  type: 'mode';
  obstacleMode: ObstacleMode;
}

export interface EffectCommandMessage {
  type: 'effect';
  action: 'simulate_fire';   // Harmless LED/sound simulation only
}

export interface PingMessage {
  type: 'ping';
  t: number;
}

export type ClientMessage =
  | DriveCommandMessage
  | StopCommandMessage
  | ModeCommandMessage
  | EffectCommandMessage
  | PingMessage;

// ESP-to-Client Messages
export interface ServerTelemetryMessage extends TelemetryData {
  type: 'telemetry';
}

export interface ServerScanMessage {
  type: 'scan';
  v: number;
  angle: number;
  distCm: number;
  valid: boolean;
}

export interface ServerPongMessage {
  type: 'pong';
  t: number;
}

export type ServerMessage =
  | ServerTelemetryMessage
  | ServerScanMessage
  | ServerPongMessage;
