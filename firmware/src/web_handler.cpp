/**
 * PanzerNavSystem - Web Server & WebSocket Transport Implementation
 * Supports 8-actuator control protocol (Protocol v2)
 */

#include "web_handler.h"
#include "actuators.h"
#include "scanner.h"

#if __has_include("site_assets.h")
#include "site_assets.h"
#define HAS_EMBEDDED_SITE 1
#else
#define HAS_EMBEDDED_SITE 0
#endif

static WebServerType server(HTTP_PORT);
static WebSocketsServer webSocket(WS_PORT);

static ObstacleMode currentObstacleMode = ObstacleMode::AUTO;
static TankState currentTankState = TankState::IDLE;

static unsigned long lastCommandTime = 0;
static unsigned long lastTelemetryTime = 0;
static unsigned long effectStartTime = 0;
static bool effectActive = false;
static bool littleFsMounted = false;

// -----------------------------------------------------------------------------
// Helper: MIME Type Determination
// -----------------------------------------------------------------------------
static String getContentType(const String &filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css"))  return "text/css";
  if (filename.endsWith(".js"))   return "application/javascript";
  if (filename.endsWith(".svg"))  return "image/svg+xml";
  if (filename.endsWith(".ico"))  return "image/x-icon";
  if (filename.endsWith(".json")) return "application/json";
  return "text/plain";
}

// -----------------------------------------------------------------------------
// HTTP: Fallback Rescue Page
// -----------------------------------------------------------------------------
static void sendRescuePage() {
  String apIp = WiFi.softAPIP().toString();
  String html = F(
    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>PanzerNavSystem - Setup Required</title>"
    "<style>"
    "body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#f0f6fc;padding:2rem;line-height:1.6;max-width:680px;margin:auto}"
    "h1{color:#00e5ff;font-size:1.5rem}code{background:#161b22;padding:0.2rem 0.4rem;border-radius:4px;color:#7ee787}"
    ".card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem;margin-top:1.5rem}"
    ".badge{display:inline-block;padding:0.2rem 0.6rem;background:#238636;color:#fff;border-radius:20px;font-size:0.85rem;margin-bottom:1rem}"
    "</style></head><body>"
    "<span class='badge'>ESP-Hosted Wi-Fi AP Active</span>"
    "<h1>PanzerNavSystem - Site Files Not In LittleFS</h1>"
    "<p>The ESP8266 Access Point is running at <strong>"
  );
  html += apIp;
  html += F(
    "</strong>, but website assets have not yet been written to LittleFS flash.</p>"
    "<div class='card'>"
    "<h3>Option 1: Upload Site Files to LittleFS (Recommended)</h3>"
    "<p>Connect your computer via USB and run:</p>"
    "<p><code>upload_site.bat</code></p>"
    "<p><small>This builds the mobile interface with relative paths and uploads the filesystem image to the ESP.</small></p>"
    "<h3>Option 2: Host from Apache (Developer Mode)</h3>"
    "<p>Serve <code>site/dist/</code> from your Apache <code>htdocs</code> and connect to WebSocket <code>ws://"
  );
  html += apIp;
  html += F(
    ":81/</code>.</p>"
    "</div></body></html>"
  );
  server.send(200, "text/html", html);
}

// -----------------------------------------------------------------------------
// HTTP: Captive Portal Probe Responses (Keeps Mobile OS connected stably)
// -----------------------------------------------------------------------------
static void handleGenerate204() {
  // Android & Chromium probe: 204 tells the OS internet is working and keeps Wi-Fi active
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.send(204, "text/plain", "");
}

