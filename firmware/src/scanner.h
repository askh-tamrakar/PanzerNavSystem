/**
 * PanzerNavSystem - Advanced Ultrasonic Radar Scanner Module
 * Target: ESP8266 (ESP-12E) / ESP32
 * Features:
 * - Multi-sample burst ping with median filtering & outlier rejection
 * - Temperature compensation (sound speed = 331.3 + 0.606 * T)
 * - Configurable calibration offset, min/max distances, and settle delay
 * - Non-blocking state machine preventing Wi-Fi / WebSocket communication drops
 * - Diagnostics reporting (timeouts, rejected echoes, scan cycle duration)
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

struct SensorDiagnostics {
  unsigned long totalReadings;
  unsigned long rejectedReadings;
  unsigned long timeoutCount;
  unsigned long scanCycleDurationMs;
  float latestVariance;
  float currentTempC;
  float calibOffsetCm;
};

void scannerInit();
void scannerUpdate();
void scannerSetConfig(float minAngle, float maxAngle, float stepDeg);
void scannerSetScanParams(float stepDeg, int settleMs, float minDistCm, float maxDistCm, float tempC, float calibOffsetCm, bool running);
void scannerSetScanning(bool running);
bool scannerIsScanning();
void scannerSetAngle(float angle);
void scannerTriggerPing();

bool scannerHasNewSample();
void scannerGetLastSample(float &angle, float &distCm, float &rawDistCm, bool &valid, float &confidence);
float scannerGetLatestDistance();
float scannerGetCurrentAngle();
bool scannerIsObstacleAhead();
void scannerGetDiagnostics(SensorDiagnostics &diag);

#endif // SCANNER_H
