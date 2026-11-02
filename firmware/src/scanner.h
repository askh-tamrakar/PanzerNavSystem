/**
 * PanzerNavSystem - Ultrasonic Radar Scanner Module
 * Sweeps servo and takes non-blocking ultrasonic distance measurements
 */

#ifndef SCANNER_H
#define SCANNER_H

#include <Arduino.h>
#ifdef ESP32
#include <ESP32Servo.h>
#else
#include <Servo.h>
#endif
#include "config.h"

enum class ScannerMode {
  AUTO,
  MANUAL
};

void scannerInit();
void scannerUpdate();
void scannerSetConfig(int minAngle, int maxAngle, int stepDeg);
void scannerSetMode(ScannerMode mode);
bool scannerIsAuto();
void scannerSetAngle(int angle);
void scannerStep(int direction, int customStep = 0);
void scannerTriggerPing();

bool scannerHasNewSample();
void scannerGetLastSample(int &angle, float &distCm, bool &valid);
float scannerGetLatestDistance();
int scannerGetCurrentAngle();
bool scannerIsObstacleAhead();

#endif // SCANNER_H
