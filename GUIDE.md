# PanzerNavSystem - Complete Hardware, Wiring & Operation Guide

> **Dual-Target Controller**: Fully supports **ESP32 (ESP32-WROOM-32 / ESP32-DevKitC)** and **ESP-12E / NodeMCU v2 (ESP8266EX)**.  
> **Autonomous Wi-Fi AP**: Built-in Access Point (`PanzerTank-AP`), local browser control, zero router or internet required.  
> **Actuator Inventory**: 8 Total Servos (4 Propulsion + 2 Steering + 1 Aiming + 1 Scanner) + RCWL-1604 Sonar + Status LED.

---

## 1. System Overview & Actuator Inventory

PanzerNavSystem provides full Wi-Fi web-based control of a robotic tank chassis with a dynamic radar-style ultrasonic obstacle sweep. The microcontroller acts as a standalone Wi-Fi hotspot serving a mobile-friendly dashboard over HTTP and WebSockets.

### Actuator Breakdown (Profile B - All Servos)

| # | Actuator / Sensor | Hardware Type | Function / Motion Range |
|---|---|---|---|
| **1** | **Propulsion Front-Left** | Continuous Rotation / Positional Servo | Moves Left Front track forward / reverse |
| **2** | **Propulsion Rear-Left** | Continuous Rotation / Positional Servo | Moves Left Rear track forward / reverse |
| **3** | **Propulsion Front-Right** | Continuous Rotation / Positional Servo | Moves Right Front track forward / reverse |
| **4** | **Propulsion Rear-Right** | Continuous Rotation / Positional Servo | Moves Right Rear track forward / reverse |
| **5** | **Steering Left** | Standard Positional Servo (180°) | Adjusts Left steering knuckle / track geometry (turn left / right) |
| **6** | **Steering Right** | Standard Positional Servo (180°) | Adjusts Right steering knuckle / track geometry (turn left / right) |
| **7** | **Turret Aiming** | Standard Positional Servo (180°) | Turret pan azimuth left / right (0° to 180°, center 90°) |
| **8** | **Radar Scanner** | Standard Positional Servo (180°) | Sweeps ultrasonic sensor 0° to 180° in smooth or discrete steps |
| **S** | **Sonar Sensor** | RCWL-1604 / HC-SR04 | Measures distance ahead during 0°–180° sweeps |
| **L** | **Status / Effect LED** | 3mm/5mm LED + Resistor | Diagnostic heartbeat and cannon fire simulation flash |

