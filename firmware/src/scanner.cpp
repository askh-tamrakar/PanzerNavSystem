/**
 * PanzerNavSystem - Ultrasonic Radar Scanner Implementation
 * Full 0° to 180° range with Auto continuous sweep and Manual stepping
 * Steps are constrained to divisors of 180 (e.g. 5°, 6°, 10°, 15°, 20°, 30°, 45°)
 */

#include "scanner.h"

static Servo radarServo;
static ScannerMode currentMode = ScannerMode::AUTO;

static int sweepMinAngle = SCANNER_MIN_ANGLE; // Default: 0
static int sweepMaxAngle = SCANNER_MAX_ANGLE; // Default: 180
static int sweepStepDeg = SCANNER_STEP_DEG;   // Default: 10 (divisible by 180)

static int currentAngle = (SCANNER_MIN_ANGLE + SCANNER_MAX_ANGLE) / 2; // 90
static int sweepDirection = 1;
static unsigned long lastStepTime = 0;

static float lastDistCm = -1.0f;
static bool lastValid = false;
static bool newSampleReady = false;
static bool obstacleDetected = false;

enum class ScannerState {
  IDLE,
  STEP_SERVO,
  WAIT_SETTLE,
  TRIGGER_SONAR
};

static ScannerState state = ScannerState::STEP_SERVO;

/**
 * Ensure step size is a true divisor of 180 (180 % step == 0)
 * Divisors of 180: 1, 2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45, 60, 90, 180
 */
static int sanitizeDivisorOf180(int step) {
  if (step <= 0) return 10;
  if (180 % step == 0) return step;

  static const int validDivisors[] = {1, 2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45, 60, 90, 180};
  int best = 10;
  int bestDiff = 999;
  for (int d : validDivisors) {
    int diff = abs(d - step);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

void scannerInit() {
  pinMode(PIN_SONAR_TRIG, OUTPUT);
  digitalWrite(PIN_SONAR_TRIG, LOW);

  pinMode(PIN_SONAR_ECHO, INPUT);

  radarServo.attach(PIN_SERVO_SCANNER);
  currentAngle = 90;
  currentMode = ScannerMode::AUTO;
  sweepMinAngle = 0;
  sweepMaxAngle = 180;
  sweepStepDeg = sanitizeDivisorOf180(SCANNER_STEP_DEG);

  radarServo.write(currentAngle);

  lastStepTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerSetConfig(int minAngle, int maxAngle, int stepDeg) {
  sweepMinAngle = constrain(minAngle, 0, 180);
  sweepMaxAngle = constrain(maxAngle, sweepMinAngle, 180);
  sweepStepDeg = sanitizeDivisorOf180(stepDeg);

  currentAngle = constrain(currentAngle, sweepMinAngle, sweepMaxAngle);
  radarServo.write(currentAngle);
}

void scannerSetMode(ScannerMode mode) {
  currentMode = mode;
  if (mode == ScannerMode::AUTO) {
    state = ScannerState::STEP_SERVO;
  } else {
    state = ScannerState::IDLE;
  }
}

bool scannerIsAuto() {
  return currentMode == ScannerMode::AUTO;
}

void scannerSetAngle(int angle) {
  currentMode = ScannerMode::MANUAL;
  currentAngle = constrain(angle, 0, 180);
  radarServo.write(currentAngle);
  lastStepTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerStep(int direction, int customStep) {
  currentMode = ScannerMode::MANUAL;
  int step = (customStep > 0) ? sanitizeDivisorOf180(customStep) : sweepStepDeg;

  if (direction >= 0) {
    currentAngle += step;
  } else {
    currentAngle -= step;
  }

  currentAngle = constrain(currentAngle, 0, 180);
  radarServo.write(currentAngle);
  lastStepTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerTriggerPing() {
  lastStepTime = millis();
  state = ScannerState::TRIGGER_SONAR;
}

void scannerUpdate() {
  unsigned long now = millis();

  switch (state) {
    case ScannerState::IDLE: {
      // In manual mode, wait for operator step or angle command
      break;
    }

    case ScannerState::STEP_SERVO: {
      if (currentMode != ScannerMode::AUTO) {
        state = ScannerState::IDLE;
        break;
      }

      if (sweepStepDeg > 0 && sweepMinAngle < sweepMaxAngle) {
        currentAngle += sweepDirection * sweepStepDeg;
        if (currentAngle >= sweepMaxAngle) {
          currentAngle = sweepMaxAngle;
          sweepDirection = -1;
        } else if (currentAngle <= sweepMinAngle) {
          currentAngle = sweepMinAngle;
          sweepDirection = 1;
        }
      } else {
        currentAngle = sweepMinAngle; // Locked angle
      }

      radarServo.write(currentAngle);
      lastStepTime = now;
      state = ScannerState::WAIT_SETTLE;
      break;
    }

    case ScannerState::WAIT_SETTLE: {
      if (now - lastStepTime >= SCANNER_SETTLE_MS) {
        state = ScannerState::TRIGGER_SONAR;
      }
      break;
    }

    case ScannerState::TRIGGER_SONAR: {
      // 1. Send 10 microsecond trigger pulse
      digitalWrite(PIN_SONAR_TRIG, LOW);
      delayMicroseconds(2);
      digitalWrite(PIN_SONAR_TRIG, HIGH);
      delayMicroseconds(10);
      digitalWrite(PIN_SONAR_TRIG, LOW);

      // 2. Measure echo pulse duration (timeout prevents hanging loop)
      unsigned long duration = pulseIn(PIN_SONAR_ECHO, HIGH, SONAR_TIMEOUT_US);

      if (duration > 0 && duration < SONAR_TIMEOUT_US) {
        float dist = duration / 58.0f;
        if (dist >= 2.0f && dist <= 350.0f) {
          lastDistCm = dist;
          lastValid = true;
        } else {
          lastDistCm = -1.0f;
          lastValid = false;
        }
      } else {
        lastDistCm = -1.0f;
        lastValid = false;
      }

      newSampleReady = true;

      // 3. Obstacle evaluation in forward critical cone:
      if (currentAngle >= OBSTACLE_SECTOR_MIN_DEG && currentAngle <= OBSTACLE_SECTOR_MAX_DEG) {
        if (lastValid && lastDistCm <= OBSTACLE_THRESHOLD_CM) {
          obstacleDetected = true;
        } else if (lastValid && lastDistCm > OBSTACLE_THRESHOLD_CM + 5.0f) {
          obstacleDetected = false;
        }
      }

      // Return to STEP_SERVO if in auto mode, or IDLE if in manual mode
      if (currentMode == ScannerMode::AUTO) {
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

void scannerGetLastSample(int &angle, float &distCm, bool &valid) {
  angle = currentAngle;
  distCm = lastDistCm;
  valid = lastValid;
  newSampleReady = false;
}

float scannerGetLatestDistance() {
  return lastDistCm;
}

int scannerGetCurrentAngle() {
  return currentAngle;
}

bool scannerIsObstacleAhead() {
  return obstacleDetected;
}
