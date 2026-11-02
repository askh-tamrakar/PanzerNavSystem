/**
 * PanzerNavSystem - Main Firmware Entry Point
 * ESP8266 (ESP-12E / NodeMCU v2)
 *
 * Provides Wi-Fi tank control with ultrasonic scanning visualization,
 * fail-safe motor shutdown, and dual-mode LittleFS / Apache web hosting.
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include "config.h"
#include "motors.h"
#include "scanner.h"
#include "web_handler.h"

void setup() {
  // 1. Initialize Serial Diagnostics
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("       PANZER NAV SYSTEM - ESP-12E FIRMWARE       "));
  Serial.println(F("=================================================="));
  Serial.printf("CPU Freq: %u MHz | Free Heap: %u bytes\n", ESP.getCpuFreqMHz(), ESP.getFreeHeap());

  // 2. Immediate Safe Startup: All motor outputs forced LOW
  Serial.println(F("[MOTORS] Initializing motor control pins to SAFE STOP..."));
  motorsInit();

  // 3. Initialize Ultrasonic Radar Scanner
  Serial.println(F("[SCANNER] Initializing scanning servo and ultrasonic sensor..."));
  scannerInit();

  // 4. Configure Wi-Fi
  Serial.println(F("[WIFI] Configuring networking..."));
  WiFi.persistent(false);

  // If station credentials are provided in config.local.h, attempt connection
  if (strlen(WIFI_STA_SSID) > 0) {
    Serial.printf("[WIFI] Attempting connection to Station SSID: %s\n", WIFI_STA_SSID);
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(WIFI_STA_SSID, WIFI_STA_PASS);

    unsigned long startWait = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - startWait < 8000)) {
      delay(250);
      Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[WIFI] Connected to Station! Station IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
      Serial.println(F("[WIFI] Station connection timed out. Falling back to SoftAP only."));
    }
  } else {
    WiFi.mode(WIFI_AP);
  }

  // Always enable SoftAP for direct phone-to-tank access
  bool apSuccess = WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS, WIFI_AP_CHANNEL);
  if (apSuccess) {
    Serial.printf("[WIFI] Access Point Active: SSID=\"%s\"\n", WIFI_AP_SSID);
    Serial.printf("[WIFI] SoftAP IP Address: %s\n", WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println(F("[WIFI] ERROR: SoftAP configuration failed!"));
  }

  // 5. Initialize mDNS responder (http://panzer.local)
  if (MDNS.begin(MDNS_HOSTNAME)) {
    Serial.printf("[MDNS] Responder started: http://%s.local\n", MDNS_HOSTNAME);
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("ws", "tcp", WS_PORT);
  }

  // 6. Initialize Web Server & WebSocket Transport
  Serial.println(F("[WEB] Initializing LittleFS static file server and WebSocket..."));
  webHandlerInit();

  Serial.println(F("[SYSTEM] Initialization complete. Safety watchdogs active."));
  Serial.println(F("=================================================="));
}

void loop() {
  MDNS.update();
  scannerUpdate();
  webHandlerLoop();
}
