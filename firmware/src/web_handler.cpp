/**
 * PanzerNavSystem - Web Server & WebSocket Transport Implementation
 */

#include "web_handler.h"
#include "motors.h"
#include "scanner.h"

static ESP8266WebServer server(HTTP_PORT);
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
  String html = F(
    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>PanzerNavSystem - Setup Required</title>"
    "<style>"
    "body{font-family:sans-serif;background:#0d1117;color:#f0f6fc;padding:2rem;line-height:1.6;max-width:680px;margin:auto}"
    "h1{color:#00e5ff;font-size:1.5rem}code{background:#161b22;padding:0.2rem 0.4rem;border-radius:4px;color:#7ee787}"
    ".card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem;margin-top:1.5rem}"
    "</style></head><body>"
    "<h1>PanzerNavSystem - LittleFS Assets Not Found</h1>"
    "<p>The ESP8266 web server is operational, but site assets have not been uploaded to LittleFS.</p>"
    "<div class='card'>"
    "<h3>Option 1: Upload site assets to ESP8266 LittleFS</h3>"
    "<p>Run the Windows script: <code>upload_site.bat</code></p>"
    "<h3>Option 2: Host on an Apache Web Server</h3>"
    "<p>Copy <code>site/dist/</code> to your Apache <code>htdocs</code> directory and point the control panel to this ESP's IP on WebSocket port 81.</p>"
    "</div></body></html>"
  );
  server.send(200, "text/html", html);
}

// -----------------------------------------------------------------------------
// HTTP: Serve LittleFS Static Files
// -----------------------------------------------------------------------------
static void handleLittleFsFile() {
  if (!littleFsMounted) {
    sendRescuePage();
    return;
  }

  String path = server.uri();
  if (path.endsWith("/")) {
    path += "index.html";
  }

  // Check for gzipped version first
  if (LittleFS.exists(path + ".gz")) {
    File file = LittleFS.open(path + ".gz", "r");
    server.sendHeader("Content-Encoding", "gzip");
    server.streamFile(file, getContentType(path));
    file.close();
    return;
  }

  // Check for plain file
  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    server.streamFile(file, getContentType(path));
    file.close();
    return;
  }

  // File not found in LittleFS
  if (path == "/index.html") {
    sendRescuePage();
  } else {
    server.send(404, "text/plain", "404 Not Found in LittleFS");
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
// WebSocket: Process Incoming JSON Command
// -----------------------------------------------------------------------------
static void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length) {
  // Reject oversized payloads (safety bounds check)
  if (length > 512) {
    return;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    return;
  }

  const char *type = doc["type"] | "";

  // 1. Drive command: {"type":"drive","dir":"forward"|"reverse"|"left"|"right"|"stop","speed":0..100}
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
      motorsStop();
      currentTankState = TankState::OBSTACLE_STOP;
    } else {
      motorsDrive(dir, speed);
      currentTankState = (dir == DriveDirection::STOP) ? TankState::IDLE : TankState::DRIVING;
    }

    lastCommandTime = millis();
    return;
  }

  // 2. Stop command: {"type":"stop"}
  if (strcmp(type, "stop") == 0) {
    motorsStop();
    currentTankState = TankState::IDLE;
    lastCommandTime = millis();
    return;
  }

  // 3. Mode command: {"type":"mode","obstacleMode":"auto"|"manual"}
  if (strcmp(type, "mode") == 0) {
    const char *modeStr = doc["obstacleMode"] | "auto";
    if (strcmp(modeStr, "manual") == 0) {
      currentObstacleMode = ObstacleMode::MANUAL;
    } else {
      currentObstacleMode = ObstacleMode::AUTO;
    }
    return;
  }

  // 4. Harmless simulation effect: {"type":"effect","action":"simulate_fire"}
  if (strcmp(type, "effect") == 0) {
    const char *action = doc["action"] | "";
    if (strcmp(action, "simulate_fire") == 0) {
      triggerSimulatedEffect();
    }
    return;
  }

  // 5. Ping message: {"type":"ping","t":123456}
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
      // Client disconnected -> halt tank for safety
      motorsStop();
      currentTankState = TankState::IDLE;
      break;

    case WStype_CONNECTED:
      // Client connected -> reset watchdog timer
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
  // Initialize simulation effect pin
  pinMode(PIN_SIMULATED_EFFECT, OUTPUT);
  digitalWrite(PIN_SIMULATED_EFFECT, LOW);

  // Initialize LittleFS
  littleFsMounted = LittleFS.begin();

  // Setup HTTP routes
  server.onNotFound(handleLittleFsFile);
  server.begin();

  // Setup WebSocket server
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

  // 1. Harmless simulation effect non-blocking timer
  if (effectActive && (now - effectStartTime >= EFFECT_DURATION_MS)) {
    digitalWrite(PIN_SIMULATED_EFFECT, LOW);
    effectActive = false;
  }

  // 2. Safety Watchdog: Halt motors if command timeout expires
  if (motorsIsDriving() && (now - lastCommandTime >= COMMAND_TIMEOUT_MS)) {
    motorsStop();
    currentTankState = TankState::IDLE;
  }

  // 3. Autonomous Obstacle Interlock
  if (currentObstacleMode == ObstacleMode::AUTO && scannerIsObstacleAhead()) {
    if (motorsGetDirection() == DriveDirection::FORWARD) {
      motorsStop();
      currentTankState = TankState::OBSTACLE_STOP;
    }
  }

  // 4. Broadcast new radar scan sample if available
  if (scannerHasNewSample()) {
    int angle;
    float distCm;
    bool valid;
    scannerGetLastSample(angle, distCm, valid);

    JsonDocument scanDoc;
    scanDoc["type"] = "scan";
    scanDoc["v"] = 1;
    scanDoc["angle"] = angle;
    scanDoc["distCm"] = valid ? round(distCm * 10.0f) / 10.0f : -1.0f;
    scanDoc["valid"] = valid;

    String scanJson;
    serializeJson(scanDoc, scanJson);
    webSocket.broadcastTXT(scanJson);
  }

  // 5. Broadcast periodic telemetry
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    JsonDocument telemDoc;
    telemDoc["type"] = "telemetry";
    telemDoc["v"] = 1;
    telemDoc["uptime"] = now / 1000;

    const char *stateStr = "idle";
    if (currentTankState == TankState::DRIVING) stateStr = "driving";
    else if (currentTankState == TankState::OBSTACLE_STOP) stateStr = "obstacle_stop";
    else if (currentTankState == TankState::FAULT) stateStr = "fault";
    telemDoc["state"] = stateStr;

    telemDoc["obstacleMode"] = (currentObstacleMode == ObstacleMode::AUTO) ? "auto" : "manual";
    telemDoc["obstacle"] = scannerIsObstacleAhead();
    telemDoc["distCm"] = round(scannerGetLatestDistance() * 10.0f) / 10.0f;
    telemDoc["sweepAngle"] = scannerGetCurrentAngle();
    telemDoc["speed"] = motorsGetSpeed();
    telemDoc["wifiRssi"] = WiFi.RSSI();
    telemDoc["freeHeap"] = ESP.getFreeHeap();

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
