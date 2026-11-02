/**
 * PanzerNavSystem - Main Firmware Entry Point
 * ESP8266 (ESP-12E / NodeMCU v2)
 *
 * Implements ESP-hosted Wi-Fi Access-Point mode as the default, autonomous
 * connection method. Connect phone to "PanzerTank-AP", open http://192.168.4.1/.
 * No internet connection, router, or app required.
 */

#include <Arduino.h>
#ifdef ESP32
  #include <WiFi.h>
  #include <ESPmDNS.h>
#else
  #include <ESP8266WiFi.h>
  #include <ESP8266mDNS.h>
#endif
#include <DNSServer.h>
#include "config.h"
#include "actuators.h"
#include "scanner.h"
#include "web_handler.h"

#if (ENABLE_CAPTIVE_PORTAL_HELPER == 1)
static DNSServer dnsServer;
#endif

// Wi-Fi SoftAP Event Handlers for live mobile connection tracking
#ifndef ESP32
static WiFiEventHandler apStationConnectedHandler;
static WiFiEventHandler apStationDisconnectedHandler;
#endif

void setup() {
  // 1. Initialize Serial Diagnostics
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("  PANZER NAV SYSTEM - ESP-HOSTED ACCESS POINT    "));
  Serial.println(F("=================================================="));
#ifdef ESP32
  Serial.printf("CPU Freq: %u MHz | Free Heap: %u bytes\n", (unsigned int)getCpuFrequencyMhz(), (unsigned int)ESP.getFreeHeap());
#else
  Serial.printf("CPU Freq: %u MHz | Free Heap: %u bytes\n", ESP.getCpuFreqMHz(), ESP.getFreeHeap());
#endif
  Serial.printf("[PROFILE] Active Hardware Profile: %s\n", actuatorsGetProfileString());
  if (actuatorsGetProfile() == PROFILE_UNCONFIRMED) {
    Serial.println(F("[WARNING] Hardware profile UNCONFIRMED! Propulsion locked out for safety."));
    Serial.println(F("[WARNING] Confirm Profile A (DC + 2x L298N) or Profile B (Servos) before driving."));
  }

  // 2. Safe Startup: Zero all actuators immediately
  Serial.println(F("[ACTUATORS] Initializing all 8 actuator channels to SAFE STOP/CENTER..."));
  actuatorsInit();

  // 3. Initialize Ultrasonic Radar Scanner
  Serial.println(F("[SCANNER] Initializing scanning servo and RCWL-1604 sonar..."));
  scannerInit();

  // 4. Configure Wi-Fi Access Point (Primary / Default Connection Mode)
  Serial.println(F("[WIFI] Configuring autonomous Wi-Fi Access Point..."));
  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(100);

  // Disable sleep mode so radio transmits beacons continuously
#ifdef ESP32
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
#else
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.setOutputPower(19.0f);
#endif

  IPAddress apIP(WIFI_AP_IP_OCT1, WIFI_AP_IP_OCT2, WIFI_AP_IP_OCT3, WIFI_AP_IP_OCT4);
  IPAddress apGateway(WIFI_AP_IP_OCT1, WIFI_AP_IP_OCT2, WIFI_AP_IP_OCT3, WIFI_AP_IP_OCT4);
  IPAddress apSubnet(255, 255, 255, 0);

  // If station credentials are provided in config.local.h, allow AP_STA dual mode
  if (strlen(WIFI_STA_SSID) > 0) {
    Serial.printf("[WIFI] Optional Station mode enabled. Connecting to SSID: %s\n", WIFI_STA_SSID);
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(WIFI_STA_SSID, WIFI_STA_PASS);
  } else {
    WiFi.mode(WIFI_AP);
  }

  // Set static IP for the Access Point (default: 192.168.4.1) BEFORE starting softAP
  WiFi.softAPConfig(apIP, apGateway, apSubnet);
  delay(50);

  // Support both WPA2-PSK (>= 8 chars) and OPEN (empty / nullptr) Wi-Fi
  const char *apPass = (strlen(WIFI_AP_PASS) >= 8) ? WIFI_AP_PASS : nullptr;
  bool apSuccess = WiFi.softAP(WIFI_AP_SSID, apPass, WIFI_AP_CHANNEL, WIFI_AP_HIDDEN, WIFI_AP_MAX_CONN);

  // Register real-time mobile connection tracking callbacks
#ifdef ESP32
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    if (event == ARDUINO_EVENT_WIFI_AP_STACONNECTED) {
      Serial.printf("\n[WIFI-EVENT] >>> PHONE/CLIENT CONNECTED! MAC: %02X:%02X:%02X:%02X:%02X:%02X | AID: %d\n",
                    info.wifi_ap_staconnected.mac[0], info.wifi_ap_staconnected.mac[1],
                    info.wifi_ap_staconnected.mac[2], info.wifi_ap_staconnected.mac[3],
                    info.wifi_ap_staconnected.mac[4], info.wifi_ap_staconnected.mac[5],
                    info.wifi_ap_staconnected.aid);
      Serial.printf("[WIFI-EVENT] Total active clients: %d\n\n", WiFi.softAPgetStationNum());
    } else if (event == ARDUINO_EVENT_WIFI_AP_STADISCONNECTED) {
      Serial.printf("\n[WIFI-EVENT] <<< PHONE/CLIENT DISCONNECTED! MAC: %02X:%02X:%02X:%02X:%02X:%02X | AID: %d\n",
                    info.wifi_ap_stadisconnected.mac[0], info.wifi_ap_stadisconnected.mac[1],
                    info.wifi_ap_stadisconnected.mac[2], info.wifi_ap_stadisconnected.mac[3],
                    info.wifi_ap_stadisconnected.mac[4], info.wifi_ap_stadisconnected.mac[5],
                    info.wifi_ap_stadisconnected.aid);
      Serial.printf("[WIFI-EVENT] Remaining active clients: %d\n\n", WiFi.softAPgetStationNum());
    }
  });
