/**
 * Types and interfaces for PanzerNavSystem
 * Supports revised 8-actuator inventory:
 * - 4 Propulsion actuators (Forward / Reverse)
 * - 2 Steering servos (Left & Right steering channels)
 * - 1 Aiming servo (Left / Right pan)
 * - 1 Scanner servo (Ultrasonic sweep)
 * - 2 L298N driver boards (Active in Profile A; Unused in Profile B)
 * - 1 RCWL-1604 ultrasonic sensor
 */

export type HardwareProfile = 'unconfirmed' | 'profile_a_dc' | 'profile_b_servo';
export type DriveDirection = 'forward' | 'reverse' | 'left' | 'right' | 'stop';
export type ObstacleMode = 'auto' | 'manual';
export type TankState = 'idle' | 'driving' | 'obstacle_stop' | 'fault';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScanSample {
  angle: number;       // Scanner servo angle in degrees
  distCm: number;      // Distance in centimeters (-1 for out of range / no echo)
  valid: boolean;      // True if valid reflection detected
  timestamp: number;   // Timestamp (ms) when received by client
}

export interface TelemetryData {
  v: number;                   // Protocol version
  profile: HardwareProfile;    // Active hardware profile
  uptime: number;              // System uptime in seconds
  state: TankState;            // Current operational state
  obstacleMode: ObstacleMode;  // Current obstacle stop mode
  obstacle: boolean;           // True if obstacle detected ahead
  distCm: number;              // Latest raw distance reading in cm (-1 if invalid)
  sweepAngle: number;          // Current scanner servo position in degrees
  scannerAuto?: boolean;       // True if scanner is currently in auto-sweep mode
  aimingAngle: number;         // Current aiming servo position in degrees
  steeringLeftAngle: number;   // Current left steering servo position in degrees
  steeringRightAngle: number;  // Current right steering servo position in degrees
  speed: number;               // Current propulsion speed (0..100)
  wifiRssi?: number;           // Wi-Fi signal strength in dBm
  freeHeap?: number;           // ESP8266 free heap memory in bytes
  apSsid?: string;             // Active Access Point SSID (e.g. "PanzerTank-AP")
  apIp?: string;               // Local AP IP (e.g. "192.168.4.1")
  apClients?: number;          // Number of connected phone/tablet clients
  wifiMode?: string;           // "AP" or "AP+STA"
  staConnected?: boolean;      // True if station uplink is connected
}

// Client-to-ESP Messages
export interface DriveCommandMessage {
  type: 'drive';
  dir: DriveDirection;
  speed: number;               // Bounded integer 0..100
}

export interface SteeringCommandMessage {
  type: 'steering';
  leftAngle: number;           // Bounded degrees e.g. 45..135 (center 90)
  rightAngle: number;          // Bounded degrees e.g. 45..135 (center 90)
}

export interface AimingCommandMessage {
  type: 'aiming';
  angle: number;               // Bounded degrees e.g. 30..150 (center 90)
}

export interface ScannerConfigMessage {
  type: 'scanner_config';
  minAngle: number;            // Calibrated sweep min degrees (0..180)
  maxAngle: number;            // Calibrated sweep max degrees (0..180)
  stepDeg: number;             // Divisor of 180 (e.g. 5, 6, 10, 15, 20, 30, 45)
  mode?: 'auto' | 'manual';
}

export interface ScannerManualMessage {
  type: 'scanner_manual';
  action: 'step_left' | 'step_right' | 'set_angle' | 'ping' | 'auto';
  angle?: number;              // Bounded degrees 0..180
  stepDeg?: number;            // Divisor of 180 (e.g. 5, 6, 10, 15, 20, 30, 45)
}

export interface ProfileSelectMessage {
  type: 'set_profile';
  profile: HardwareProfile;
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
  action: 'simulate_fire';     // Harmless LED/sound simulation only
}

export interface PingMessage {
  type: 'ping';
  t: number;
}

export type ClientMessage =
  | DriveCommandMessage
  | SteeringCommandMessage
  | AimingCommandMessage
  | ScannerConfigMessage
  | ScannerManualMessage
  | ProfileSelectMessage
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
