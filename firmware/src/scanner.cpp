/**
 * PanzerNavSystem - Advanced Ultrasonic Radar Scanner Implementation
 * Optimized for HC-SR04 with:
 * - 3-sample burst acquisition per angle
 * - Median filtering and outlier rejection
 * - Temperature compensation formula: v = 331.3 + 0.606 * T (m/s)
 * - Configurable calibration offset, min/max distances, and settle delay
 * - Non-blocking state machine to protect Wi-Fi / WebSocket performance
 * - Diagnostics tracking: timeouts, rejected readings, scan cycle duration
 */

#include "scanner.h"

static Servo radarServo;

// Scan Geometry & Limits
static float sweepMinAngle = SCANNER_MIN_ANGLE; // 0.0f
static float sweepMaxAngle = SCANNER_MAX_ANGLE; // 180.0f
static float sweepStepDeg = SCANNER_STEP_DEG;   // 1.0f or 0.25f
static float currentAngle = 90.0f;
static int sweepDirection = 1;
static bool isScanning = true;

// Timing & Stabilization
static int settleDelayMs = SCANNER_SETTLE_MS; // Default: 15ms
static unsigned long lastStateTime = 0;
static unsigned long cycleStartTime = 0;
static unsigned long scanCycleDurationMs = 0;

// Calibration & Temperature Compensation
static float minDistCm = 2.0f;
static float maxDistCm = 250.0f;
static float currentTempC = 20.0f;
static float calibOffsetCm = 0.0f;

// Multi-Sample Burst Data
#define BURST_COUNT 3
static float burstDist[BURST_COUNT];
static bool burstValid[BURST_COUNT];
static int burstIndex = 0;

// Filtered Results
static float lastDistCm = -1.0f;
static float lastRawDistCm = -1.0f;
static bool lastValid = false;
static float lastConfidence = 0.0f;
static float latestVariance = 0.0f;
static bool newSampleReady = false;
static bool obstacleDetected = false;

// Diagnostics Counters
static unsigned long totalReadings = 0;
static unsigned long rejectedReadings = 0;
static unsigned long timeoutCount = 0;

enum class ScannerState {
  IDLE,
  STEP_SERVO,
  WAIT_SETTLE,
  TRIGGER_BURST,
  WAIT_BURST_GAP,
  PROCESS_MEASUREMENTS
};

static ScannerState state = ScannerState::STEP_SERVO;

/**
 * Convert floating-point angle (0.0° - 180.0°) to microsecond pulse width.
 * Standard RC servo timing: 544 us (0°) to 2400 us (180°).
 * 0.25° corresponds to ~2.58 microseconds of pulse width resolution.
 */
static inline int angleToMicros(float angle) {
  float clamped = constrain(angle, 0.0f, 180.0f);
  return (int)(544.0f + (clamped / 180.0f) * 1856.0f);
}

