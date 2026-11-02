/**
 * PanzerNavSystem - Ultrasonic Radar Scanner Implementation
 */

#include "scanner.h"

static Servo radarServo;
static int currentAngle = (SERVO_MIN_ANGLE + SERVO_MAX_ANGLE) / 2;
static int sweepDirection = 1; // 1 for sweeping right/up, -1 for sweeping left/down
static unsigned long lastStepTime = 0;

static float lastDistCm = -1.0f;
static bool lastValid = false;
static bool newSampleReady = false;
static bool obstacleDetected = false;

enum class ScannerState {
  STEP_SERVO,
  WAIT_SETTLE,
  TRIGGER_SONAR
};

static ScannerState state = ScannerState::STEP_SERVO;

void scannerInit() {
  pinMode(PIN_SONAR_TRIG, OUTPUT);
  digitalWrite(PIN_SONAR_TRIG, LOW);

  pinMode(PIN_SONAR_ECHO, INPUT);

  radarServo.attach(PIN_RADAR_SERVO);
  currentAngle = constrain(90, SERVO_MIN_ANGLE, SERVO_MAX_ANGLE);
  radarServo.write(currentAngle);

  lastStepTime = millis();
  state = ScannerState::WAIT_SETTLE;
}

void scannerUpdate() {
  unsigned long now = millis();

  switch (state) {
    case ScannerState::STEP_SERVO: {
      currentAngle += sweepDirection * SERVO_STEP_DEG;
      if (currentAngle >= SERVO_MAX_ANGLE) {
        currentAngle = SERVO_MAX_ANGLE;
        sweepDirection = -1;
      } else if (currentAngle <= SERVO_MIN_ANGLE) {
        currentAngle = SERVO_MIN_ANGLE;
        sweepDirection = 1;
      }

      radarServo.write(currentAngle);
      lastStepTime = now;
      state = ScannerState::WAIT_SETTLE;
      break;
    }

    case ScannerState::WAIT_SETTLE: {
      if (now - lastStepTime >= SERVO_SETTLE_MS) {
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
        // Speed of sound: 343 m/s => 29.15 us/cm => round-trip: duration / 58.0f
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

      // 3. Obstacle evaluation:
      // If looking within the forward danger arc and reading is below threshold
      if (currentAngle >= OBSTACLE_SECTOR_MIN_DEG && currentAngle <= OBSTACLE_SECTOR_MAX_DEG) {
        if (lastValid && lastDistCm <= OBSTACLE_THRESHOLD_CM) {
          obstacleDetected = true;
        } else if (lastValid && lastDistCm > OBSTACLE_THRESHOLD_CM + 5.0f) {
          // Add 5cm hysteresis before clearing obstacle flag
          obstacleDetected = false;
        }
      }

      state = ScannerState::STEP_SERVO;
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
