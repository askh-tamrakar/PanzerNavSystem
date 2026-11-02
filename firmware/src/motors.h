/**
 * PanzerNavSystem - Motor Control Module
 * Controls 4 DC gear motors arranged as Left/Right pairs via L298N H-Bridge
 */

#ifndef MOTORS_H
#define MOTORS_H

#include <Arduino.h>
#include "config.h"

enum class DriveDirection {
  STOP,
  FORWARD,
  REVERSE,
  LEFT,
  RIGHT
};

void motorsInit();
void motorsDrive(DriveDirection dir, int speedPercent);
void motorsStop();
DriveDirection motorsGetDirection();
int motorsGetSpeed();
bool motorsIsDriving();

#endif // MOTORS_H
