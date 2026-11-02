/**
 * Shared protocol encoder, decoder, and validation for PanzerNavSystem
 */

import {
  ClientMessage,
  ServerMessage,
  DriveDirection,
  ObstacleMode,
  DriveCommandMessage,
  StopCommandMessage,
  ModeCommandMessage,
  EffectCommandMessage,
  PingMessage,
} from './types';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_SIZE = 512;
export const SPEED_MIN = 0;
export const SPEED_MAX = 100;

export function buildDriveMessage(dir: DriveDirection, speed: number): DriveCommandMessage {
  const boundedSpeed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(speed)));
  return {
    type: 'drive',
    dir,
    speed: boundedSpeed,
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
