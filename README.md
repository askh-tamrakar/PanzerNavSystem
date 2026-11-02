# PanzerNavSystem

> A complete, robust, mobile-friendly Wi-Fi control system and ultrasonic sweep visualization for **ESP32** and **ESP-12E (ESP8266)** tank models. Operates by default in **ESP-hosted Wi-Fi Access-Point mode** serving a responsive web control panel to any smartphone browser, controlling an 8-actuator inventory (4 propulsion + 2 steering + 1 aiming + 1 scanner) and autonomous safety watchdogs.
>
> 📖 **Wiring & Setup**: See [GUIDE.md](file:///e:/WebSite/PanzerNavSystem/GUIDE.md) for the complete pin-by-pin wire connection manual and power distribution guide for ESP32 and ESP-12E.

---

## Desired User Experience

1. **Power on the tank.** The ESP-12E boots, initializes all 8 actuator channels to safe neutral/stop states, and starts an autonomous Wi-Fi Access Point with SSID `PanzerTank-AP` on IP `192.168.4.1`.
2. **Connect phone to tank Wi-Fi.** Open phone Wi-Fi Settings, select `PanzerTank-AP`, and enter the private WPA2 passphrase (default: `panzer123456`).
3. **Keep Wi-Fi connection.** When Android or iPhone detects that the tank network has no outside internet connection, tap **"Keep Wi-Fi Connection"** / **"Stay Connected"**.
4. **Open the local browser URL.** Open Chrome or Safari and navigate to:
   ```text
   http://192.168.4.1/
   ```
5. **ESP serves the control site from LittleFS.** The ESP-12E serves the compiled Vite web application directly from flash memory.
6. **Command and monitor the tank.** The operator commands propulsion, dual steering servos, turret aiming servo, and ultrasonic sweep angle while viewing live telemetry, Wi-Fi health, and polar radar-style sonar reflection samples.
7. **Failsafe safety halt.** If the phone disconnects, signal drops, or commands cease for more than 1200ms, the firmware safety watchdog immediately halts all propulsion. The autonomous obstacle braking interlock halts forward travel if obstacles are detected ahead even when no browser is connected.

> [!NOTE]
> **Zero Infrastructure Requirement**: No internet connection, home router, cloud service, or installed app store application is required.

---

## Table of Contents

1. [ESP-Hosted Wi-Fi Access Point Mode (Default & Primary)](#1-esp-hosted-wi-fi-access-point-mode-default--primary)
   - [Default Configuration & Credentials](#default-configuration--credentials)
   - [Customizing SSID, Password, and Local IP](#customizing-ssid-password-and-local-ip)
   - [Phone Connection Guide (Android & iPhone)](#phone-connection-guide-android--iphone)
   - [Captive-Portal Assistant & Technical Limitations](#captive-portal-assistant--technical-limitations)
   - [Security & Operating Assumptions](#security--operating-assumptions)
2. [Actuator Inventory & Hardware Profile Matrix (8 Actuators)](#2-actuator-inventory--hardware-profile-matrix-8-actuators)
   - [Critical Hardware Check: L298N vs Servos](#critical-hardware-check-l298n-vs-servos)
   - [Profile A: 4 Brushed DC Motors (2x L298N)](#profile-a-4-brushed-dc-motors-2x-l298n)
   - [Profile B: 4 Propulsion Servos (All-Servo Architecture)](#profile-b-4-propulsion-servos-all-servo-architecture)
   - [Unconfirmed Profile Safety Lockout (Default)](#unconfirmed-profile-safety-lockout-default)
3. [System Architecture & Signal Flow](#3-system-architecture--signal-flow)
4. [Power Distribution & Electrical Wiring Architecture](#4-power-distribution--electrical-wiring-architecture)
   - [Power Bus Architecture Diagram](#power-bus-architecture-diagram)
   - [Common Ground & High-Current Isolation](#common-ground--high-current-isolation)
   - [Electrical Sizing Checklist](#electrical-sizing-checklist)
5. [Pin Mapping & Hardware Constraints](#5-pin-mapping--hardware-constraints)
   - [ESP-12E Pin Limitation & PCA9685 I2C Solution](#esp-12e-pin-limitation--pca9685-i2c-solution)
   - [Pin Assignment Table](#pin-assignment-table)
   - [RCWL-1604 3.3V Logic Level Shifting](#rcwl-1604-33v-logic-level-shifting)
6. [Software Prerequisites](#6-software-prerequisites)
7. [Repository Structure](#7-repository-structure)
8. [Build & Upload Workflows (Windows `.bat` Scripts)](#8-build--upload-workflows-windows-bat-scripts)
   - [Complete 6-Step Workflow](#complete-6-step-workflow)
   - [Script Reference & Optional COM Port Arguments](#script-reference--optional-com-port-arguments)
9. [Dual Hosting Options: ESP-Hosted AP Mode vs Optional Apache Hosting](#9-dual-hosting-options-esp-hosted-ap-mode-vs-optional-apache-hosting)
   - [ESP-Hosted LittleFS Mode (Recommended Default)](#esp-hosted-littlefs-mode-recommended-default)
   - [Optional Apache Web Server Hosting (Developer Mode)](#optional-apache-web-server-hosting-developer-mode)
   - [Network Reachability Constraints](#network-reachability-constraints)
10. [Browser-to-ESP Communication Protocol (v2)](#10-browser-to-esp-communication-protocol-v2)
    - [Client to ESP Messages](#client-to-esp-messages)
    - [ESP to Client Telemetry & Scan Messages](#esp-to-client-telemetry--scan-messages)
11. [Radar Scan Behavior & Technical Limitations](#11-radar-scan-behavior--technical-limitations)
12. [Safety Interlocks & Harmless Simulation Policy](#12-safety-interlocks--harmless-simulation-policy)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [Hardware Configuration Reference](#14-hardware-configuration-reference)

---

## 1. ESP-Hosted Wi-Fi Access Point Mode (Default & Primary)

The ESP-12E operates as an autonomous, self-hosted Wi-Fi Access Point (SoftAP). The ESP-12E manages its own DHCP server, DNS assistant, static HTTP web server, and WebSocket transport on private local IP `192.168.4.1`.

### Default Configuration & Credentials

| Setting | Default Value | Notes |
| :--- | :--- | :--- |
| **Network Mode** | `WIFI_AP` (Autonomous SoftAP) | Standalone local network broadcast by ESP-12E |
| **SSID (Network Name)**| `"PanzerTank-AP"` | Visible in phone Wi-Fi scans |
| **WPA2 Passphrase** | `"panzer123456"` | Private password (minimum 8 characters) |
| **Default IP Address** | `192.168.4.1` | Static local gateway & web address |
| **Subnet Mask** | `255.255.255.0` | Class C private local subnet |
| **Wi-Fi Channel** | `6` (2.4 GHz) | Configurable channels 1–13 |
| **Max Connected Clients** | `4` | Accommodates operator phone and monitor tablet |
| **HTTP Web Server Port** | `80` | Serves LittleFS production site & REST endpoints |
| **WebSocket Port** | `81` | Real-time bidirectional JSON telemetry & command link |

### Customizing SSID, Password, and Local IP

Do not commit personal credentials or private network changes to git. Use the documented local override mechanism:

1. Copy the template:
   ```cmd
   copy firmware\include\config.local.h.example firmware\include\config.local.h
   ```
2. Edit `firmware/include/config.local.h` to customize values:
   ```c
   // Customize your tank's private Access Point credentials
   #define WIFI_AP_SSID        "MyPanzer-Tank"
   #define WIFI_AP_PASS        "SecureTankPass99"  // Minimum 8 characters!
   #define WIFI_AP_CHANNEL     1                   // Optional channel selection (1-13)

   // Optional custom local IP (default is 192.168.4.1)
   #define WIFI_AP_IP_OCT1     192
   #define WIFI_AP_IP_OCT2     168
   #define WIFI_AP_IP_OCT3     4
   #define WIFI_AP_IP_OCT4     1
   ```
3. Re-compile and flash the firmware using `upload_firmware.bat`.

> [!CAUTION]
> **DO NOT USE AN OPEN (UNPROTECTED) WI-FI NETWORK.**
> Anyone within 2.4 GHz radio range can connect to an open network and send actuator commands to your tank model. Always set a strong, private WPA2 passphrase.

---

### Phone Connection Guide (Android & iPhone)

#### Method 1: Standard Auto-DHCP Connection

1. On your phone, toggle **Wi-Fi OFF and ON** to trigger an immediate fresh 2.4 GHz channel scan.
2. Select **PanzerTank-AP** and enter the WPA2 password: `panzer123456`.
3. When your phone warns *"Wi-Fi has no internet access. Stay connected?"*:
   - **Android**: Tap the notification and choose **"Yes" / "Stay Connected" / "Keep Wi-Fi Connection"**. Check *"Don't ask again"*.
   - **iPhone (iOS)**: If a Captive Assistant window pops up, tap **"Cancel"**, then choose **"Use Without Internet"**.
4. Open your phone browser (Chrome or Safari) and go to:
   ```text
   http://192.168.4.1/
   ```

---

#### Method 2: Manual / Static IP Option ("IP Option of Mobile")

If your phone gets stuck on *"Obtaining IP address..."*, says *"IP configuration failure"*, or disconnects automatically because there is no internet, configure a **Static IP** in your phone's Wi-Fi settings to bypass DHCP:

##### Android Static IP Instructions
1. Open **Settings &rarr; Network & internet &rarr; Wi-Fi**.
2. Tap the **gear icon** (or long-press) on **PanzerTank-AP**.
3. Tap **Advanced options** (or the pencil/edit icon).
4. Tap **IP settings** (which defaults to *DHCP*) and change it to **Static**.
5. Enter the following exact values:
   - **IP address**: `192.168.4.2` (or any number between `192.168.4.2` and `192.168.4.200`)
   - **Gateway**: `192.168.4.1`
   - **Network prefix length**: `24` *(Note: 24 corresponds to subnet mask 255.255.255.0)*
   - **DNS 1**: `192.168.4.1`
   - **DNS 2**: `8.8.8.8` (or leave blank)
6. Tap **Save**. Your phone will connect instantly without waiting for DHCP negotiation.
7. Open **Chrome** and navigate to `http://192.168.4.1/`.

##### iPhone (iOS) Static IP Instructions
1. Open **Settings &rarr; Wi-Fi**.
2. Tap the blue **ⓘ** (info) circle icon next to **PanzerTank-AP**.
3. Scroll down and tap **Configure IP** (defaults to *Automatic*).
4. Select **Manual**, then enter:
   - **IP Address**: `192.168.4.2`
   - **Subnet Mask**: `255.255.255.0`
   - **Router**: `192.168.4.1`
5. Tap **Configure DNS** &rarr; select **Manual** &rarr; tap **Add Server** &rarr; enter `192.168.4.1`.
6. Tap **Save** in the top right corner.
7. Open **Safari** and navigate to `http://192.168.4.1/`.

---

#### Troubleshooting: Solving Mobile Connection Failures (In-Depth)

If your mobile phone sees `PanzerTank-AP` but reports *"Failed to connect"*, *"Connection failure"*, gets stuck on *"Obtaining IP"*, or disconnects after 1-2 seconds, resolve it using this 5-point checklist:

1. **Clear Corrupted Cached Network Profile ("Forget Network")**:
   - If your phone previously attempted to connect with *Security: None* or an incorrect security mode, Android/iOS caches the bad association profile.
   - Go to your phone Wi-Fi settings &rarr; tap `PanzerTank-AP` (or the gear icon) &rarr; tap **Forget Network**.
   - Reconnect: select **WPA/WPA2-Personal** security and type the password: `panzer123456`.

2. **Disable Android "Private DNS" (Critical for Local APs)**:
   - Android 9+ has *Private DNS* enabled by default. Because the ESP-12E is offline, Android tries and fails to reach the Private DNS TLS server (port 853), flags the network as *"Private DNS server cannot be accessed"*, and drops the connection.
   - Go to **Settings &rarr; Network & internet &rarr; Private DNS** and set it to **Off** while using the tank.

3. **Turn OFF Mobile Data (Cellular)**:
   - Modern smartphones automatically drop or ignore Wi-Fi connections that do not provide external internet unless mobile data is off or the network is explicitly approved.
   - Pull down your quick settings shade and toggle **Mobile Data OFF**.

4. **Change MAC Randomization to Device MAC**:
   - Modern phones randomize their MAC address per network. On local microcontrollers, this can cause DHCP lease loops.
   - Under Wi-Fi details for `PanzerTank-AP` &rarr; **Advanced** &rarr; change **MAC address type** from *Randomized MAC* to **Device MAC / Phone MAC**.

5. **Use Static IP (Option B):**:
   - If DHCP takes longer than 3 seconds, set **IP settings** to **Static**:
     - **IP address**: `192.168.4.50` *(Using .50 avoids any DHCP range conflicts)*
     - **Gateway**: `192.168.4.1`
     - **Network prefix length**: `24` *(Enter 24, NOT 255.255.255.0!)*
     - **DNS 1**: `192.168.4.1`
     - **DNS 2**: leave blank

6. **ESP8266 Power Supply Stability (Brownout Prevention)**:
   - During Wi-Fi association with a phone, the ESP8266 radio transmits high-throughput frames drawing up to 350mA. If powered by an under-voltage USB cable or weak 3.3V rail, the ESP resets instantly.
   - The firmware sets transmission power to **19.0 dBm** (80 mW), ensuring maximum signal range without brownout current spikes. Ensure your ESP board receives a solid 5V/3.3V power supply.

---

### Captive-Portal Assistant & Technical Limitations

The firmware integrates a lightweight `DNSServer` on port 53 and HTTP redirect handlers on port 80 for common captive portal probe URLs:
- `/generate_204` & `/gen_204` (Android / Google Chrome)
- `/hotspot-detect.html` (Apple iOS / macOS)
- `/canonical.html` & `/success.txt`
- `/ncsi.txt` & `/connecttest.txt` (Windows)

#### Captive Browser Limitations

When a phone's operating system detects a captive portal, it spawns a restricted system web view (such as Apple's *Captive Network Assistant* / CNA sheet).
- **WebSocket Restrictions**: Captive sheets frequently disable RFC6455 WebSockets or throttle persistent background connections.
- **State Erasure**: Captive sheets run in temporary sandbox environments that discard `localStorage` preferences (such as light/dark theme and hardware profile selection) when dismissed.
- **Auto-Dismissal**: When the user taps "Done", the sheet is destroyed, killing the active control session.

> [!IMPORTANT]
> **The Documented Reliable Path**:
> 1. Connect to `PanzerTank-AP`.
> 2. Select **Keep Wi-Fi Connection / Use Without Internet**.
> 3. Open **`http://192.168.4.1/` directly in standard Safari or Chrome**.
> Normal tank operation does **not** require internet connectivity or external DNS checks.

---

### Security & Operating Assumptions

- **Proximity**: The direct local 2.4 GHz Wi-Fi control link is engineered for nearby line-of-sight operation (typically 10–30 meters depending on antenna placement and obstacles).
- **Continuous Connection**: The phone must remain connected to `PanzerTank-AP` throughout vehicle operation.
- **Watchdog Failsafe**: If the phone drops out of range or locks its screen, the ESP-12E firmware command watchdog halts propulsion within **1200ms** (`COMMAND_TIMEOUT_MS`).

---

## 2. Actuator Inventory & Hardware Profile Matrix (8 Actuators)

The physical system incorporates **eight (8) actuators**, two (2) L298N driver boards, and one (1) RCWL-1604 ultrasonic sensor:

| Actuator Group | Count | Physical Function | Description |
| :--- | :--- | :--- | :--- |
| **Propulsion Actuators** | 4 | Forward / Reverse Track Drive | Profile A: 4 Brushed DC Motors; Profile B: 4 Servos |
| **Steering Servos** | 2 | Left & Right Steering | Articulates wheel/track steering geometry |
| **Aiming Servo** | 1 | Turret / Payload Pan | Traverses simulated turret / payload left and right |
| **Scanner Servo** | 1 | Sonar Sweep | Sweeps RCWL-1604 ultrasonic sensor in an arc |
| **Driver Boards** | 2 | Power Amplification | L298N Dual H-Bridge Modules (Profile A only) |
| **Rangefinder** | 1 | Distance Measurement | RCWL-1604 Ultrasonic Sensor |

---

### Critical Hardware Check: L298N vs Servos

> [!CAUTION]
> **THE L298N MOTOR DRIVER IS EXCLUSIVELY FOR BRUSHED DC MOTORS.**
> The L298N is a high-voltage, high-current dual full-bridge driver designed to drive inductive loads such as brushed DC motors, relays, and solenoids. **It CANNOT drive servos.**
> Servos require a constant DC supply voltage and a logic-level 50 Hz Pulse Width Modulation (PWM) signal (typically 1.0 ms to 2.0 ms pulse width). Supplying H-bridge motor outputs into a servo will destroy the servo logic board immediately.

To account for ambiguous physical hardware configurations, the repository provides two explicit, selectable profiles:

### Profile A: 4 Brushed DC Motors (2x L298N)
- **Propulsion**: Four (4) brushed DC gear motors.
- **Drivers**: Two (2) L298N dual H-bridge boards.
  - L298N Board #1: Controls the two Left motors (Left Front, Left Rear).
  - L298N Board #2: Controls the two Right motors (Right Front, Right Rear).
- **Signal Configuration**:
  - *Paired Signal Mode (Default)*: Left motor inputs share direction/PWM signals in parallel across L298N #1; Right motor inputs share direction/PWM signals in parallel across L298N #2.
- **Servos**: The 2 steering servos, 1 aiming servo, and 1 scanner servo remain four separate servo outputs powered by a dedicated regulated 5V–6V servo bus.
- **Documentation Rule**: The four DC motors are never described or wired as servos.

### Profile B: 4 Propulsion Servos (All-Servo Architecture)
- **Propulsion**: Four (4) servos (e.g., continuous-rotation servos for drive wheels, or positional servos for walking/steered legs).
- **L298N Boards**: **Marked UNUSED.** The two L298N boards are disconnected or kept unpopulated for this profile.
- **Servo Controller**: An 8-channel servo driver (such as the PCA9685 16-channel I2C module) drives all 8 servos:
  - Channels 0–1: Two Steering Servos
  - Channel 2: One Aiming Servo
  - Channel 3: One Scanner Servo
  - Channels 4–7: Four Propulsion Servos
- **Servo Types**:
  - *Continuous-Rotation Servos*: Configured with neutral pulse width (default 1500 µs), forward range (1500–2000 µs), and reverse range (1000–1500 µs).
  - *Positional Servos*: Configured with bounded angular limits (0°–180°).

### Unconfirmed Profile Safety Lockout (Default)
When freshly flashed or when `#define ACTIVE_HARDWARE_PROFILE PROFILE_UNCONFIRMED` is set:
- The firmware refuses to energize propulsion actuators upon boot.
- The web control panel prominently displays **"PROFILE: UNCONFIRMED"** and overlays a lockout banner on the propulsion D-pad.
- The operator must explicitly select Profile A or Profile B via the web interface or in `firmware/include/config.local.h` before propulsion is unlocked.
- Steering, aiming, and scanning servos remain operational for mechanical verification once power is confirmed.

---

## 3. System Architecture & Signal Flow

```text
+-----------------------------------------------------------------------------------+
|                            OPERATOR CLIENT (PHONE / PC)                           |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Modern Web Browser (Vite + TypeScript Single Page App)                       |  |
|  | - Direct AP Mode Indicator: PanzerTank-AP (192.168.4.1)                     |  |
|  | - Hardware Profile Selector (Unconfirmed / Profile A / Profile B)          |  |
|  | - Propulsion Controls (4 Channels: Forward / Reverse / Turn / Speed)        |  |
|  | - Dual Steering Controls (2 Servos: Left Angle & Right Angle Sliders)       |  |
|  | - Aiming Pan Controls (1 Servo: Left / Right Traverse Angle)                 |  |
|  | - Ultrasonic Polar Sweep Display (1 Servo + RCWL-1604 Rangefinder)         |  |
|  | - Reconnect Troubleshooting Box with Retry button                            |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                       WebSocket (RFC6455) Port 81
                       HTTP Port 80 (LittleFS / Captive Helper)
                                         |
+----------------------------------------v------------------------------------------+
|                              ESP-12E / NODEMCU (ESP8266)                          |
|                                                                                   |
|  [Wi-Fi SoftAP: 192.168.4.1] | [DNS Port 53 Helper]                               |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  | ESP8266WebServer (80)  |  | WebSocketsServer (81)    |  | Safety Watchdog  |  |
|  | LittleFS static assets  |  | JSON Protocol v2 parser  |  | 1200ms timeout   |  |
|  | Captive redirect helper |  | Bounds & type validation |  | Disconnect halt  |  |
|  | REST /api/status        |  | AP telemetry broadcast   |  | Obstacle stop    |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
|                                         |                                         |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  | Actuators Subsystem     |  | Scanner Subsystem        |  | Obstacle Brake   |  |
|  | Profile A vs Profile B  |  | Non-blocking sweep state |  | Autonomous halt  |  |
|  | 8 Actuator Dispatcher   |  | RCWL-1604 sonar reader   |  | Forward lockout  |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
+--------------+--------------------------+---------------------------+-------------+
               |                          |                           |
         GPIO 16 / GPIO 2           I2C SDA / SCL (GPIO 4 / 5)   GPIO 0 (LED Pulse)
               |                          |                           |
+--------------v-------------+ +----------v-------------------------+ +-------------+
| RCWL-1604 Ultrasonic Sensor| | PCA9685 16-Ch I2C Servo Controller  | | Simulated   |
| Trig: GPIO16               | | (or Direct GPIO fallback)          | | Effect LED  |
| Echo: GPIO2 (*via divider) | +------------------------------------+ +-------------+
+----------------------------+   |          |          |          |
                                 |          |          |          |
                  +--------------+          |          |          +--------------+
                  |                         |          |                         |
+-----------------v----+ +------------------v----+ +---v--------------+ +--------v------+
| 2x Steering Servos   | | 1x Aiming Servo       | | 1x Scanner Servo | | 4x Propulsion |
| Ch 0: Left Steering  | | Ch 2: Turret Pan      | | Ch 3: Sonar Horn | | (Profile A/B) |
| Ch 1: Right Steering | +-----------------------+ +------------------+ +---------------+
+----------------------+
```

---

## 4. Power Distribution & Electrical Wiring Architecture

### Power Bus Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                                  MAIN BATTERY PACK                                |
|             (Voltage & chemistry chosen to match motor/servo requirements)         |
+-----------------------------------------+-----------------------------------------+
                                          |
                                    [ MAIN FUSE ]
                            (Sized for total continuous load)
                                          |
                                   [ MAIN SWITCH ]
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
        | MOTOR POWER BRANCH              | SERVO POWER BRANCH              | ESP LOGIC BRANCH
        | (High Current)                  | (Regulated 5V-6V High Current)  | (Regulated 3.3V / 5V)
        |                                 |                                 |
+-------v-----------------------+ +-------v-----------------------+ +-------v------------------+
| Profile A: 2x L298N Boards    | | Step-Down Switching Regulator | | Step-Down Regulator /    |
| Connects to L298N +12V pins   | | (UBEC / Buck: Sized for       | | NodeMCU Onboard Reg      |
| Powers 4x Brushed DC Motors   | | 4 servos Profile A /          | | Delivers clean 3.3V/5V   |
| (Profile B: Branch Unused)    | | 8 servos Profile B)           | | to ESP-12E               |
+---------------+---------------+ +---------------+---------------+ +---------+----------------+
                |                                 |                           |
                |                                 +------------+              |
                |                                 |            |              |
                |                        +--------v-------+ +--v--------------v----------------+
                |                        | PCA9685 Servo  | | ESP8266 Controller & Sensor      |
                |                        | V+ Power Rail  | | VCC / 3V3 Rail                   |
                |                        +--------+-------+ +-----------------+----------------+
                |                                 |                           |
+---------------v---------------------------------v---------------------------v----------------+
|                                    COMMON GROUND BUS (GND)                                   |
|   Connects Battery (-), L298N GND, Regulator GNDs, PCA9685 GND, Servo GNDs, and ESP GND     |
+----------------------------------------------------------------------------------------------+
```

### Common Ground & High-Current Isolation

1. **Common Ground Reference**: All modules (Battery Negative, L298N driver grounds, Servo BEC regulator ground, ESP8266 ground, and PCA9685 ground) **must be tied together**. Without a common ground reference, logic signals float and trigger erratic motor behavior.
2. **High-Current Path Separation**:
   - High current drawn by the four propulsion motors (up to several amperes) and the servos must flow directly through heavy-gauge wiring back to the battery negative terminal.
   - **Never route motor or servo power or ground through ESP-12E board header pins or PCB traces.** Doing so causes ground-bounce resets and burns board traces.

### Electrical Sizing Checklist

- [ ] **Motor Stall Current**: Measure the stall current of your 4 propulsion DC motors at nominal voltage. (Four small yellow TT gear motors draw ~0.8A stall each = ~3.2A total; larger 540-size motors can exceed 15A stall each).
- [ ] **Servo Peak Current**: Micro servos (SG90 / MG90S) draw ~0.5A to 0.8A stall each. Standard servos (MG996R) draw up to 2.5A stall each. Sizing must account for all active servos.
- [ ] **L298N Voltage Drop**: The L298N uses bipolar junction transistors that drop approximately 1.8V to 2.2V internally as heat. To deliver 6V to DC motors, the battery branch must provide at least 7.8V–8.4V (e.g., a 2S LiPo 7.4V nominal / 8.4V fully charged).
- [ ] **Wire Gauge**: Use minimum 18 AWG or 16 AWG stranded silicone wire for the main battery and L298N power branches.

---

## 5. Pin Mapping & Hardware Constraints

### ESP-12E Pin Limitation & PCA9685 I2C Solution

The ESP-12E exposes limited usable GPIOs after accounting for internal flash and boot-strapping pins:
- **GPIO0, GPIO2, GPIO15**: Dedicated boot-mode pins (must be pulled to specific logic levels at startup).
- **GPIO1, GPIO3**: UART0 Serial diagnostics (115200 baud).
- **GPIO6–GPIO11**: Connected internally to SPI flash (cannot be used for I/O).
- **Remaining General GPIOs**: GPIO4, GPIO5, GPIO12, GPIO13, GPIO14, GPIO16.

Controlling **eight independent actuator channels** directly via ESP-12E GPIOs is electrically impossible without pin expansion.

#### The Recommended Architecture: PCA9685 I2C PWM Controller
Connecting a PCA9685 16-channel 12-bit PWM board over I2C requires only two ESP pins:
- `GPIO4` -> I2C `SDA`
- `GPIO5` -> I2C `SCL`

All 8 servos (or 4 servos + 2x L298N motor inputs) plug directly into the PCA9685 header pins, completely solving the ESP-12E pin constraint.

### Pin Assignment Table

| Function | Logical Signal | ESP8266 GPIO | NodeMCU Pin | Boot Constraint / Electrical Notes |
| :--- | :--- | :--- | :--- | :--- |
| **I2C Bus SDA** | `I2C_SDA` | `GPIO4` | `D2` | Connects to PCA9685 SDA. Safe at boot. |
| **I2C Bus SCL** | `I2C_SCL` | `GPIO5` | `D1` | Connects to PCA9685 SCL. Safe at boot. |
| **Left Motors IN1** | `MOTOR_L_IN1` | `GPIO4` / PCA Ch 4 | `D2` | Forward left track (shared across L298N #1 in Direct Mode). |
| **Left Motors IN2** | `MOTOR_L_IN2` | `GPIO5` / PCA Ch 5 | `D1` | Reverse left track (shared across L298N #1 in Direct Mode). |
| **Right Motors IN3**| `MOTOR_R_IN3` | `GPIO12` / PCA Ch 6 | `D6` | Forward right track (shared across L298N #2 in Direct Mode). |
| **Right Motors IN4**| `MOTOR_R_IN4` | `GPIO13` / PCA Ch 7 | `D7` | Reverse right track (shared across L298N #2 in Direct Mode). |
| **Scanner Servo** | `SERVO_SCAN` | `GPIO14` / PCA Ch 3 | `D5` | Hardware PWM signal to ultrasonic scanning servo. |
| **Aiming Servo** | `SERVO_AIM` | `GPIO15` / PCA Ch 2 | `D8` | Hardware PWM to turret/aiming servo. (*Requires boot pull-down!*) |
| **Steering Servos** | `SERVO_STEER_L/R` | PCA Ch 0, Ch 1 | Ext | Driven via PCA9685 channels 0 & 1. |
| **Sonar Trigger** | `SONAR_TRIG` | `GPIO16` | `D0` | 10 µs trigger pulse to RCWL-1604 Trig pin. |
| **Sonar Echo** | `SONAR_ECHO` | `GPIO2` | `D4` | Echo pulse from RCWL-1604. **3.3V safe voltage divider required!** |
| **Simulated Effect**| `SIM_EFFECT` | `GPIO0` | `D3` | Pulled HIGH at boot. 150ms output pulse for LED / buzzer. |
| **Serial TXD** | `UART0_TX` | `GPIO1` | `TX` | 115200 baud serial diagnostics. |
| **Serial RXD** | `UART0_RX` | `GPIO3` | `RX` | Serial receive. |

### RCWL-1604 3.3V Logic Level Shifting

> [!IMPORTANT]
> The ESP8266 GPIO inputs operate strictly at 3.3V logic.
> When powered from a 5V rail, the RCWL-1604 Echo pin outputs a 5V logic pulse. Connecting this directly to `GPIO2` can degrade or destroy the ESP8266 input buffer.

Wire a simple two-resistor voltage divider on the Echo output:
```text
RCWL-1604 Echo Pin (5V Pulse)
          |
        [1 kΩ]
          |
          +------> To ESP8266 GPIO2 (D4) (Calculated: ~3.33V Safe Logic HIGH)
          |
        [2 kΩ]
          |
     Common Ground (GND)
```

---

## 6. Software Prerequisites

1. **Node.js** (v18.0.0 or later, LTS recommended):
   - [Download Node.js](https://nodejs.org/)
   - Verify in terminal: `node -v` and `npm -v`
2. **PlatformIO Core (CLI)** (v6.0.0 or later):
   - Install via Python pip:
     ```cmd
     python -m pip install platformio
     ```
   - Verify in terminal: `pio --version`
3. **Python 3.10+** (used by PlatformIO toolchains):
   - [Download Python](https://python.org/)

---

## 7. Repository Structure

```text
PanzerNavSystem/
├── README.md                      # Complete system documentation (AP mode, 8 actuators, dual profiles)
├── .gitignore                     # Git ignore rules for node_modules, .pio, and secrets
├── setup.bat                      # Prerequisite checks and automated dependency installer
├── build_site.bat                 # Compiles Vite frontend and embeds assets into site_assets.h
├── build_all.bat                  # Builds site, embeds assets, stages files, and compiles firmware
├── upload_all.bat                 # Recommended: Compiles and flashes BOTH site and firmware at once!
├── upload_firmware.bat            # Flashes combined ESP8266 binary over serial (forwards flags)
├── upload_site.bat                # Optional: Stages web assets and flashes LittleFS filesystem image
├── scripts/
│   └── embed_assets.js            # Embeds gzipped dist/ assets into C++ PROGMEM header
├── site/                          # Frontend web control panel
│   ├── package.json               # Vite and TypeScript dependencies
│   ├── package-lock.json          # Deterministic dependency lockfile
│   ├── vite.config.ts             # Vite configuration with relative base path ('./')
│   ├── tsconfig.json              # TypeScript strict configuration
│   ├── index.html                 # Accessible single-page app with 8 actuator controls
│   ├── public/
│   │   └── favicon.svg            # Tactical vector icon (tank + scanning radar motif)
│   └── src/
│       ├── main.ts                # Application coordinator, AP status, and DOM binding
│       ├── types.ts               # Protocol v2 data models and interfaces
│       ├── protocol.ts            # JSON serialization, bounds checking, and validation
│       ├── controller.ts          # Touch/keyboard input tracker, safety stops, WebSocket client
│       ├── radar.ts               # Canvas-based semicircular ultrasonic polar renderer
│       ├── theme.ts               # Light/Dark tactical theme manager with persistence
│       └── style.css              # Custom responsive CSS design system
└── firmware/                      # ESP8266 Arduino firmware
    ├── platformio.ini             # PlatformIO environments (NodeMCU v2 / ESP-12E, LittleFS)
    ├── include/
    │   ├── config.h               # Core pinout, AP settings, calibration, and safety limits
    │   ├── config.local.h.example # Local credentials template (ignored by git)
    │   └── site_assets.h          # Auto-generated embedded web bundle in PROGMEM flash
    ├── src/
    │   ├── main.cpp               # Setup, Wi-Fi SoftAP initialization, and main loop
    │   ├── actuators.h / .cpp     # Unified 8-actuator manager (Profile A DC & Profile B Servos)
    │   ├── scanner.h / .cpp       # Non-blocking servo sweep and RCWL-1604 sonar handler
    │   └── web_handler.h / .cpp   # Web server (embedded PROGMEM + LittleFS), WebSocket (port 81)
    └── data/
        └── .gitkeep               # Staging directory for LittleFS filesystem image
```

---

## 8. Build & Upload Workflows (Windows `.bat` Scripts)

### Recommended: Combined Single-Flash Upload (`upload_all.bat`)

To build the website, embed it into the firmware binary, and flash **both at once** in a single upload operation:

```cmd
cd e:\WebSite\PanzerNavSystem

:: Option 1: Automatic COM port detection
upload_all.bat

:: Option 2: Specify your serial COM port
upload_all.bat --upload-port COM3
```

> [!TIP]
> **Why Combined Single-Flash Upload Solves Erasing Conflicts**:
> On ESP8266 boards, uploading a separate LittleFS filesystem partition to offset `0x200000` (2MB) on chips that physically have 1MB or 2MB of flash causes the write operation to wrap around in SPI flash hardware and overwrite the bootloader and firmware at `0x000000`. Conversely, uploading firmware to `0x000000` can overwrite filesystem areas if partition tables conflict.
>
> In **PanzerNavSystem**, the website is gzipped and compiled directly into the firmware binary as `PROGMEM` constants (`firmware/include/site_assets.h`). The combined image is only **~483 kB**, fitting comfortably inside the primary sketch area on **ANY** ESP8266 module.
> Flashing `upload_all.bat` writes both the C++ firmware and the entire web control panel in **ONE single flash session**. Neither can ever erase the other!

### Complete Step-by-Step Workflow

If you prefer executing each step individually:

```cmd
cd e:\WebSite\PanzerNavSystem

:: Step 1: Install dependencies & check environment
setup.bat

:: Step 2: Build the production website & embed assets
build_site.bat

:: Step 3: Build the unified firmware binary
build_all.bat

:: Step 4: Flash the combined firmware + site to the ESP-12E
upload_firmware.bat

:: Step 5: (Optional) Flash LittleFS filesystem partition
upload_site.bat

:: Step 6: Connect your phone to Wi-Fi "PanzerTank-AP" and browse to:
::         http://192.168.4.1/
```

### Script Reference & Optional COM Port Arguments

Each batch script validates execution status, stops immediately on failure, propagates non-zero exit codes, and properly quotes file paths.

#### `upload_all.bat` (Recommended)
- Compiles the Vite website.
- Embeds the gzipped assets into `firmware/include/site_assets.h`.
- Compiles the unified C++ firmware binary.
- Flashes the combined image to the ESP-12E in a single upload.
- Forwards optional arguments, e.g.: `upload_all.bat --upload-port COM3`.

#### `setup.bat`
- Checks for Node.js (`node`), npm (`npm.cmd`), and PlatformIO CLI (`pio`).
- Runs `npm ci` (or `npm install`) inside `site/`.
- Initializes `firmware/include/config.local.h` from example template if not present.
- Returns code `1` if any prerequisite is missing.

#### `build_site.bat`
- Compiles the TypeScript application and runs Vite production build.
- Invokes `scripts/embed_assets.js` to update `firmware/include/site_assets.h`.
- Ensures output is generated with relative asset paths in `site/dist/`.

#### `build_all.bat`
- Executes `build_site.bat` and asset embedding.
- Stages `site/dist/` into `firmware/data/` for LittleFS packaging (preserves `.gitkeep`).
- Invokes `pio run` inside `firmware/` to compile the unified C++ firmware binary.

#### `upload_firmware.bat`
- Ensures embedded assets exist and flashes the unified firmware binary to the connected ESP-12E.
- Supports passing an optional serial port argument:
  ```cmd
  upload_firmware.bat --upload-port COM3
  ```

#### `upload_site.bat`
- Re-builds the website and stages `site/dist/` to `firmware/data/`.
- Invokes `pio run --target uploadfs` to flash the LittleFS partition image to the ESP-12E.
- Supports passing an optional serial port argument:
  ```cmd
  upload_site.bat --upload-port COM3
  ```

---

## 9. Dual Hosting Options: ESP-Hosted AP Mode vs Optional Apache Hosting

### ESP-Hosted LittleFS Mode (Recommended Default)

This is the primary, autonomous operating mode for the tank.
1. Run `upload_site.bat` to flash the production site into LittleFS.
2. Power on the tank.
3. Connect your phone to `PanzerTank-AP`.
4. Open `http://192.168.4.1/` in Safari or Chrome.
5. The webpage connects automatically to the on-board WebSocket at `ws://192.168.4.1:81/`.
6. **No internet, external server, or local network router is needed.**

### Optional Apache Web Server Hosting (Developer Mode)

For frontend developers iterating on the web interface while the tank is on a shared bench:
1. Build the production site: `build_site.bat`.
2. Copy `site/dist/` to your Apache web root:
   ```cmd
   xcopy /e /y /i site\dist\* C:\xampp\htdocs\panzer\
   ```
3. Open `http://<your-pc-ip>/panzer/` in your browser.
4. Expand the **Device Connection Settings** panel at the bottom of the page and enter the ESP's IP address:
   ```text
   ws://192.168.1.150:81/
   ```

### Network Reachability Constraints

> [!IMPORTANT]
> **Apache hosting cannot reach an ESP operating in isolated SoftAP mode.**
> If your phone loads `http://192.168.1.10/panzer/` via your home router, the phone's browser cannot connect to `192.168.4.1` because the tank's SoftAP is a separate, unrouted radio network.
>
> To use Apache hosting:
> 1. Configure the ESP to join your home Wi-Fi in `firmware/include/config.local.h`:
>    ```c
>    #define WIFI_STA_SSID "YourHomeRouter"
>    #define WIFI_STA_PASS "YourHomePassword"
>    ```
> 2. Reflash firmware: `upload_firmware.bat`.
> 3. Check the Serial Monitor (115200 baud) for the assigned IP (e.g. `192.168.1.150`).
> 4. Ensure your phone, Apache PC, and ESP are all on the same subnet.

---

## 10. Browser-to-ESP Communication Protocol (v2)

All control and telemetry messages are exchanged in UTF-8 JSON over WebSocket port `81`. The maximum payload size is strictly bounded to 512 bytes.

### Client to ESP Messages

#### 1. Drive Command (Propulsion Actuators)
```json
{
  "type": "drive",
  "dir": "forward",
  "speed": 65
}
```
- `dir`: `"forward"` | `"reverse"` | `"left"` | `"right"` | `"stop"`
- `speed`: Integer between `0` and `100`

#### 2. Steering Command (2 Steering Servos)
```json
{
  "type": "steering",
  "leftAngle": 90,
  "rightAngle": 90
}
```
- `leftAngle`, `rightAngle`: Integer bounded between `45` and `135` (center 90).

#### 3. Aiming Command (1 Aiming Servo)
```json
{
  "type": "aiming",
  "angle": 90
}
```
- `angle`: Integer bounded between `30` and `150` (center 90).

#### 4. Scanner Config Command (1 Scanner Servo)
```json
{
  "type": "scanner_config",
  "minAngle": 30,
  "maxAngle": 150,
  "stepDeg": 5
}
```

#### 5. Profile Selection Command
```json
{
  "type": "set_profile",
  "profile": "profile_a_dc"
}
```
- `profile`: `"unconfirmed"` | `"profile_a_dc"` | `"profile_b_servo"`

#### 6. Stop Command
```json
{
  "type": "stop"
}
```

#### 7. Harmless Simulation Effect Command
```json
{
  "type": "effect",
  "action": "simulate_fire"
}
```

#### 8. Ping (Heartbeat) Command
```json
{
  "type": "ping",
  "t": 1714651234567
}
```

---

### ESP to Client Telemetry & Scan Messages

#### 1. Real-Time Telemetry Broadcast (Every 200ms)
```json
{
  "type": "telemetry",
  "v": 2,
  "profile": "profile_a_dc",
  "uptime": 42,
  "state": "idle",
  "obstacleMode": "auto",
  "obstacle": false,
  "distCm": 48.5,
  "sweepAngle": 85,
  "aimingAngle": 90,
  "steeringLeftAngle": 90,
  "steeringRightAngle": 90,
  "speed": 65,
  "wifiRssi": -52,
  "freeHeap": 41280,
  "apSsid": "PanzerTank-AP",
  "apIp": "192.168.4.1",
  "apClients": 1,
  "wifiMode": "AP",
  "staConnected": false
}
```

#### 2. Radar Scan Sample Broadcast (Per Servo Step)
```json
{
  "type": "scan",
  "v": 2,
  "angle": 95,
  "distCm": 34.2,
  "valid": true
}
```

---

## 11. Radar Scan Behavior & Technical Limitations

> [!NOTE]
> **WHAT THIS DISPLAY IS:**
> The radar display is an interactive polar visualization of raw ultrasonic time-of-flight samples indexed by the current angular position of the scanning servo.
>
> **WHAT THIS DISPLAY IS NOT:**
> - It is **NOT** electromagnetic radar (RF / microwave).
> - It is **NOT** computer vision, LiDAR, or object recognition.
> - It **CANNOT** classify objects, detect transparent/steeply angled surfaces, or form a photographic image.

### Sweep Characteristics & Divisible Stepping

- **Full 0° to 180° Sweep Range**: The servo sweeps across the complete 180° forward semicircle between `SCANNER_MIN_ANGLE` (0°) and `SCANNER_MAX_ANGLE` (180°).
- **Stepping Angles Divisible by 180°**:
  - The step size must always divide 180 evenly without remainder (`180 % step == 0`).
  - Supported step divisors: **5°** (36 steps), **6°** (30 steps), **10°** (18 steps), **15°** (12 steps), **20°** (9 steps), **30°** (6 steps), and **45°** (4 steps).
  - Divisible stepping ensures every angle lands precisely on the 0° and 180° endpoints every sweep cycle.
- **Two Operating Modes**:
  1. **⚡ Auto Sweep**: Continuously scans back and forth between 0° and 180° at the chosen divisible step size.
  2. **🖐 Manual Step**: Operator steps the radar one step at a time:
     - **[ ◀ Step Left ]** & **[ Step Right ▶ ]**: Steps by `±stepDeg` (e.g. `±10°`), immediately taking a reading at that step.
     - **Manual Angle Slider**: Snaps smoothly across 0° to 180° in increments of the chosen step divisor.
     - **Quick Snaps**: Direct angle buttons for `0° Left`, `45°`, `90° Center`, `135°`, and `180° Right`.
     - **[ 📡 Ping Sonar ]**: Triggers an on-demand ultrasonic measurement at the current servo position.
- **Settling Time**: After moving the servo, the firmware pauses 45ms (`SCANNER_SETTLE_MS`) before triggering the sonar to allow mechanical vibrations to damp out.
- **Missing Echoes**: If no reflection returns within 25,000 µs (~430 cm), the sample is marked invalid (`valid: false`) and rendered as a faint gray perimeter tick mark—**never as a false obstacle**.
- **Movement Skew (Doppler & Odometry)**:
  Ultrasonic range samples take ~1.5–2.0 seconds to sweep 180 degrees. If the tank is driving or turning while the sensor sweeps, the coordinate frame shifts during the scan. The UI automatically displays a **"Movement skew active"** warning while driving.

---

## 12. Safety Interlocks & Harmless Simulation Policy

### Firmware Safety Interlocks

1. **Power-On Safe State**: At boot, all motor output pins are forced `LOW` and PWM duty cycles are set to 0 before Wi-Fi or peripheral initialization begins. All servos are moved to neutral center positions.
2. **Unconfirmed Profile Failsafe**: If `ACTIVE_HARDWARE_PROFILE` is set to `PROFILE_UNCONFIRMED`, propulsion commands are rejected in firmware and UI.
3. **Command Watchdog**: If no valid drive command or heartbeat ping is received within **1200ms** (`COMMAND_TIMEOUT_MS`), the firmware immediately halts both track motors.
4. **Connection Loss Stop**: If the WebSocket connection closes or drops, the firmware instantly shuts down the motors.
5. **Autonomous Obstacle Braking**: In `AUTO` mode, if an obstacle is detected within 22 cm in the forward arc (70° to 110°), forward motion is forcefully halted in firmware. Reverse and pivot maneuvers remain enabled so the operator can back away.
6. **Client-Side Visibility Protection**: Releasing a touch button, navigating away from the tab, or locking the phone triggers an immediate `stop` transmission.

### Harmless-Only Simulation Policy

The "Simulated Effect" feature is strictly restricted to:
- Lighting an LED on `GPIO0` for 150ms.
- Sounding a brief 150ms tone on an active buzzer.
- **Under NO circumstances will this firmware or repository support launching projectiles, firing airsoft/BB payloads, spring mechanisms, or hazardous actuation.**

---

## 13. Troubleshooting Guide

### 1. Wi-Fi Access Point Issues

- **Problem: Tank Wi-Fi network (`PanzerTank-AP`) does not appear in phone Wi-Fi scans.**
  - *Fix 1*: Verify power supply. The ESP-12E requires a stable 3.3V supply capable of providing 300mA peak RF spikes. Brownouts reset the radio continuously.
  - *Fix 2*: Connect USB and open Serial Monitor at 115200 baud. Confirm that the boot banner outputs:
    `[WIFI] Access Point STARTED: "PanzerTank-AP"`.
- **Problem: Incorrect Wi-Fi password.**
  - *Fix*: The default passphrase is `panzer123456`. If customized in `config.local.h`, verify that the password has at least 8 characters.
- **Problem: Phone connects to `PanzerTank-AP` but immediately disconnects.**
  - *Fix*: The phone is rejecting the Wi-Fi network because it lacks an internet gateway. In phone Wi-Fi settings, tap the network details and select **"Keep Connection / Stay Connected"**. Disable "Smart Network Switch" or "Switch to Mobile Data".

### 2. Browser & Web Page Loading Issues

- **Problem: Browser says "Cannot reach site" or connection times out at `http://192.168.4.1/`.**
  - *Fix 1*: Confirm phone Wi-Fi has not automatically fallen back to 4G/5G mobile data. Temporarily toggle off **Mobile Data** in phone settings.
  - *Fix 2*: Explicitly type `http://` before `192.168.4.1`. Modern mobile browsers may otherwise treat the IP as a search term and fail.
  - *Fix 3*: Confirm static IP assignment. In phone Wi-Fi details, verify your phone was assigned an IP on the subnet (e.g., `192.168.4.2`).
- **Problem: Browser displays "PanzerNavSystem - Site Files Not In LittleFS" rescue page.**
  - *Fix*: The firmware is running, but the LittleFS partition has not been flashed. Flash the website assets by running:
    ```cmd
    upload_site.bat
    ```
- **Problem: Stale site files or old interface displayed.**
  - *Fix*: Mobile browsers aggressively cache HTML/JS. In your mobile browser, clear cache for `192.168.4.1` or open an Incognito/Private window. Then re-run `upload_site.bat`.

### 3. Actuator & PlatformIO Upload Issues

- **Problem: Propulsion does not respond to D-pad buttons.**
  - *Fix*: Check the hardware profile status. If the top banner shows **"PROFILE: UNCONFIRMED"**, propulsion is locked out for safety. Select **Profile A** (DC Motors) or **Profile B** (Servos) from the dropdown.
- **Problem: `upload_firmware.bat` or `upload_site.bat` fails with packet header timeout.**
  - *Fix 1*: Close any open Serial Monitor or terminal locking the serial COM port.
  - *Fix 2*: Pass the explicit COM port: `upload_firmware.bat --upload-port COM3`.
  - *Fix 3*: On bare ESP-12E development boards, hold `FLASH` (GPIO0 to GND), tap `RST`, then release `FLASH` to enter serial bootloader mode.

---

## 14. Hardware Configuration Reference

All settings can be customized in `firmware/include/config.local.h` without altering tracked source code:

| Setting Macro | Default Value | Description |
| :--- | :--- | :--- |
| `WIFI_AP_SSID` | `"PanzerTank-AP"` | Access Point network name |
| `WIFI_AP_PASS` | `"panzer123456"` | Access Point WPA2 passphrase (minimum 8 chars) |
| `WIFI_AP_CHANNEL` | `6` | 2.4 GHz channel (1..13) |
| `WIFI_AP_MAX_CONN` | `4` | Maximum simultaneous phone/tablet clients |
| `WIFI_AP_IP_OCT1..4` | `192, 168, 4, 1` | Access Point static IP address |
| `ENABLE_CAPTIVE_PORTAL_HELPER` | `1` | Port 53 DNS responder & HTTP 302 probe redirection |
| `ACTIVE_HARDWARE_PROFILE` | `PROFILE_UNCONFIRMED` | Profile selection (`PROFILE_A_DC_MOTORS` or `PROFILE_B_PROPULSION_SERVOS`) |
| `PROPULSION_SERVO_TYPE` | `CONTINUOUS` | Profile B servo mode (`CONTINUOUS` or `POSITIONAL`) |
| `SERVO_PULSE_NEUTRAL_US` | `1500` | Calibrated neutral stop pulse for continuous servos (µs) |
| `STEERING_MIN_ANGLE` | `45` | Steering servos minimum angle (degrees) |
| `STEERING_MAX_ANGLE` | `135` | Steering servos maximum angle (degrees) |
| `AIMING_MIN_ANGLE` | `30` | Aiming servo minimum angle (degrees) |
| `AIMING_MAX_ANGLE` | `150` | Aiming servo maximum angle (degrees) |
| `SCANNER_MIN_ANGLE` | `30` | Scanner servo sweep minimum angle (degrees) |
| `SCANNER_MAX_ANGLE` | `150` | Scanner servo sweep maximum angle (degrees) |
| `SCANNER_STEP_DEG` | `5` | Scanner servo step increment (degrees) |
| `SCANNER_SETTLE_MS` | `45` | Sonar mechanical settling delay (ms) |
| `OBSTACLE_THRESHOLD_CM` | `22.0f` | Autonomous obstacle braking distance (cm) |
| `COMMAND_TIMEOUT_MS` | `1200` | Failsafe motor shutdown timeout (ms) |
