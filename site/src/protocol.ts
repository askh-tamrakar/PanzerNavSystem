/**
 * Shared protocol encoder, decoder, and validation for PanzerNavSystem
 * Full support for 8 actuators (Propulsion x4, Steering x2, Aiming x1, Scanner x1)
 */

import {
  ClientMessage,
  ServerMessage,
  DriveDirection,
  ObstacleMode,
  HardwareProfile,
  DriveCommandMessage,
  SteeringCommandMessage,
  AimingCommandMessage,
  ScannerConfigMessage,
  ScannerManualMessage,
  ProfileSelectMessage,
  StopCommandMessage,
  ModeCommandMessage,
  EffectCommandMessage,
  PingMessage,
} from './types';

export const PROTOCOL_VERSION = 2;
export const MAX_MESSAGE_SIZE = 512;

// Bounded actuator limits
export const SPEED_MIN = 0;
export const SPEED_MAX = 100;

export const STEERING_MIN_ANGLE = 45;
export const STEERING_MAX_ANGLE = 135;
export const STEERING_CENTER_ANGLE = 90;

export const AIMING_MIN_ANGLE = 30;
export const AIMING_MAX_ANGLE = 150;
export const AIMING_CENTER_ANGLE = 90;

// Full 0° to 180° Radar Limits and Step Divisors
export const SCANNER_MIN_ANGLE = 0;
export const SCANNER_MAX_ANGLE = 180;
export const SCANNER_STEP_DIVISORS_OF_180 = [5, 6, 10, 15, 20, 30, 45] as const;

export function buildDriveMessage(dir: DriveDirection, speed: number): DriveCommandMessage {
  const boundedSpeed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(speed)));
  return {
    type: 'drive',
    dir,
    speed: boundedSpeed,
  };
}

export function buildSteeringMessage(leftAngle: number, rightAngle: number): SteeringCommandMessage {
  const boundedLeft = Math.max(STEERING_MIN_ANGLE, Math.min(STEERING_MAX_ANGLE, Math.round(leftAngle)));
  const boundedRight = Math.max(STEERING_MIN_ANGLE, Math.min(STEERING_MAX_ANGLE, Math.round(rightAngle)));
  return {
    type: 'steering',
    leftAngle: boundedLeft,
    rightAngle: boundedRight,
  };
}

export function buildAimingMessage(angle: number): AimingCommandMessage {
  const boundedAngle = Math.max(AIMING_MIN_ANGLE, Math.min(AIMING_MAX_ANGLE, Math.round(angle)));
  return {
    type: 'aiming',
    angle: boundedAngle,
  };
}

export function buildScannerConfigMessage(
  minAngle: number,
  maxAngle: number,
  stepDeg: number,
  mode: 'auto' | 'manual' = 'auto'
): ScannerConfigMessage {
  const boundedMin = Math.max(0, Math.min(180, Math.round(minAngle)));
  const boundedMax = Math.max(boundedMin, Math.min(180, Math.round(maxAngle)));
  const boundedStep = Math.max(1, Math.min(180, Math.round(stepDeg)));
  return {
    type: 'scanner_config',
    minAngle: boundedMin,
    maxAngle: boundedMax,
    stepDeg: boundedStep,
    mode,
  };
}

export function buildScannerManualMessage(
  action: 'step_left' | 'step_right' | 'set_angle' | 'ping' | 'auto',
  angle?: number,
  stepDeg?: number
): ScannerManualMessage {
  return {
    type: 'scanner_manual',
    action,
    angle: angle !== undefined ? Math.max(0, Math.min(180, Math.round(angle))) : undefined,
    stepDeg: stepDeg !== undefined ? Math.max(1, Math.min(180, Math.round(stepDeg))) : undefined,
  };
}

export function buildProfileSelectMessage(profile: HardwareProfile): ProfileSelectMessage {
  return {
    type: 'set_profile',
    profile,
  };
}

export function buildStopMessage(): StopCommandMessage {
  return { type: 'stop' };
}

export function buildModeMessage(obstacleMode: ObstacleMode): ModeCommandMessage {
  return {
    type: 'mode',
    obstacleMode,
  };
}

export function buildEffectMessage(): EffectCommandMessage {
  return {
    type: 'effect',
    action: 'simulate_fire',
  };
}

export function buildPingMessage(): PingMessage {
  return {
    type: 'ping',
    t: Date.now(),
  };
}

export function serializeMessage(msg: ClientMessage): string {
  const json = JSON.stringify(msg);
  if (json.length > MAX_MESSAGE_SIZE) {
    throw new Error(`Message exceeds maximum protocol size of ${MAX_MESSAGE_SIZE} bytes`);
  }
  return json;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (raw.length > MAX_MESSAGE_SIZE) {
    console.warn('Received server message exceeding max size limit:', raw.length);
    return null;
  }

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
      return null;
    }

    if (data.type === 'telemetry') {
      if (typeof data.state !== 'string' || typeof data.distCm !== 'number') {
        return null;
      }
      return data as ServerMessage;
    }

    if (data.type === 'scan') {
      if (typeof data.angle !== 'number' || typeof data.distCm !== 'number') {
        return null;
      }
      return data as ServerMessage;
    }

    if (data.type === 'pong') {
      return data as ServerMessage;
    }

    return null;
  } catch (err) {
    console.warn('Failed to parse incoming server message:', err);
    return null;
  }
}
