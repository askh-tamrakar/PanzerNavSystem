/**
 * PanzerNavSystem - Web Server & WebSocket Transport Module
 * Handles 8-actuator telemetry and control protocols
 */

#ifndef WEB_HANDLER_H
#define WEB_HANDLER_H

#include <Arduino.h>
#ifdef ESP32
  #include <WebServer.h>
  typedef WebServer WebServerType;
#else
  #include <ESP8266WebServer.h>
  typedef ESP8266WebServer WebServerType;
#endif
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "config.h"

enum class ObstacleMode {
  AUTO,
  MANUAL
};

enum class TankState {
  IDLE,
  DRIVING,
  OBSTACLE_STOP,
  FAULT
};

void webHandlerInit();
void webHandlerLoop();

ObstacleMode webHandlerGetObstacleMode();
TankState webHandlerGetTankState();
void triggerSimulatedEffect();

#endif // WEB_HANDLER_H
