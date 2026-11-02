/**
 * PanzerNavSystem - Motor Control Implementation
 */

#include "motors.h"

#ifndef PWMRANGE
#define PWMRANGE 1023
#endif

static DriveDirection currentDirection = DriveDirection::STOP;
static int currentSpeed = 0;

void motorsInit() {
  pinMode(PIN_MOTOR_LEFT_IN1, OUTPUT);
  pinMode(PIN_MOTOR_LEFT_IN2, OUTPUT);
  pinMode(PIN_MOTOR_RIGHT_IN3, OUTPUT);
  pinMode(PIN_MOTOR_RIGHT_IN4, OUTPUT);

  motorsStop();
}

void motorsStop() {
  analogWrite(PIN_MOTOR_LEFT_IN1, 0);
  digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);

  analogWrite(PIN_MOTOR_LEFT_IN2, 0);
  digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);

  analogWrite(PIN_MOTOR_RIGHT_IN3, 0);
  digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);

  analogWrite(PIN_MOTOR_RIGHT_IN4, 0);
  digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);

  currentDirection = DriveDirection::STOP;
}

void motorsDrive(DriveDirection dir, int speedPercent) {
  // Clamp speed percent strictly within 0..100
  speedPercent = constrain(speedPercent, 0, 100);
  currentSpeed = speedPercent;
  currentDirection = dir;

  if (dir == DriveDirection::STOP || speedPercent == 0) {
    motorsStop();
    return;
  }

  // Map 0..100% to ESP8266 PWM range (0..PWMRANGE, typically 1023)
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
      // Skid-steer left: left side reverse, right side forward
      digitalWrite(PIN_MOTOR_LEFT_IN1, LOW);
      analogWrite(PIN_MOTOR_LEFT_IN2, pwm);
      analogWrite(PIN_MOTOR_RIGHT_IN3, pwm);
      digitalWrite(PIN_MOTOR_RIGHT_IN4, LOW);
      break;

    case DriveDirection::RIGHT:
      // Skid-steer right: left side forward, right side reverse
      analogWrite(PIN_MOTOR_LEFT_IN1, pwm);
      digitalWrite(PIN_MOTOR_LEFT_IN2, LOW);
      digitalWrite(PIN_MOTOR_RIGHT_IN3, LOW);
      analogWrite(PIN_MOTOR_RIGHT_IN4, pwm);
      break;

    default:
      motorsStop();
      break;
  }
}

DriveDirection motorsGetDirection() {
  return currentDirection;
}

int motorsGetSpeed() {
  return currentSpeed;
}

bool motorsIsDriving() {
  return currentDirection != DriveDirection::STOP;
}
