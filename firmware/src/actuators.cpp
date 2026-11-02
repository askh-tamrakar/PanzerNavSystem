/**
 * PanzerNavSystem - Actuators Implementation
 * 8-Actuator Controller with Profile A (DC Motors) and Profile B (Servos)
 */

#include "actuators.h"

#ifndef PWMRANGE
#define PWMRANGE 1023
#endif

static uint8_t currentProfile = ACTIVE_HARDWARE_PROFILE;
static DriveDirection currentDirection = DriveDirection::STOP;
static int currentSpeed = 0;

static int steeringLeftPos = STEERING_CENTER_ANGLE;
static int steeringRightPos = STEERING_CENTER_ANGLE;
static int aimingPos = AIMING_CENTER_ANGLE;

// Servos for Steering, Aiming, and 4-Channel Propulsion
static Servo steerLeftServo;
static Servo steerRightServo;
static Servo aimingServo;

static Servo propFLServo;
static Servo propRLServo;
static Servo propFRServo;
static Servo propRRServo;

void actuatorsInit() {
  // 1. Initialize DC motor pins to safe LOW (Profile A)
  pinMode(PIN_MOTOR_LEFT_IN1, OUTPUT);
  pinMode(PIN_MOTOR_LEFT_IN2, OUTPUT);
  pinMode(PIN_MOTOR_RIGHT_IN3, OUTPUT);
  pinMode(PIN_MOTOR_RIGHT_IN4, OUTPUT);

  digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);
  digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);
  digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);
  digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);

  // 2. Initialize 2 Steering Servos (Left & Right wheel/track articulation)
  steerLeftServo.attach(PIN_SERVO_STEER_L);
  steerRightServo.attach(PIN_SERVO_STEER_R);
  steerLeftServo.write(steeringLeftPos);
  steerRightServo.write(steeringRightPos);

  // 3. Initialize Aiming Servo (Turret pan)
  aimingServo.attach(PIN_SERVO_AIMING);
  aimingServo.write(aimingPos);

  // 4. Initialize 4 Propulsion Servos (Profile B)
  propFLServo.attach(PIN_SERVO_PROP_FL);
  #if (PIN_SERVO_PROP_RL != PIN_SERVO_PROP_FL)
  propRLServo.attach(PIN_SERVO_PROP_RL);
  #endif
  propFRServo.attach(PIN_SERVO_PROP_FR);
  #if (PIN_SERVO_PROP_RR != PIN_SERVO_PROP_FR)
  propRRServo.attach(PIN_SERVO_PROP_RR);
  #endif

  actuatorsStopPropulsion();
}

void actuatorsSetProfile(uint8_t profile) {
  if (profile <= PROFILE_B_PROPULSION_SERVOS) {
    currentProfile = profile;
    actuatorsStopPropulsion();
    Serial.printf("[ACTUATORS] Hardware profile changed to: %s\n", actuatorsGetProfileString());
  }
}

uint8_t actuatorsGetProfile() {
  return currentProfile;
}

const char* actuatorsGetProfileString() {
  switch (currentProfile) {
    case PROFILE_A_DC_MOTORS: return "profile_a_dc";
    case PROFILE_B_PROPULSION_SERVOS: return "profile_b_servo";
    case PROFILE_UNCONFIRMED:
    default: return "unconfirmed";
  }
}

void actuatorsStopPropulsion() {
  currentDirection = DriveDirection::STOP;
  currentSpeed = 0;

  // Profile A: Stop DC motors via L298N
  analogWrite(PIN_MOTOR_LEFT_IN1, 0);
  digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);
  analogWrite(PIN_MOTOR_LEFT_IN2, 0);
  digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);
  analogWrite(PIN_MOTOR_RIGHT_IN3, 0);
  digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);
  analogWrite(PIN_MOTOR_RIGHT_IN4, 0);
  digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);

  // Profile B: Stop all 4 Propulsion Servos (neutral 1500us pulse)
  if (propFLServo.attached()) propFLServo.writeMicroseconds(SERVO_PULSE_NEUTRAL_US);
  if (propRLServo.attached()) propRLServo.writeMicroseconds(SERVO_PULSE_NEUTRAL_US);
  if (propFRServo.attached()) propFRServo.writeMicroseconds(SERVO_PULSE_NEUTRAL_US);
  if (propRRServo.attached()) propRRServo.writeMicroseconds(SERVO_PULSE_NEUTRAL_US);
}