static void handleAppleCNA() {
  // Apple iOS probe: 'Success' body tells iOS the connection is complete
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.send(200, "text/html", "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
}

static void handleMicrosoftNCSI() {
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.send(200, "text/plain", "Microsoft NCSI");
}

static void handleMicrosoftConnectTest() {
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.send(200, "text/plain", "Microsoft Connect Test");
}

static void handleCaptiveRedirect() {
  String uri = server.uri();
  if (uri.indexOf("204") >= 0 || uri.indexOf("fwlink") >= 0) {
    handleGenerate204();
    return;
  }
  if (uri.indexOf("hotspot-detect") >= 0 || uri.indexOf("canonical.html") >= 0) {
    handleAppleCNA();
    return;
  }
  if (uri.indexOf("connecttest") >= 0) {
    handleMicrosoftConnectTest();
    return;
  }
  if (uri.indexOf("ncsi") >= 0) {
    handleMicrosoftNCSI();
    return;
  }

  String apIp = WiFi.softAPIP().toString();
  String redirectUrl = "http://" + apIp + "/";
  server.sendHeader("Location", redirectUrl, true);
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.sendHeader("Pragma", "no-cache");
  server.sendHeader("Expires", "-1");
  server.send(302, "text/plain", "Redirecting to PanzerNavSystem: " + redirectUrl);
}

// -----------------------------------------------------------------------------
// HTTP: REST Status Endpoint
// -----------------------------------------------------------------------------
static void handleStatus() {
  JsonDocument doc;
  doc["status"] = "ok";
  doc["apSsid"] = WIFI_AP_SSID;
  doc["apIp"] = WiFi.softAPIP().toString();
  doc["apClients"] = WiFi.softAPgetStationNum();
  doc["profile"] = actuatorsGetProfileString();
  doc["fsMounted"] = littleFsMounted;
  doc["embeddedSite"] = (HAS_EMBEDDED_SITE == 1);
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  String json;
  serializeJson(doc, json);
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// -----------------------------------------------------------------------------
// HTTP: Serve Static Files (LittleFS + Embedded PROGMEM Unified Fallback)
// -----------------------------------------------------------------------------
static void handleLittleFsFile() {
  String apIp = WiFi.softAPIP().toString();
  String host = server.hostHeader();

  // If phone captive probe was directed via DNS for an external domain, redirect to AP root
  #if (ENABLE_CAPTIVE_PORTAL_HELPER == 1)
  if (host.length() > 0 && host != apIp && host != (apIp + ":" + String(HTTP_PORT)) && host != "panzer.local") {
    handleCaptiveRedirect();
    return;
  }
  #endif

  String path = server.uri();
  if (path.endsWith("/")) {
    path += "index.html";
  }

  // 1. Primary check: LittleFS if mounted and file exists
  if (littleFsMounted) {
    if (LittleFS.exists(path + ".gz")) {
      File file = LittleFS.open(path + ".gz", "r");
      server.sendHeader("Content-Encoding", "gzip");
      server.sendHeader("Cache-Control", "max-age=86400");
      server.streamFile(file, getContentType(path));
      file.close();
      return;
    }

    if (LittleFS.exists(path)) {
      File file = LittleFS.open(path, "r");
      if (path.endsWith(".html")) {
        server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        server.sendHeader("Cache-Control", "max-age=86400");
      }
      server.streamFile(file, getContentType(path));
      file.close();
      return;
    }
  }

  // 2. Single-Flash Unified Delivery: Serve directly from embedded PROGMEM flash
  #if (HAS_EMBEDDED_SITE == 1)
  for (size_t i = 0; i < EMBEDDED_SITE_ASSETS_COUNT; i++) {
    if (strcmp(path.c_str(), EMBEDDED_SITE_ASSETS[i].path) == 0 ||
        (path == "/index.html" && strcmp("/", EMBEDDED_SITE_ASSETS[i].path) == 0)) {
      server.sendHeader("Content-Encoding", "gzip");
      if (path == "/" || path == "/index.html") {
        server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        server.sendHeader("Cache-Control", "max-age=86400");
      }
      server.send_P(200, EMBEDDED_SITE_ASSETS[i].mimeType, (PGM_P)EMBEDDED_SITE_ASSETS[i].data, EMBEDDED_SITE_ASSETS[i].length);
      return;
    }
  }
  #endif

  // 3. Fallback: If index.html requested and missing everywhere, show rescue page
  if (path == "/index.html" || path == "/") {
    sendRescuePage();
  } else {
    server.send(404, "text/plain", "404 Not Found: " + path);
  }
}

// -----------------------------------------------------------------------------
// Harmless Simulation Effect Trigger
// -----------------------------------------------------------------------------
void triggerSimulatedEffect() {
  digitalWrite(PIN_SIMULATED_EFFECT, HIGH);
  effectActive = true;
  effectStartTime = millis();
}

// -----------------------------------------------------------------------------
// WebSocket: Process Incoming JSON Command (Protocol v2)
// -----------------------------------------------------------------------------
static void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length) {
  if (length > 512) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) return;

  const char *type = doc["type"] | "";

  // 1. Drive command (Propulsion Actuators)
  if (strcmp(type, "drive") == 0) {
    const char *dirStr = doc["dir"] | "stop";
    int speed = doc["speed"] | 0;
    speed = constrain(speed, 0, 100);

    DriveDirection dir = DriveDirection::STOP;
    if (strcmp(dirStr, "forward") == 0) dir = DriveDirection::FORWARD;
    else if (strcmp(dirStr, "reverse") == 0) dir = DriveDirection::REVERSE;
    else if (strcmp(dirStr, "left") == 0) dir = DriveDirection::LEFT;
    else if (strcmp(dirStr, "right") == 0) dir = DriveDirection::RIGHT;
    else dir = DriveDirection::STOP;

    // Obstacle Interlock: Autonomous safety stop
    if (dir == DriveDirection::FORWARD && currentObstacleMode == ObstacleMode::AUTO && scannerIsObstacleAhead()) {
      actuatorsStopPropulsion();
      currentTankState = TankState::OBSTACLE_STOP;
    } else {
      actuatorsDrive(dir, speed);
      currentTankState = (dir == DriveDirection::STOP) ? TankState::IDLE : TankState::DRIVING;
    }

    lastCommandTime = millis();
    return;
  }

  // 2. Steering command (2 Steering Servos)
  if (strcmp(type, "steering") == 0) {
    int leftAngle = doc["leftAngle"] | STEERING_CENTER_ANGLE;
    int rightAngle = doc["rightAngle"] | STEERING_CENTER_ANGLE;
    actuatorsSetSteering(leftAngle, rightAngle);
    lastCommandTime = millis();
    return;
  }

  // 3. Aiming command (1 Aiming Servo)
  if (strcmp(type, "aiming") == 0) {
    int angle = doc["angle"] | AIMING_CENTER_ANGLE;
    actuatorsSetAiming(angle);
    lastCommandTime = millis();
    return;
  }

  // 4. Scanner Config command (Full parameters: resolution, speed/settle, limits, calibration, temp)
  if (strcmp(type, "scanner_config") == 0) {
    float minAngle = doc["minAngle"] | 0.0f;
    float maxAngle = doc["maxAngle"] | 180.0f;
    float stepDeg = doc["stepDeg"] | 1.0f;
    int settleMs = doc["settleMs"] | 15;
    float minDistCm = doc["minDistCm"] | 2.0f;
    float maxDistCm = doc["maxDistCm"] | 250.0f;
    float tempC = doc["tempC"] | 20.0f;
    float calibOffsetCm = doc["calibOffsetCm"] | 0.0f;
    bool running = doc["scanning"] | true;

    scannerSetConfig(minAngle, maxAngle, stepDeg);
    scannerSetScanParams(stepDeg, settleMs, minDistCm, maxDistCm, tempC, calibOffsetCm, running);
    lastCommandTime = millis();
    return;
  }

  // 4a. Manual Angle positioning command
  if (strcmp(type, "manual_angle") == 0) {
    float angle = doc["angle"] | 90.0f;
    scannerSetAngle(angle);
    lastCommandTime = millis();
    return;
  }

  // 4b. Scanner Manual Stepping & Single Ping command
  if (strcmp(type, "scanner_manual") == 0) {
    const char *action = doc["action"] | "";
    float stepDeg = doc["stepDeg"] | 1.0f;
    if (strcmp(action, "step_left") == 0) {
      scannerStep(-1, stepDeg);
    } else if (strcmp(action, "step_right") == 0) {
      scannerStep(1, stepDeg);
    } else if (strcmp(action, "set_angle") == 0) {
      float angle = doc["angle"] | 90.0f;
      scannerSetAngle(angle);
    } else if (strcmp(action, "ping") == 0) {
      scannerTriggerPing();
    } else if (strcmp(action, "auto") == 0) {
      scannerSetScanning(true);
    }
    lastCommandTime = millis();
    return;
  }

  // 5. Hardware Profile Selection
  if (strcmp(type, "set_profile") == 0) {
    const char *profStr = doc["profile"] | "unconfirmed";
    if (strcmp(profStr, "profile_a_dc") == 0) {
      actuatorsSetProfile(PROFILE_A_DC_MOTORS);
    } else if (strcmp(profStr, "profile_b_servo") == 0) {
      actuatorsSetProfile(PROFILE_B_PROPULSION_SERVOS);
    } else {
      actuatorsSetProfile(PROFILE_UNCONFIRMED);
    }
    return;
  }

  // 6. Stop command
  if (strcmp(type, "stop") == 0) {
    actuatorsStopPropulsion();
    currentTankState = TankState::IDLE;
    lastCommandTime = millis();
    return;
  }

  // 7. Mode command
  if (strcmp(type, "mode") == 0) {
    const char *modeStr = doc["obstacleMode"] | "auto";
    if (strcmp(modeStr, "manual") == 0) {
      currentObstacleMode = ObstacleMode::MANUAL;
    } else {
      currentObstacleMode = ObstacleMode::AUTO;
    }
    return;
  }

  // 8. Harmless simulation effect
  if (strcmp(type, "effect") == 0) {
    const char *action = doc["action"] | "";
    if (strcmp(action, "simulate_fire") == 0) {
      triggerSimulatedEffect();
    }
    return;
  }

  // 9. Ping message
  if (strcmp(type, "ping") == 0) {
    lastCommandTime = millis();
    JsonDocument replyDoc;
    replyDoc["type"] = "pong";
    replyDoc["t"] = doc["t"] | 0;
    String replyJson;
    serializeJson(replyDoc, replyJson);
    webSocket.sendTXT(num, replyJson);
    return;
  }
}

