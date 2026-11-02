/**
 * PanzerNavSystem - Ultrasonic Radar Scanner Module
 * Sweeps servo and takes non-blocking ultrasonic distance measurements
 */

#ifndef SCANNER_H
#define SCANNER_H

#include <Arduino.h>
#include <Servo.h>
#include "config.h"

void scannerInit();
void scannerUpdate();

bool scannerHasNewSample();
void scannerGetLastSample(int &angle, float &distCm, bool &valid);
float scannerGetLatestDistance();
int scannerGetCurrentAngle();
bool scannerIsObstacleAhead();

#endif // SCANNER_H
