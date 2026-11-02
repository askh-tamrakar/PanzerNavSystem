/**
 * PanzerNavSystem - Web Server & WebSocket Transport Module
 */

#ifndef WEB_HANDLER_H
#define WEB_HANDLER_H

#include <Arduino.h>
#include <ESP8266WebServer.h>
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