*(For tanks using 4 DC Motors with two L298N dual-H-bridge boards instead of 4 propulsion servos, see [Section 5: Profile A (DC Motors + 2x L298N)](#5-profile-a-wiring-guide-4-dc-motors--2x-l298n-dual-h-bridge)).*

---

## 2. Power Distribution & Electrical Rules (CRITICAL)

> [!CAUTION]
> **NEVER POWER SERVOS FROM THE ESP32 OR ESP8266 3.3V / 5V PINS!**  
> 8 micro-servos (e.g. SG90 / MG90S) draw between **1.5A to 3.5A peak** under load and stall conditions. The linear regulator on an ESP development board is rated for only 500mA–800mA. Attempting to power servos from the board regulator will cause instant brownouts, continuous bootloops, Wi-Fi crashes, and damaged boards.

### Recommended Power Architecture

```
   +--------------------------------------------------------------+
   |                     BATTERY PACK                             |
   |      (2S LiPo 7.4V, or 6x AA 7.2V-9.0V, or 3S LiPo 11.1V)     |
   +--------------------------------------------------------------+
            | (+) Positive                              | (-) Negative / Ground
            v                                           v
   [ Main Power Switch ]                                |
            |                                           |
            v                                           |
   +--------------------------------------------------------------+
   |          HIGH-CURRENT BUCK CONVERTER / UBEC (5V - 6V, 5A)     |
   |     (e.g., LM2596 / XL4015 / Hobbywing 5V 5A UBEC)           |
   +--------------------------------------------------------------+
            | (+) 5.0V - 6.0V OUT                       | (-) GND OUT
            |                                           |
    +-------+-------+                           +-------+-------+
    |               |                           |               |
    v               v                           v               v
 [ESP VIN / 5V] [Servo 5V-6V Power Bus]     [ESP GND]   [Common GND Bus]
                 |                                      |
                 +--> VCC to all 8 Servos               +--> GND to all 8 Servos
                 +--> VCC to RCWL-1604 Sonar            +--> GND to Sonar & LED
```

### Essential Electrical Rules
1. **Common Ground Bus**: All grounds (Battery (-), Buck Converter OUT(-), ESP GND, all 8 Servo GND wires, and Sensor GND) **MUST be tied together**. If grounds are not shared, the PWM control signals will float, causing erratic servo jitter.
2. **Servo Power Bus**: Use a dedicated terminal block, proto-board power strip, or servo power distribution shield where all 8 servo positive wires (Red) receive regulated 5V to 6V directly from the buck converter.
3. **Sensor Supply**: The RCWL-1604 operates from 3.3V to 5V. Supplying 5V gives the best ultrasonic echo range and accuracy.

---

## 3. ESP32 DevKit Wiring Guide (Direct 8-Servo Pinout)

The ESP32 possesses ample hardware PWM timers and conflict-free GPIO pins, allowing **all 8 servos, the ultrasonic sensor, and the status LED to connect directly** without requiring an external multiplexer.

### ESP32 Pin-by-Pin Connection Table

| Device | Wire Function | Wire Color | ESP32 Board Pin | ESP32 GPIO | Voltage Rail | Notes |
|---|---|---|---|---|---|---|
| **Propulsion Front-Left** | Signal (PWM) | Orange / White | **D18** | GPIO 18 | Logic 3.3V | Forward/reverse left side |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Propulsion Rear-Left** | Signal (PWM) | Orange / White | **D19** | GPIO 19 | Logic 3.3V | Forward/reverse left side |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Propulsion Front-Right** | Signal (PWM) | Orange / White | **D21** | GPIO 21 | Logic 3.3V | Forward/reverse right side |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Propulsion Rear-Right** | Signal (PWM) | Orange / White | **D22** | GPIO 22 | Logic 3.3V | Forward/reverse right side |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Steering Left Servo** | Signal (PWM) | Orange / White | **D25** | GPIO 25 | Logic 3.3V | Knuckle/track angle (turn L/R) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Steering Right Servo** | Signal (PWM) | Orange / White | **D26** | GPIO 26 | Logic 3.3V | Knuckle/track angle (turn L/R) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Aiming / Turret Servo** | Signal (PWM) | Orange / White | **D27** | GPIO 27 | Logic 3.3V | Left/Right turret pan (0°–180°) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Radar Scanner Servo** | Signal (PWM) | Orange / White | **D23** | GPIO 23 | Logic 3.3V | Sweeps RCWL-1604 (0°–180°) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **RCWL-1604 Sonar** | VCC | Red | — | — | **5V Rail** | Supply 5V (or 3.3V) |
| | GND | Black | — | — | **Common GND** | Common ground bus |
| | TRIG | Blue / Yellow | **D32** | GPIO 32 | Logic 3.3V | Trigger pulse output |
| | ECHO | Green / White | **D33** | GPIO 33 | Logic 3.3V | Echo pulse input *(3.3V safe)* |
| **Status / Effect LED** | Anode (+) | Long Leg / Red | **D2** | GPIO 2 | 220Ω Resistor | Cannon effect & Heartbeat |
| | Cathode (-) | Short Leg / Blk | **GND** | ESP GND | **Common GND** | Common ground bus |

### ESP32 ASCII Wiring Schematic

```
                          ESP32 DEVKIT BOARD
                      +------------------------+
                      | [USB]                  |
                      | 3V3                GND |--- (Common GND)
                      | EN                  23 |--- Scanner Servo Signal (Orange)
                      | 36 (VP)             22 |--- Prop Rear-Right Servo Signal (Orange)
                      | 39 (VN)              1 |--- TXD0 (Serial Debug)
                      | 34                   3 |--- RXD0
                      | 35                  21 |--- Prop Front-Right Servo Signal (Orange)
  (Sonar TRIG) -------| 32                 GND |--- (Common GND)
  (Sonar ECHO) -------| 33                  19 |--- Prop Rear-Left Servo Signal (Orange)
(Steer L Servo) ------| 25                  18 |--- Prop Front-Left Servo Signal (Orange)
(Steer R Servo) ------| 26                   5 |
 (Aiming Servo) ------| 27                   4 |
                      | 14                   0 |--- BOOT
                      | 12                   2 |--- Status LED (via 220 ohm to GND)
                      | 13                  15 |
                      | GND                 SD1|
(5V UBEC Power) ------| VIN                 SD0|
                      +------------------------+
```

---

## 4. ESP-12E / NodeMCU v2 Wiring Guide

The ESP8266 (ESP-12E / NodeMCU v2) has fewer GPIOs available for external peripherals because several pins determine boot state (GPIO 0, 2, 15). We provide two wiring configurations:

### Configuration A: Direct Wiring with Paired Propulsion (No Extra Board)
Because tanks steer by driving left and right tracks in unison, **Front-Left and Rear-Left propulsion servos share one throttle pin (D1)**, and **Front-Right and Rear-Right propulsion servos share one throttle pin (D2)** using simple standard RC 3-pin Y-splitter cables.

#### ESP-12E / NodeMCU Direct Pinout Table

| Device | Wire Function | Wire Color | NodeMCU Pin | ESP8266 GPIO | Voltage Rail | Notes |
|---|---|---|---|---|---|---|
| **Propulsion FL + RL** | Signal (PWM) | Orange / White | **D1** | GPIO 5 | Logic 3.3V | Connect via Y-cable to both left servos |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Propulsion FR + RR** | Signal (PWM) | Orange / White | **D2** | GPIO 4 | Logic 3.3V | Connect via Y-cable to both right servos |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Steering Left Servo** | Signal (PWM) | Orange / White | **D6** | GPIO 12 | Logic 3.3V | Knuckle/track angle (turn L/R) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Steering Right Servo** | Signal (PWM) | Orange / White | **D7** | GPIO 13 | Logic 3.3V | Knuckle/track angle (turn L/R) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Aiming / Turret Servo** | Signal (PWM) | Orange / White | **D8** | GPIO 15 | Logic 3.3V | Left/Right turret pan (0°–180°) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **Radar Scanner Servo** | Signal (PWM) | Orange / White | **D5** | GPIO 14 | Logic 3.3V | Sweeps RCWL-1604 (0°–180°) |
| | Power (VCC) | Red | — | — | **5V–6V UBEC Rail** | Do NOT connect to 3.3V! |
| | Ground (GND) | Brown / Black | — | — | **Common GND** | Common ground bus |
| **RCWL-1604 Sonar** | VCC | Red | — | — | **5V Rail** | Supply 5V (or 3.3V) |
| | GND | Black | — | — | **Common GND** | Common ground bus |
| | TRIG | Blue / Yellow | **D0** | GPIO 16 | Logic 3.3V | Sonar trigger pulse |
| | ECHO | Green / White | **D4** | GPIO 2 | Logic 3.3V | Sonar echo pulse *(safe boot pullup)* |
| **Status / Effect LED** | Anode (+) | Long Leg / Red | **D3** | GPIO 0 | 220Ω Resistor | Cannon effect & Heartbeat |
| | Cathode (-) | Short Leg / Blk | **GND** | ESP GND | **Common GND** | Common ground bus |

#### ESP-12E / NodeMCU ASCII Wiring Schematic

```
                           NODEMCU V2 (ESP-12E)
                         +-----------------------+
                         | [USB]                 |
  (Sonar TRIG) ----------| D0 (GPIO 16)      D8  |--- Aiming Servo Signal (Orange)
(Prop Left FL+RL Y-Cable)| D1 (GPIO 5)       D7  |--- Steering Right Servo Signal (Orange)
(Prop Right FR+RR Y-Cable| D2 (GPIO 4)       D6  |--- Steering Left Servo Signal (Orange)
 (Status LED via 220ohm)-| D3 (GPIO 0)       D5  |--- Scanner Servo Signal (Orange)
  (Sonar ECHO) ----------| D4 (GPIO 2)      GND  |--- (Common GND)
                         | 3V3              3V3  |
                         | GND              GND  |
(5V UBEC Power) ---------| VIN              VIN  |
                         +-----------------------+
```

---

## 5. Profile A Wiring Guide (4 DC Motors + 2x L298N Dual H-Bridge)

If your tank uses brushed DC geared motors instead of propulsion servos:

### Motor Driver 1 (Left Track: Front-Left & Rear-Left DC Motors)
- **ENA**: NodeMCU D1 / ESP32 GPIO 18 (PWM Speed Control)
- **IN1**: NodeMCU D3 / ESP32 GPIO 5 (Direction A)
- **IN2**: NodeMCU D4 / ESP32 GPIO 4 (Direction B)
- **12V / VMS Pin**: Battery (+)
- **GND Pin**: Common Battery (-) and ESP GND
- **OUT1 & OUT2**: Wired in parallel to Front-Left and Rear-Left DC Motors

### Motor Driver 2 (Right Track: Front-Right & Rear-Right DC Motors)
- **ENB / ENA**: NodeMCU D2 / ESP32 GPIO 19 (PWM Speed Control)
- **IN3 / IN1**: NodeMCU D8 / ESP32 GPIO 21 (Direction A)
- **IN4 / IN2**: NodeMCU D0 / ESP32 GPIO 22 (Direction B)
- **12V / VMS Pin**: Battery (+)
- **GND Pin**: Common Battery (-) and ESP GND
- **OUT3 & OUT4**: Wired in parallel to Front-Right and Rear-Right DC Motors

*(The 2 Steering servos, 1 Aiming servo, 1 Scanner servo, and RCWL-1604 sonar remain connected exactly as documented in Sections 3 and 4).*

---

## 6. Firmware Configuration

Open [firmware/include/config.h](file:///e:/WebSite/PanzerNavSystem/firmware/include/config.h) to verify your settings:

### Hardware Profile Selection
```cpp
// Choose active hardware profile:
#define HARDWARE_PROFILE  PROFILE_B_ALL_SERVOS
// Or for DC motors:
// #define HARDWARE_PROFILE  PROFILE_A_DUAL_L298N
```

### Wi-Fi Access Point Credentials
```cpp
#define WIFI_AP_SSID       "PanzerTank-AP"
#define WIFI_AP_PASS       "panzer123456"  // Must be >= 8 characters for WPA2-PSK, or "" for open
#define WIFI_AP_CHANNEL    6               // Standard low-interference Wi-Fi channel
```

### Radar Scanner Settings
```cpp
#define SCANNER_MIN_ANGLE  0               // Minimum sweep angle (degrees)
#define SCANNER_MAX_ANGLE  180             // Maximum sweep angle (degrees)
#define SCANNER_STEP_DEG   3               // Step size (must divide 180 evenly: 1, 2, 3, 5, 6, 10, 15)
#define SCANNER_STEP_MS    45              // Settling delay per step (milliseconds)
```

---

## 7. Flashing & Upload Instructions

The repository includes a single-flash deployment system that automatically compiles the web interface, embeds it into C++ flash memory, and writes both the firmware and website in **one single upload**.

### Flashing to ESP32

1. Connect your ESP32 board to your PC via a micro-USB or USB-C data cable.
2. Open a Command Prompt or PowerShell in the repository folder:
   ```cmd
   upload_all.bat esp32
   ```
   *(Or specify the COM port if you have multiple USB devices: `upload_all.bat esp32 --upload-port COM4`)*
3. **If flashing stops at `Connecting........_____.....`**:
   - Hold down the **BOOT** button on the ESP32 board.
   - Tap and release the **EN / RST** button once.
   - Release the **BOOT** button when flashing starts.

### Flashing to ESP-12E / NodeMCU v2

1. Connect your NodeMCU v2 board to your PC via USB.
2. Run the single-flash script:
   ```cmd
   upload_all.bat
   ```
   *(Or explicitly: `upload_all.bat esp8266 --upload-port COM3`)*
3. **If flashing on a bare ESP-12E module**:
   - Ensure GPIO0 is pulled to GND while pulling RST low to enter the UART bootloader.

---

## 8. Mobile Phone Connection & Driving

1. **Power up the tank**: Turn on the main battery switch. The onboard LED will pulse once, and the servos will center.
2. **Open Wi-Fi Settings on your phone**:
   - Look for the Wi-Fi network: **`PanzerTank-AP`**.
   - Enter password: **`panzer123456`**.
   - Connect to the network.
3. **Critical Phone Settings (Prevent Disconnections)**:
   - **Turn OFF Mobile Data / Cellular**: Android and iOS detect that `PanzerTank-AP` does not have public internet, and will try to route traffic over cellular unless cellular data is temporarily toggled off.
   - **Turn OFF Private DNS**: In your phone's Wi-Fi / Connection settings, set *Private DNS* to **Off** (private DNS queries public servers which are not reachable on an offline local robot network).
   - **Keep Wi-Fi Connected**: If your phone shows a popup saying *"This network has no internet access. Stay connected?"*, tap **YES / Always connect**.
4. **Open Control Dashboard**:
   - Open Chrome or Safari and browse to:
     ```
     http://192.168.4.1/
     ```
   - The PanzerNavSystem control panel will load immediately.
   - The status bar will show `CONNECTED (WS: ONLINE)`.
   - The radar display will sweep in real time from 0° to 180°, plotting obstacles detected by the RCWL-1604 sonar.

---

## 9. Troubleshooting & Diagnostics

| Symptom | Cause | Solution |
|---|---|---|
| **ESP resets or Wi-Fi drops when moving** | Servos drawing current from ESP 3.3V pin | Power servos from external 5V/6V UBEC buck converter. Verify common ground. |
| **Servos twitch violently or don't move** | Missing common ground connection | Connect Battery (-), UBEC OUT(-), and ESP GND together with a solid wire. |
| **Phone says "Connected, no internet"** | Expected behavior for an offline Access Point | Toggle mobile data off so phone does not abandon the local Wi-Fi connection. |
| **Radar shows invalid or zero distance** | Ultrasonic TRIG/ECHO pin swapped or sensor unpowered | Verify TRIG is on D32 (ESP32) / D0 (ESP8266) and ECHO is on D33 (ESP32) / D4 (ESP8266). Ensure sensor gets 5V. |
| **Tank drives in reverse when pressing Forward** | Servo rotation orientation inverted | Reverse servo horn or invert pulse width calculation in `actuators.cpp`. |
| **COM port access denied when flashing** | Serial Monitor or Arduino IDE holding the COM port | Close all serial terminals, VS Code monitor windows, or Arduino IDE and retry. |
