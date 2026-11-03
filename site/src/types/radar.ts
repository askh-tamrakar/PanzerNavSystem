/**
 * Types and interfaces for PanzerNavSystem Tactical Radar Scope
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type HardwareProfile = 'profile_b_servo' | 'profile_a_dc' | 'unconfirmed';
export type DriveDirection = 'forward' | 'reverse' | 'left' | 'right' | 'stop';
export type ObstacleMode = 'auto' | 'manual';
export type TrackingStatus = 'ACTIVE' | 'TRACKING' | 'LOST';

export interface ScanSample {
  angle: number;         // 0.0 to 180.0 degrees
  distCm: number;        // Filtered & calibrated distance (-1 if invalid)
  rawDistCm?: number;    // Raw single-echo distance before filtering
  valid: boolean;        // True if echo detected in range
  confidence: number;    // 0 to 100% confidence
  timestamp: number;     // Milliseconds timestamp
}

export interface TrackedObstacle {
  id: string;            // e.g. "T-01"
  angle: number;         // Central detection angle (degrees)
  distance: number;      // Distance in centimeters
  x: number;             // Cartesian X (cm)
  y: number;             // Cartesian Y (cm)
  approxWidthCm: number; // Estimated physical width in cm (approximate)
  angularSpanDeg: number;// Angular span in degrees
  confidence: number;    // 0 to 100%
  status: TrackingStatus;// ACTIVE | TRACKING | LOST
  firstDetected: number; // Timestamp
  lastSeen: number;      // Timestamp
  missedCycles: number;  // Scans since last hit
  isClosest: boolean;    // Closest obstacle indicator
}

export interface SensorDiagnostics {
  connected: boolean;
  wsState: ConnectionState;
  sensorOk: boolean;
  scanning: boolean;
  currentAngle: number;
  currentDistance: number;
  totalObstacles: number;
  invalidReadingCount: number;
  timeoutCount: number;
  scanCycleDurationMs: number;
  wifiRssi?: number;
  freeHeap?: number;
  temperatureC: number;
  calibOffsetCm: number;
  variance: number;
}

export interface RadarConfig {
  minAngle: number;
  maxAngle: number;
  stepDeg: number;       // 1, 2, 3, 5, or 0.25
  minDistCm: number;     // Minimum range
  maxDistCm: number;     // Maximum range (e.g. 100, 200, 250 cm)
  settleMs: number;      // Servo mechanical settling delay (ms)
  sensitivity: number;   // 1 to 5
  tempC: number;         // Temperature compensation (°C)
  calibOffsetCm: number; // Calibration offset (cm)
  scanning: boolean;     // Active scanning state
}

export interface TelemetryData {
  v: number;
  profile: HardwareProfile;
  uptime: number;
  state: 'idle' | 'driving' | 'obstacle_stop' | 'fault';
  obstacleMode: ObstacleMode;
  obstacle: boolean;
  distCm: number;
  rawDistCm?: number;
  sweepAngle: number;
  aimingAngle: number;
  steeringLeftAngle: number;
  steeringRightAngle: number;
  speed: number;
  wifiRssi?: number;
  freeHeap?: number;
  apSsid?: string;
  apIp?: string;
  apClients?: number;
  wifiMode?: string;
  staConnected?: boolean;
  totalReadings?: number;
  rejectedReadings?: number;
  timeoutCount?: number;
  scanCycleMs?: number;
  variance?: number;
  tempC?: number;
  calibOffset?: number;
  scanning?: boolean;
}