// -----------------------------------------------------------------------------
// WebSocket Event Dispatcher
// -----------------------------------------------------------------------------
static void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      actuatorsStopPropulsion();
      currentTankState = TankState::IDLE;
      break;

    case WStype_CONNECTED:
      lastCommandTime = millis();
      break;

    case WStype_TEXT:
      handleWebSocketMessage(num, payload, length);
      break;

    default:
      break;
  }
}

// -----------------------------------------------------------------------------
// Public Initialization
// -----------------------------------------------------------------------------
void webHandlerInit() {
  pinMode(PIN_SIMULATED_EFFECT, OUTPUT);
  digitalWrite(PIN_SIMULATED_EFFECT, LOW);

#ifdef ESP32
  littleFsMounted = LittleFS.begin(true);
#else
  littleFsMounted = LittleFS.begin();
#endif

  // Status & health API
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_GET, handleStatus);

  #if (ENABLE_CAPTIVE_PORTAL_HELPER == 1)
  // Connectivity check endpoints (tell Android/iOS/Windows the network is online)
  server.on("/generate_204", HTTP_GET, handleGenerate204);
  server.on("/gen_204", HTTP_GET, handleGenerate204);
  server.on("/hotspot-detect.html", HTTP_GET, handleAppleCNA);
  server.on("/canonical.html", HTTP_GET, handleAppleCNA);
  server.on("/ncsi.txt", HTTP_GET, handleMicrosoftNCSI);
  server.on("/connecttest.txt", HTTP_GET, handleMicrosoftConnectTest);
  server.on("/success.txt", HTTP_GET, handleMicrosoftConnectTest);
  server.on("/fwlink", HTTP_GET, handleGenerate204);
  #endif

  server.onNotFound(handleLittleFsFile);
  server.begin();

  #if (HAS_EMBEDDED_SITE == 1)
  Serial.printf("[WEB] Unified firmware binary active: %u web assets embedded in PROGMEM flash.\n", (unsigned int)EMBEDDED_SITE_ASSETS_COUNT);
  #endif

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  lastCommandTime = millis();
  lastTelemetryTime = millis();
}

