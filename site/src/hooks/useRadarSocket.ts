/**
 * Custom React Hook: useRadarSocket
 * Manages WebSocket connection, raw data acquisition, spatial clustering,
 * width estimation, persistent obstacle tracking, and hardware control dispatch.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConnectionState,
  ScanSample,
  TrackedObstacle,
  SensorDiagnostics,
  RadarConfig,
  TelemetryData,
  DriveDirection,
} from '../types/radar';

const STORAGE_WS_KEY = 'panzer_nav_ws_url';

function resolveInitialWsUrl(): string {
  const saved = localStorage.getItem(STORAGE_WS_KEY);
  if (saved && (saved.startsWith('ws://') || saved.startsWith('wss://'))) {
    return saved;
  }
  const host = window.location.hostname;
  if (host && host !== '' && host !== 'localhost' && host !== '127.0.0.1') {
    return `ws://${host}:81/`;
  }
  return 'ws://192.168.4.1:81/';
}

const DEFAULT_CONFIG: RadarConfig = {
  minAngle: 0,
  maxAngle: 180,
  stepDeg: 1.0,
  minDistCm: 2.0,
  maxDistCm: 200.0,
  settleMs: 15,
  sensitivity: 3,
  tempC: 20.0,
  calibOffsetCm: 0.0,
  scanning: true,
};

export function useRadarSocket() {
  const [wsUrl, setWsUrlState] = useState<string>(resolveInitialWsUrl);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to connect');

  const [currentSweepAngle, setCurrentSweepAngle] = useState<number>(90);
  const [samples, setSamples] = useState<ScanSample[]>([]);
  const [trackedObstacles, setTrackedObstacles] = useState<TrackedObstacle[]>([]);
  const [config, setConfigState] = useState<RadarConfig>(DEFAULT_CONFIG);

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    v: 2,
    profile: 'profile_b_servo',
    uptime: 0,
    state: 'idle',
    obstacleMode: 'auto',
    obstacle: false,
    distCm: -1,
    sweepAngle: 90,
    aimingAngle: 90,
    steeringLeftAngle: 90,
    steeringRightAngle: 90,
    speed: 65,
  });

  const [diagnostics, setDiagnostics] = useState<SensorDiagnostics>({
    connected: false,
    wsState: 'disconnected',
    sensorOk: true,
    scanning: true,
    currentAngle: 90,
    currentDistance: -1,
    totalObstacles: 0,
    invalidReadingCount: 0,
    timeoutCount: 0,
    scanCycleDurationMs: 0,
    temperatureC: 20.0,
    calibOffsetCm: 0.0,
    variance: 0.0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const samplesRef = useRef<ScanSample[]>([]);
  const trackedRef = useRef<TrackedObstacle[]>([]);
  const nextTrackIdRef = useRef<number>(1);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const configRef = useRef<RadarConfig>(DEFAULT_CONFIG);

  configRef.current = config;

  const sendRaw = useCallback((payload: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    }
  }, []);

  // Update Config
  const updateConfig = useCallback((partial: Partial<RadarConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...partial };
      const msg = {
        type: 'scanner_config',
        minAngle: next.minAngle,
        maxAngle: next.maxAngle,
        stepDeg: next.stepDeg,
        settleMs: next.settleMs,
        minDistCm: next.minDistCm,
        maxDistCm: next.maxDistCm,
        tempC: next.tempC,
        calibOffsetCm: next.calibOffsetCm,
        scanning: next.scanning,
      };
      sendRaw(JSON.stringify(msg));
      return next;
    });
  }, [sendRaw]);

  // Spatial Clustering, Boundary Detection & Persistent Tracking Pipeline
  const processTrackingPipeline = useCallback((currentSamples: ScanSample[]) => {
    const validPoints = currentSamples.filter(
      (s) => s.valid && s.distCm >= configRef.current.minDistCm && s.distCm <= configRef.current.maxDistCm
    );

    if (validPoints.length === 0) {
      // Degrade tracks if no targets
      const now = Date.now();
      const pruned = trackedRef.current
        .map((t) => ({
          ...t,
          status: 'LOST' as const,
          missedCycles: t.missedCycles + 1,
          confidence: Math.max(0, t.confidence - 10),
        }))
        .filter((t) => now - t.lastSeen < 3500);

      trackedRef.current = pruned;
      setTrackedObstacles(pruned);
      return;
    }

    // Sort valid points by angle
    validPoints.sort((a, b) => a.angle - b.angle);

    // 1. Cluster neighboring angular measurements into discrete objects
    interface Cluster {
      points: ScanSample[];
      startAngle: number;
      endAngle: number;
    }

    const clusters: Cluster[] = [];
    let currentCluster: ScanSample[] = [];

    const maxAngleGap = Math.max(2.5, configRef.current.stepDeg * 2.2);

    for (let i = 0; i < validPoints.length; i++) {
      const pt = validPoints[i];
      if (currentCluster.length === 0) {
        currentCluster.push(pt);
      } else {
        const prev = currentCluster[currentCluster.length - 1];
        const angleDiff = Math.abs(pt.angle - prev.angle);
        const distDiff = Math.abs(pt.distCm - prev.distCm);
        // Adaptive distance jump threshold (wider tolerance at longer range)
        const maxDistJump = 12.0 + prev.distCm * 0.08;

        if (angleDiff <= maxAngleGap && distDiff <= maxDistJump) {
          currentCluster.push(pt);
        } else {
          if (currentCluster.length >= 2 || (currentCluster[0] && currentCluster[0].confidence > 85)) {
            clusters.push({
              points: currentCluster,
              startAngle: currentCluster[0].angle,
              endAngle: currentCluster[currentCluster.length - 1].angle,
            });
          }
          currentCluster = [pt];
        }
      }
    }

    if (currentCluster.length >= 2 || (currentCluster[0] && currentCluster[0].confidence > 85)) {
      clusters.push({
        points: currentCluster,
        startAngle: currentCluster[0].angle,
        endAngle: currentCluster[currentCluster.length - 1].angle,
      });
    }

    // 2. Compute approximate obstacle width, centroid, and geometry
    interface DetectedObject {
      angle: number;
      distance: number;
      x: number;
      y: number;
      approxWidthCm: number;
      angularSpanDeg: number;
      confidence: number;
    }

    const detectedObjects: DetectedObject[] = clusters.map((c) => {
      const avgDist = c.points.reduce((sum, p) => sum + p.distCm, 0) / c.points.length;
      const avgAngle = c.points.reduce((sum, p) => sum + p.angle, 0) / c.points.length;
      const spanDeg = Math.max(0.5, Math.abs(c.endAngle - c.startAngle));
      const spanRad = (spanDeg * Math.PI) / 180;

      // Approximate geometric width W = 2 * R * sin(span / 2)
      const widthAngular = 2 * avgDist * Math.sin(spanRad / 2);

      // Boundary Cartesian coordinates
      const startRad = (c.startAngle * Math.PI) / 180;
      const endRad = (c.endAngle * Math.PI) / 180;
      const startX = c.points[0].distCm * Math.cos(startRad);
      const startY = c.points[0].distCm * Math.sin(startRad);
      const endX = c.points[c.points.length - 1].distCm * Math.cos(endRad);
      const endY = c.points[c.points.length - 1].distCm * Math.sin(endRad);
      const widthCartesian = Math.hypot(endX - startX, endY - startY);

      const approxWidth = Math.max(widthAngular, widthCartesian);

      // Representative Cartesian centroid
      const centroidRad = (avgAngle * Math.PI) / 180;
      const cx = avgDist * Math.cos(centroidRad);
      const cy = avgDist * Math.sin(centroidRad);

      const avgConfidence = c.points.reduce((sum, p) => sum + p.confidence, 0) / c.points.length;

      return {
        angle: Math.round(avgAngle * 10) / 10,
        distance: Math.round(avgDist * 10) / 10,
        x: Math.round(cx * 10) / 10,
        y: Math.round(cy * 10) / 10,
        approxWidthCm: Math.round(approxWidth * 10) / 10,
        angularSpanDeg: Math.round(spanDeg * 10) / 10,
        confidence: Math.round(avgConfidence),
      };
    });

    // 3. Persistent Obstacle Tracking across scans
    const now = Date.now();
    const existing = [...trackedRef.current];
    const updatedTracks: TrackedObstacle[] = [];
    const matchedTrackIds = new Set<string>();

    for (const obj of detectedObjects) {
      // Find closest existing track
      let bestMatch: TrackedObstacle | null = null;
      let minDistance = 28.0; // Matching radius in cm

      for (const track of existing) {
        if (matchedTrackIds.has(track.id)) continue;
        const distDelta = Math.hypot(obj.x - track.x, obj.y - track.y);
        const angleDelta = Math.abs(obj.angle - track.angle);

        if (distDelta < minDistance || (angleDelta < 10 && Math.abs(obj.distance - track.distance) < 18)) {
          minDistance = distDelta;
          bestMatch = track;
        }
      }

      if (bestMatch) {
        matchedTrackIds.add(bestMatch.id);
        // Exponential smoothing on position
        const alpha = 0.65;
        updatedTracks.push({
          ...bestMatch,
          angle: Math.round((bestMatch.angle * (1 - alpha) + obj.angle * alpha) * 10) / 10,
          distance: Math.round((bestMatch.distance * (1 - alpha) + obj.distance * alpha) * 10) / 10,
          x: Math.round((bestMatch.x * (1 - alpha) + obj.x * alpha) * 10) / 10,
          y: Math.round((bestMatch.y * (1 - alpha) + obj.y * alpha) * 10) / 10,
          approxWidthCm: obj.approxWidthCm,
          angularSpanDeg: obj.angularSpanDeg,
          confidence: Math.min(100, bestMatch.confidence + 12),
          status: 'TRACKING',
          lastSeen: now,
          missedCycles: 0,
          isClosest: false,
        });
      } else {
        // Assign new persistent target ID (e.g. T-01)
        const idNum = nextTrackIdRef.current++;
        const idStr = `T-${idNum.toString().padStart(2, '0')}`;
        updatedTracks.push({
          id: idStr,
          angle: obj.angle,
          distance: obj.distance,
          x: obj.x,
          y: obj.y,
          approxWidthCm: obj.approxWidthCm,
          angularSpanDeg: obj.angularSpanDeg,
          confidence: Math.min(95, obj.confidence),
          status: 'ACTIVE',
          firstDetected: now,
          lastSeen: now,
          missedCycles: 0,
          isClosest: false,
        });
      }
    }

    // Retain unmatched tracks with fading confidence
    for (const track of existing) {
      if (!matchedTrackIds.has(track.id)) {
        if (now - track.lastSeen < 3500) {
          updatedTracks.push({
            ...track,
            status: 'LOST',
            confidence: Math.max(0, track.confidence - 15),
            missedCycles: track.missedCycles + 1,
            isClosest: false,
          });
        }
      }
    }

    // 4. Identify Closest Obstacle
    if (updatedTracks.length > 0) {
      let closestIdx = 0;
      let minD = 999999;
      for (let i = 0; i < updatedTracks.length; i++) {
        if (updatedTracks[i].status !== 'LOST' && updatedTracks[i].distance < minD) {
          minD = updatedTracks[i].distance;
          closestIdx = i;
        }
      }
      updatedTracks[closestIdx].isClosest = true;
    }

    trackedRef.current = updatedTracks;
    setTrackedObstacles(updatedTracks);
    setDiagnostics((prev) => ({ ...prev, totalObstacles: updatedTracks.length }));
  }, []);

  // WebSocket Connection
  useEffect(() => {
    let active = true;

    const connect = () => {
      setConnectionState('connecting');
      setStatusMessage(`Connecting to ${wsUrl}...`);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setConnectionState('connected');
          setStatusMessage(`Connected to ${wsUrl}`);
          setDiagnostics((prev) => ({ ...prev, connected: true, wsState: 'connected' }));

          // Synchronize initial configuration
          const initMsg = {
            type: 'scanner_config',
            minAngle: configRef.current.minAngle,
            maxAngle: configRef.current.maxAngle,
            stepDeg: configRef.current.stepDeg,
            settleMs: configRef.current.settleMs,
            minDistCm: configRef.current.minDistCm,
            maxDistCm: configRef.current.maxDistCm,
            tempC: configRef.current.tempC,
            calibOffsetCm: configRef.current.calibOffsetCm,
            scanning: configRef.current.scanning,
          };
          ws.send(JSON.stringify(initMsg));

          pingIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
            }
          }, 1500);
        };

        ws.onmessage = (event) => {
          if (!active || typeof event.data !== 'string') return;
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            if (data.type === 'scan') {
              const sample: ScanSample = {
                angle: Number(data.angle) || 0,
                distCm: Number(data.distCm) ?? -1,
                rawDistCm: data.rawDistCm !== undefined ? Number(data.rawDistCm) : undefined,
                valid: Boolean(data.valid),
                confidence: Number(data.confidence) || 0,
                timestamp: Number(data.t) || Date.now(),
              };

              setCurrentSweepAngle(sample.angle);

              // Maintain decaying samples
              const now = Date.now();
              const filtered = samplesRef.current.filter(
                (s) => Math.abs(s.angle - sample.angle) > 0.25 || now - s.timestamp < 1200
              );
              filtered.push(sample);

              // Prune samples older than 7 seconds
              const activeSamples = filtered.filter((s) => now - s.timestamp <= 7000);
              samplesRef.current = activeSamples;
              setSamples(activeSamples);

              // Run spatial detection and tracking
              processTrackingPipeline(activeSamples);

              setDiagnostics((prev) => ({
                ...prev,
                currentAngle: sample.angle,
                currentDistance: sample.distCm,
              }));
            } else if (data.type === 'telemetry') {
              setTelemetry(data);
              setDiagnostics((prev) => ({
                ...prev,
                connected: true,
                wsState: 'connected',
                sensorOk: Boolean(data.obstacle !== undefined),
                scanning: data.scanning ?? true,
                currentAngle: data.sweepAngle ?? prev.currentAngle,
                currentDistance: data.distCm ?? prev.currentDistance,
                timeoutCount: data.timeoutCount ?? prev.timeoutCount,
                invalidReadingCount: data.rejectedReadings ?? prev.invalidReadingCount,
                scanCycleDurationMs: data.scanCycleMs ?? prev.scanCycleDurationMs,
                wifiRssi: data.wifiRssi,
                freeHeap: data.freeHeap,
                temperatureC: data.tempC ?? prev.temperatureC,
                calibOffsetCm: data.calibOffset ?? prev.calibOffsetCm,
                variance: data.variance ?? prev.variance,
              }));
            }
          } catch {
            // Ignore malformed JSON
          }
        };

        ws.onerror = () => {
          if (!active) return;
          setConnectionState('error');
          setStatusMessage('Connection error. Check tank AP and IP address.');
          setDiagnostics((prev) => ({ ...prev, connected: false, wsState: 'error' }));
        };

        ws.onclose = () => {
          if (!active) return;
          setConnectionState('disconnected');
          setStatusMessage('Connection closed. Retrying...');
          setDiagnostics((prev) => ({ ...prev, connected: false, wsState: 'disconnected' }));
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          reconnectTimerRef.current = window.setTimeout(connect, 2500);
        };
      } catch (e) {
        setConnectionState('error');
        setStatusMessage(`WebSocket Error: ${e}`);
      }
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [wsUrl, processTrackingPipeline]);

  const setWsUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_WS_KEY, trimmed);
      setWsUrlState(trimmed);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const sendManualAngle = useCallback((angle: number) => {
    sendRaw(JSON.stringify({ type: 'manual_angle', angle: Math.round(angle * 10) / 10 }));
  }, [sendRaw]);

  const sendPing = useCallback(() => {
    sendRaw(JSON.stringify({ type: 'scanner_manual', action: 'ping' }));
  }, [sendRaw]);

  const sendDrive = useCallback((dir: DriveDirection, speed: number) => {
    sendRaw(JSON.stringify({ type: 'drive', dir, speed: Math.round(speed) }));
  }, [sendRaw]);

  const stopDrive = useCallback(() => {
    sendRaw(JSON.stringify({ type: 'stop' }));
  }, [sendRaw]);

  const sendSteering = useCallback((leftAngle: number, rightAngle: number) => {
    sendRaw(
      JSON.stringify({
        type: 'steering',
        leftAngle: Math.round(leftAngle),
        rightAngle: Math.round(rightAngle),
      })
    );
  }, [sendRaw]);

  const sendAiming = useCallback((angle: number) => {
    sendRaw(JSON.stringify({ type: 'aiming', angle: Math.round(angle) }));
  }, [sendRaw]);

  const sendEffect = useCallback(() => {
    sendRaw(JSON.stringify({ type: 'effect', action: 'simulate_fire' }));
  }, [sendRaw]);

  const clearObstacles = useCallback(() => {
    trackedRef.current = [];
    setTrackedObstacles([]);
  }, []);

  const resetRadar = useCallback(() => {
    samplesRef.current = [];
    trackedRef.current = [];
    setSamples([]);
    setTrackedObstacles([]);
  }, []);

  const closestObstacle = trackedObstacles.find((o) => o.isClosest && o.status !== 'LOST');

  return {
    wsUrl,
    setWsUrl,
    reconnect,
    connectionState,
    statusMessage,
    currentSweepAngle,
    samples,
    trackedObstacles,
    closestObstacle,
    config,
    updateConfig,
    telemetry,
    diagnostics,
    sendManualAngle,
    sendPing,
    sendDrive,
    stopDrive,
    sendSteering,
    sendAiming,
    sendEffect,
    clearObstacles,
    resetRadar,
  };
}