#else
  apStationConnectedHandler = WiFi.onSoftAPModeStationConnected([](const WiFiEventSoftAPModeStationConnected& evt) {
    Serial.printf("\n[WIFI-EVENT] >>> PHONE/CLIENT CONNECTED! MAC: %02X:%02X:%02X:%02X:%02X:%02X | AID: %d\n",
                  evt.mac[0], evt.mac[1], evt.mac[2], evt.mac[3], evt.mac[4], evt.mac[5], evt.aid);
    Serial.printf("[WIFI-EVENT] Total active clients: %d\n\n", WiFi.softAPgetStationNum());
  });

  apStationDisconnectedHandler = WiFi.onSoftAPModeStationDisconnected([](const WiFiEventSoftAPModeStationDisconnected& evt) {
    Serial.printf("\n[WIFI-EVENT] <<< PHONE/CLIENT DISCONNECTED! MAC: %02X:%02X:%02X:%02X:%02X:%02X | AID: %d\n",
                  evt.mac[0], evt.mac[1], evt.mac[2], evt.mac[3], evt.mac[4], evt.mac[5], evt.aid);
    Serial.printf("[WIFI-EVENT] Remaining active clients: %d\n\n", WiFi.softAPgetStationNum());
  });
#endif

  if (apSuccess) {
    Serial.println(F("[WIFI] -------------------------------------------------------------"));
    Serial.printf("[WIFI] Access Point STARTED: \"%s\"\n", WIFI_AP_SSID);
    Serial.printf("[WIFI] Local Browser URL:    http://%s/\n", WiFi.softAPIP().toString().c_str());
    Serial.printf("[WIFI] Channel: %u | Max Clients: %u | Tx Power: 19.0 dBm | Sleep: OFF\n", WIFI_AP_CHANNEL, WIFI_AP_MAX_CONN);
    if (apPass != nullptr) {
      Serial.printf("[WIFI] Security:             WPA2-PSK (Password: \"%s\")\n", apPass);
      Serial.println(F("[WIFI] IMPORTANT:           On your phone, select WPA/WPA2-Personal security!"));
      Serial.println(F("[WIFI]                      Do NOT select 'None' if password is required."));
    } else {
      Serial.println(F("[WIFI] Security:             OPEN (No password required)"));
      Serial.println(F("[WIFI] IMPORTANT:           On your phone, select 'None' / Open security."));
    }
    Serial.println(F("[WIFI] "));
    Serial.println(F("[WIFI] MOBILE CONNECTION INSTRUCTIONS:"));
    Serial.println(F("[WIFI] 1. TURN OFF MOBILE DATA (Cellular) on your phone."));
    Serial.println(F("[WIFI] 2. TURN OFF PRIVATE DNS (Settings > Network > Private DNS: Off)."));
    Serial.println(F("[WIFI] 3. If phone says 'Failed to connect', tap 'Forget Network' and retry."));
    Serial.println(F("[WIFI] 4. If using Static IP on phone:"));
    Serial.println(F("[WIFI]      IP Address:      192.168.4.50 (avoids DHCP conflict)"));
    Serial.println(F("[WIFI]      Gateway:         192.168.4.1"));
    Serial.println(F("[WIFI]      Prefix Length:   24 (or Subnet: 255.255.255.0)"));
    Serial.println(F("[WIFI]      DNS 1:           192.168.4.1"));
    Serial.println(F("[WIFI] 5. Open Chrome/Safari and browse to http://192.168.4.1/"));
    Serial.println(F("[WIFI] -------------------------------------------------------------"));
  } else {
    Serial.println(F("[WIFI] ERROR: SoftAP configuration failed!"));
  }

  #if (ENABLE_CAPTIVE_PORTAL_HELPER == 1)
  // Optional DNS helper redirects queries to local AP IP
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", apIP);
  Serial.println(F("[DNS] Captive assistant DNS responder active on port 53."));
  #endif

  // 5. Initialize mDNS responder (http://panzer.local)
  if (MDNS.begin(MDNS_HOSTNAME)) {
    Serial.printf("[MDNS] Responder started: http://%s.local\n", MDNS_HOSTNAME);
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("ws", "tcp", WS_PORT);
  }

  // 6. Initialize Web Server & WebSocket Transport
  Serial.println(F("[WEB] Initializing LittleFS static file server and WebSocket (port 81)..."));
  webHandlerInit();

  Serial.println(F("[SYSTEM] Initialization complete. All safety watchdogs active."));
  Serial.println(F("=================================================="));
}

void loop() {
  #if (ENABLE_CAPTIVE_PORTAL_HELPER == 1)
  dnsServer.processNextRequest();
  #endif
  #ifndef ESP32
  MDNS.update();
  #endif
  scannerUpdate();
  webHandlerLoop();
}