void scannerInit() {
  pinMode(PIN_SONAR_TRIG, OUTPUT);
  digitalWrite(PIN_SONAR_TRIG, LOW);

  pinMode(PIN_SONAR_ECHO, INPUT);

  radarServo.attach(PIN_SERVO_SCANNER);
  currentAngle = 90.0f;
  isScanning = true;
  sweepMinAngle = 0.0f;
  sweepMaxAngle = 180.0f;
  sweepStepDeg = constrain(SCANNER_STEP_DEG, 0.25f, 45.0f);

  radarServo.writeMicroseconds(angleToMicros(currentAngle));

  cycleStartTime = millis();
  lastStateTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerSetConfig(float minAngle, float maxAngle, float stepDeg) {
  sweepMinAngle = constrain(minAngle, 0.0f, 180.0f);
  sweepMaxAngle = constrain(maxAngle, sweepMinAngle, 180.0f);
  sweepStepDeg = constrain(stepDeg, 0.25f, 45.0f);

  currentAngle = constrain(currentAngle, sweepMinAngle, sweepMaxAngle);
  radarServo.writeMicroseconds(angleToMicros(currentAngle));
}

void scannerSetScanParams(float stepDeg, int settleMs, float minD, float maxD, float tempC, float calibOffset, bool running) {
  sweepStepDeg = constrain(stepDeg, 0.25f, 45.0f);
  settleDelayMs = constrain(settleMs, 5, 100);
  minDistCm = constrain(minD, 1.0f, 50.0f);
  maxDistCm = constrain(maxD, 50.0f, 400.0f);
  currentTempC = constrain(tempC, -10.0f, 50.0f);
  calibOffsetCm = constrain(calibOffset, -25.0f, 25.0f);
  isScanning = running;

  if (running && state == ScannerState::IDLE) {
    state = ScannerState::STEP_SERVO;
  }
}

void scannerSetScanning(bool running) {
  isScanning = running;
  if (running && state == ScannerState::IDLE) {
    state = ScannerState::STEP_SERVO;
  } else if (!running) {
    state = ScannerState::IDLE;
  }
}

bool scannerIsAuto() {
  return isScanning;
}

bool scannerIsScanning() {
  return isScanning;
}

void scannerSetAngle(float angle) {
  isScanning = false;
  currentAngle = constrain(angle, 0.0f, 180.0f);
  radarServo.writeMicroseconds(angleToMicros(currentAngle));
  lastStateTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerTriggerPing() {
  lastStateTime = millis();
  burstIndex = 0;
  state = ScannerState::TRIGGER_BURST;
}

void scannerUpdate() {
  unsigned long now = millis();

  switch (state) {
    case ScannerState::IDLE: {
      // Manual mode or paused
      break;
    }

    case ScannerState::STEP_SERVO: {
      if (!isScanning) {
        state = ScannerState::IDLE;
        break;
      }

      if (sweepStepDeg > 0.0f && sweepMinAngle < sweepMaxAngle) {
        currentAngle += (float)sweepDirection * sweepStepDeg;
        if (currentAngle >= sweepMaxAngle) {
          currentAngle = sweepMaxAngle;
          sweepDirection = -1;
          scanCycleDurationMs = now - cycleStartTime;
          cycleStartTime = now;
        } else if (currentAngle <= sweepMinAngle) {
          currentAngle = sweepMinAngle;
          sweepDirection = 1;
          scanCycleDurationMs = now - cycleStartTime;
          cycleStartTime = now;
        }
      } else {
        currentAngle = sweepMinAngle;
      }

      radarServo.writeMicroseconds(angleToMicros(currentAngle));
      lastStateTime = now;
      state = ScannerState::WAIT_SETTLE;
      break;
    }

    case ScannerState::WAIT_SETTLE: {
      if (now - lastStateTime >= (unsigned long)settleDelayMs) {
        burstIndex = 0;
        state = ScannerState::TRIGGER_BURST;
      }
      break;
    }

    case ScannerState::TRIGGER_BURST: {
      // 1. Send clean 10us trigger pulse
      digitalWrite(PIN_SONAR_TRIG, LOW);
      delayMicroseconds(2);
      digitalWrite(PIN_SONAR_TRIG, HIGH);
      delayMicroseconds(10);
      digitalWrite(PIN_SONAR_TRIG, LOW);

      // 2. Measure echo pulse duration (timeout ~25ms prevents loop freezing)
      unsigned long duration = pulseIn(PIN_SONAR_ECHO, HIGH, SONAR_TIMEOUT_US);

      if (duration > 0 && duration < SONAR_TIMEOUT_US) {
        // Temperature-compensated speed of sound (m/s)
        float speedOfSound = 331.3f + (0.606f * currentTempC);
        // Distance in cm: (duration_us / 1,000,000) * speed_m_s * 100 / 2
        float dist = ((float)duration * speedOfSound) / 20000.0f + calibOffsetCm;

        if (dist >= minDistCm && dist <= maxDistCm) {
          burstDist[burstIndex] = dist;
          burstValid[burstIndex] = true;
        } else {
          burstDist[burstIndex] = -1.0f;
          burstValid[burstIndex] = false;
          rejectedReadings++;
        }
      } else {
        burstDist[burstIndex] = -1.0f;
        burstValid[burstIndex] = false;
        timeoutCount++;
      }

      burstIndex++;
      lastStateTime = now;

      if (burstIndex < BURST_COUNT) {
        state = ScannerState::WAIT_BURST_GAP;
      } else {
        state = ScannerState::PROCESS_MEASUREMENTS;
      }
      break;
    }

    case ScannerState::WAIT_BURST_GAP: {
      // 2ms inter-ping acoustic recovery delay
      if (now - lastStateTime >= 2) {
        state = ScannerState::TRIGGER_BURST;
      }
      break;
    }

    case ScannerState::PROCESS_MEASUREMENTS: {
      totalReadings++;

      // Collect valid burst samples
      float valids[BURST_COUNT];
      int validCount = 0;
      for (int i = 0; i < BURST_COUNT; i++) {
        if (burstValid[i]) {
          valids[validCount++] = burstDist[i];
        }
      }

      lastRawDistCm = (burstIndex > 0 && burstDist[0] > 0) ? burstDist[0] : -1.0f;

      if (validCount == 3) {
        // Simple sort for 3 elements (median filtering)
        if (valids[0] > valids[1]) { float t = valids[0]; valids[0] = valids[1]; valids[1] = t; }
        if (valids[1] > valids[2]) { float t = valids[1]; valids[1] = valids[2]; valids[2] = t; }
        if (valids[0] > valids[1]) { float t = valids[0]; valids[0] = valids[1]; valids[1] = t; }

        float median = valids[1];
        float variance = valids[2] - valids[0];
        latestVariance = variance;

        // Outlier rejection: if spread > 15cm, drop the farthest outlier
        if (variance > 15.0f) {
          rejectedReadings++;
          float diff01 = abs(valids[1] - valids[0]);
          float diff12 = abs(valids[2] - valids[1]);
          if (diff01 < diff12) {
            median = (valids[0] + valids[1]) / 2.0f;
          } else {
            median = (valids[1] + valids[2]) / 2.0f;
          }
          lastConfidence = 78.0f;
        } else {
          lastConfidence = constrain(100.0f - (variance * 2.5f), 85.0f, 100.0f);
        }

        lastDistCm = median;
        lastValid = true;
      } else if (validCount == 2) {
        float diff = abs(valids[0] - valids[1]);
        latestVariance = diff;
        if (diff < 12.0f) {
          lastDistCm = (valids[0] + valids[1]) / 2.0f;
          lastValid = true;
          lastConfidence = 80.0f;
        } else {
          // Inconsistent pair, take the closer reading with lower confidence
          lastDistCm = min(valids[0], valids[1]);
          lastValid = true;
          lastConfidence = 55.0f;
          rejectedReadings++;
        }
      } else if (validCount == 1) {
        lastDistCm = valids[0];
        lastValid = true;
        lastConfidence = 45.0f;
        latestVariance = 0.0f;
      } else {
        lastDistCm = -1.0f;
        lastValid = false;
        lastConfidence = 0.0f;
        latestVariance = 0.0f;
      }

      newSampleReady = true;

      // Obstacle evaluation in forward critical cone (70° - 110°)
      if (currentAngle >= OBSTACLE_SECTOR_MIN_DEG && currentAngle <= OBSTACLE_SECTOR_MAX_DEG) {
        if (lastValid && lastDistCm <= OBSTACLE_THRESHOLD_CM) {
          obstacleDetected = true;
        } else if (lastValid && lastDistCm > OBSTACLE_THRESHOLD_CM + 5.0f) {
          obstacleDetected = false;
        }
      }

      if (isScanning) {
        state = ScannerState::STEP_SERVO;
      } else {
        state = ScannerState::IDLE;
      }
      break;
    }
  }
}

bool scannerHasNewSample() {
  return newSampleReady;
}

void scannerGetLastSample(float &angle, float &distCm, float &rawDistCm, bool &valid, float &confidence) {
  angle = currentAngle;
  distCm = lastDistCm;
  rawDistCm = lastRawDistCm;
  valid = lastValid;
  confidence = lastConfidence;
  newSampleReady = false;
}

float scannerGetLatestDistance() {
  return lastDistCm;
}

float scannerGetCurrentAngle() {
  return currentAngle;
}

bool scannerIsObstacleAhead() {
  return obstacleDetected;
}

void scannerGetDiagnostics(SensorDiagnostics &diag) {
  diag.totalReadings = totalReadings;
  diag.rejectedReadings = rejectedReadings;
  diag.timeoutCount = timeoutCount;
  diag.scanCycleDurationMs = scanCycleDurationMs;
  diag.latestVariance = latestVariance;
  diag.currentTempC = currentTempC;
  diag.calibOffsetCm = calibOffsetCm;
}