void actuatorsDrive(DriveDirection dir, int speedPercent) {
  // Safety Check: Refuse drive commands if profile is unconfirmed
  if (currentProfile == PROFILE_UNCONFIRMED) {
    actuatorsStopPropulsion();
    return;
  }

  speedPercent = constrain(speedPercent, 0, 100);
  currentSpeed = speedPercent;
  currentDirection = dir;

  if (dir == DriveDirection::STOP || speedPercent == 0) {
    actuatorsStopPropulsion();
    return;
  }

  // ---------------------------------------------------------------------------
  // PROFILE A: 4 Brushed DC Motors via 2x L298N Dual H-Bridges
  // Motor pairs share Left / Right direction signals
  // ---------------------------------------------------------------------------
  if (currentProfile == PROFILE_A_DC_MOTORS) {
    int pwm = map(speedPercent, 0, 100, 0, PWMRANGE);

    switch (dir) {
      case DriveDirection::FORWARD:
        analogWrite(PIN_MOTOR_LEFT_IN1, pwm);
        digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);
        analogWrite(PIN_MOTOR_RIGHT_IN3, pwm);
        digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);
        break;

      case DriveDirection::REVERSE:
        digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);
        analogWrite(PIN_MOTOR_LEFT_IN2, pwm);
        digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);
        analogWrite(PIN_MOTOR_RIGHT_IN4, pwm);
        break;

      case DriveDirection::LEFT:
        digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);
        analogWrite(PIN_MOTOR_LEFT_IN2, pwm);
        analogWrite(PIN_MOTOR_RIGHT_IN3, pwm);
        digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);
        break;

      case DriveDirection::RIGHT:
        analogWrite(PIN_MOTOR_LEFT_IN1, pwm);
        digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);
        digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);
        analogWrite(PIN_MOTOR_RIGHT_IN4, pwm);
        break;

      default:
        actuatorsStopPropulsion();
        break;
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // PROFILE B: 4 Propulsion Servos (Continuous-Rotation or Positional)
  // L298N boards are UNUSED in this profile
  // ---------------------------------------------------------------------------
  if (currentProfile == PROFILE_B_PROPULSION_SERVOS) {
    #if (PROPULSION_SERVO_TYPE == PROPULSION_SERVO_TYPE_CONTINUOUS)
    int forwardDelta = (speedPercent * (SERVO_PULSE_FORWARD_MAX_US - SERVO_PULSE_NEUTRAL_US)) / 100;
    int reverseDelta = (speedPercent * (SERVO_PULSE_NEUTRAL_US - SERVO_PULSE_REVERSE_MAX_US)) / 100;

    int leftPulse = SERVO_PULSE_NEUTRAL_US;
    int rightPulse = SERVO_PULSE_NEUTRAL_US;

    switch (dir) {
      case DriveDirection::FORWARD:
        leftPulse = SERVO_PULSE_NEUTRAL_US + forwardDelta;
        rightPulse = SERVO_PULSE_NEUTRAL_US + forwardDelta;
        break;
      case DriveDirection::REVERSE:
        leftPulse = SERVO_PULSE_NEUTRAL_US - reverseDelta;
        rightPulse = SERVO_PULSE_NEUTRAL_US - reverseDelta;
        break;
      case DriveDirection::LEFT:
        leftPulse = SERVO_PULSE_NEUTRAL_US - reverseDelta;
        rightPulse = SERVO_PULSE_NEUTRAL_US + forwardDelta;
        break;
      case DriveDirection::RIGHT:
        leftPulse = SERVO_PULSE_NEUTRAL_US + forwardDelta;
        rightPulse = SERVO_PULSE_NEUTRAL_US - reverseDelta;
        break;
      default:
        break;
    }

    // Drive all 4 propulsion servos
    if (propFLServo.attached()) propFLServo.writeMicroseconds(leftPulse);
    if (propRLServo.attached()) propRLServo.writeMicroseconds(leftPulse);
    if (propFRServo.attached()) propFRServo.writeMicroseconds(rightPulse);
    if (propRRServo.attached()) propRRServo.writeMicroseconds(rightPulse);

    #elif (PROPULSION_SERVO_TYPE == PROPULSION_SERVO_TYPE_POSITIONAL)
    int leftAngle = (dir == DriveDirection::FORWARD) ? 180 : (dir == DriveDirection::REVERSE) ? 0 : 90;
    int rightAngle = (dir == DriveDirection::FORWARD) ? 180 : (dir == DriveDirection::REVERSE) ? 0 : 90;
    if (propFLServo.attached()) propFLServo.write(leftAngle);
    if (propRLServo.attached()) propRLServo.write(leftAngle);
    if (propFRServo.attached()) propFRServo.write(rightAngle);
    if (propRRServo.attached()) propRRServo.write(rightAngle);
    #endif
    return;
  }
}

DriveDirection actuatorsGetDriveDirection() {
  return currentDirection;
}

int actuatorsGetSpeed() {
  return currentSpeed;
}

bool actuatorsIsDriving() {
  return currentDirection != DriveDirection::STOP;
}

// -----------------------------------------------------------------------------
// Steering Servos (2 Channels: Left & Right)
// -----------------------------------------------------------------------------
void actuatorsSetSteering(int leftAngle, int rightAngle) {
  steeringLeftPos = constrain(leftAngle, STEERING_MIN_ANGLE, STEERING_MAX_ANGLE);
  steeringRightPos = constrain(rightAngle, STEERING_MIN_ANGLE, STEERING_MAX_ANGLE);

  if (steerLeftServo.attached()) {
    steerLeftServo.write(steeringLeftPos);
  }
  if (steerRightServo.attached()) {
    steerRightServo.write(steeringRightPos);
  }
}

int actuatorsGetSteeringLeft() {
  return steeringLeftPos;
}

int actuatorsGetSteeringRight() {
  return steeringRightPos;
}

// -----------------------------------------------------------------------------
// Aiming Servo (1 Channel: Turret Pan)
// -----------------------------------------------------------------------------
void actuatorsSetAiming(int angle) {
  aimingPos = constrain(angle, AIMING_MIN_ANGLE, AIMING_MAX_ANGLE);
  if (aimingServo.attached()) {
    aimingServo.write(aimingPos);
  }
}

int actuatorsGetAiming() {
  return aimingPos;
}

void actuatorsSafeShutdown() {
  actuatorsStopPropulsion();
  actuatorsSetSteering(STEERING_CENTER_ANGLE, STEERING_CENTER_ANGLE);
  actuatorsSetAiming(AIMING_CENTER_ANGLE);
}