// -----------------------------------------------------------------------------
// Public Loop Handler
// -----------------------------------------------------------------------------
void webHandlerLoop() {
  server.handleClient();
  webSocket.loop();

  unsigned long now = millis();

  // 1. Harmless simulation effect timer
  if (effectActive && (now - effectStartTime >= EFFECT_DURATION_MS)) {
    digitalWrite(PIN_SIMULATED_EFFECT, LOW);
    effectActive = false;
  }

  // 2. Safety Watchdog: Halt propulsion on timeout
  if (actuatorsIsDriving() && (now - lastCommandTime >= COMMAND_TIMEOUT_MS)) {
    actuatorsStopPropulsion();
    currentTankState = TankState::IDLE;
  }

  // 3. Autonomous Obstacle Interlock
  if (currentObstacleMode == ObstacleMode::AUTO && scannerIsObstacleAhead()) {
    if (actuatorsGetDriveDirection() == DriveDirection::FORWARD) {
      actuatorsStopPropulsion();
      currentTankState = TankState::OBSTACLE_STOP;
    }
  }

  // 4. Broadcast new radar scan sample (Enhanced with raw distance, confidence, and timestamp)
  if (scannerHasNewSample()) {
    float angle = 0.0f;
    float distCm = 0.0f;
    float rawDistCm = 0.0f;
    bool valid = false;
    float confidence = 0.0f;
    scannerGetLastSample(angle, distCm, rawDistCm, valid, confidence);

    JsonDocument scanDoc;
    scanDoc["type"] = "scan";
    scanDoc["v"] = 2;
    scanDoc["angle"] = round(angle * 10.0f) / 10.0f;
    scanDoc["distCm"] = valid ? round(distCm * 10.0f) / 10.0f : -1.0f;
    scanDoc["rawDistCm"] = (rawDistCm > 0.0f) ? round(rawDistCm * 10.0f) / 10.0f : -1.0f;
    scanDoc["valid"] = valid;
    scanDoc["confidence"] = round(confidence);
    scanDoc["t"] = millis();

    String scanJson;
    serializeJson(scanDoc, scanJson);
    webSocket.broadcastTXT(scanJson);
  }

  // 5. Broadcast periodic telemetry (Protocol v2 with 8 actuators, sensor diagnostics & AP state)
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    JsonDocument telemDoc;
    telemDoc["type"] = "telemetry";
    telemDoc["v"] = 2;
    telemDoc["profile"] = actuatorsGetProfileString();
    telemDoc["uptime"] = now / 1000;

    const char *stateStr = "idle";
    if (currentTankState == TankState::DRIVING) stateStr = "driving";
    else if (currentTankState == TankState::OBSTACLE_STOP) stateStr = "obstacle_stop";
    else if (currentTankState == TankState::FAULT) stateStr = "fault";
    telemDoc["state"] = stateStr;

    telemDoc["obstacleMode"] = (currentObstacleMode == ObstacleMode::AUTO) ? "auto" : "manual";
    telemDoc["obstacle"] = scannerIsObstacleAhead();
    telemDoc["distCm"] = round(scannerGetLatestDistance() * 10.0f) / 10.0f;
    telemDoc["sweepAngle"] = round(scannerGetCurrentAngle() * 100.0f) / 100.0f;

    // Advanced Sensor Diagnostics
    SensorDiagnostics diag;
    scannerGetDiagnostics(diag);
    telemDoc["totalReadings"] = diag.totalReadings;
    telemDoc["rejectedReadings"] = diag.rejectedReadings;
    telemDoc["timeoutCount"] = diag.timeoutCount;
    telemDoc["scanCycleMs"] = diag.scanCycleDurationMs;
    telemDoc["variance"] = round(diag.latestVariance * 10.0f) / 10.0f;
    telemDoc["tempC"] = round(diag.currentTempC * 10.0f) / 10.0f;
    telemDoc["calibOffset"] = round(diag.calibOffsetCm * 10.0f) / 10.0f;
    telemDoc["scanning"] = scannerIsScanning();

    telemDoc["scannerAuto"] = scannerIsScanning();
    telemDoc["aimingAngle"] = actuatorsGetAiming();
    telemDoc["steeringLeftAngle"] = actuatorsGetSteeringLeft();
    telemDoc["steeringRightAngle"] = actuatorsGetSteeringRight();
    telemDoc["speed"] = actuatorsGetSpeed();
    telemDoc["wifiRssi"] = WiFi.RSSI();
    telemDoc["freeHeap"] = ESP.getFreeHeap();

    // Access Point network telemetry
    telemDoc["apSsid"] = WIFI_AP_SSID;
    telemDoc["apIp"] = WiFi.softAPIP().toString();
    telemDoc["apClients"] = WiFi.softAPgetStationNum();
    telemDoc["wifiMode"] = (WiFi.getMode() == WIFI_AP_STA) ? "AP+STA" : "AP";
    telemDoc["staConnected"] = (WiFi.status() == WL_CONNECTED);

    String telemJson;
    serializeJson(telemDoc, telemJson);
    webSocket.broadcastTXT(telemJson);
  }
}

ObstacleMode webHandlerGetObstacleMode() {
  return currentObstacleMode;
}

TankState webHandlerGetTankState() {
  return currentTankState;
}
