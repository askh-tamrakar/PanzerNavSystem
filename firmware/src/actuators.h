/**
 * PanzerNavSystem - Actuators Subsystem
 * Manages all 8 actuator channels:
 * - 4 Propulsion units (Profile A: 4 DC Motors via 2x L298N; Profile B: 4 Servos)
 * - 2 Steering servos (Left & Right)
 * - 1 Aiming servo (Pan)
 * - 1 Scanner servo (Managed via scanner module)
 */

#ifndef ACTUATORS_H
#define ACTUATORS_H

#include <Arduino.h>
#ifdef ESP32
#include <ESP32Servo.h>
#else
#include <Servo.h>
#endif
#include "config.h"

enum class DriveDirection {
  STOP,
  FORWARD,
  REVERSE,
  LEFT,
  RIGHT
};

void actuatorsInit();
void actuatorsSetProfile(uint8_t profile);
uint8_t actuatorsGetProfile();
const char* actuatorsGetProfileString();

void actuatorsDrive(DriveDirection dir, int speedPercent);
void actuatorsStopPropulsion();
DriveDirection actuatorsGetDriveDirection();
int actuatorsGetSpeed();
bool actuatorsIsDriving();

void actuatorsSetSteering(int leftAngle, int rightAngle);
int actuatorsGetSteeringLeft();
int actuatorsGetSteeringRight();

void actuatorsSetAiming(int angle);
int actuatorsGetAiming();

void actuatorsSafeShutdown();

#endif // ACTUATORS_H
