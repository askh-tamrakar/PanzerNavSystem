/**
 * PanzerNavSystem - Firmware Configuration & Hardware Profile
 * Target: ESP8266 (ESP-12E / NodeMCU v2)
 *
 * HARDWARE SAFETY ASSUMPTIONS:
 * 1. The L298N H-Bridge is strictly for brushed DC motors; it CANNOT drive servos.
 * 2. Default Drive Profile: 4 DC gear motors arranged as Left and Right pairs
 *    controlled via an L298N module.
 * 3. Continuous-rotation servos as drive units are NOT supported by the L298N.
 *    If drive units are servos, a dedicated PWM servo driver (e.g., PCA9685)
 *    and a different firmware motor driver module are mandatory.
 * 4. Power Isolation & Shared Ground:
 *    - Drive motors and servos must be powered from a dedicated high-current supply
 *      (e.g., 7.4V 2S LiPo or 6V NiMH for motors, 5V 2A regulator for servo).
 *    - Never power motors or servos from ESP8266 GPIO pins or its 3.3V rail.
 *    - A COMMON GROUND (GND) must connect the ESP8266, L298N, and Servo supply.
 * 5. Sensor Logic Voltage:
 *    - ESP8266 GPIO inputs are strictly 3.3V logic.
 *    - RCWL-1604 in standard mode powered at 5V outputs a 5V Echo pulse.
 *      You MUST use a voltage divider (e.g. 1k / 2k resistor) on the Echo pin
 *      or power the RCWL-1604 from 3.3V if supported by your board variant.
 * 6. ESP8266 Boot-Strapping Pins:
 *    - GPIO15 must be pulled LOW during boot.
 *    - GPIO0 must be HIGH during normal boot.
 *    - GPIO2 must be HIGH during boot (connected to onboard LED).
 *    - Avoid GPIO9/10/11 (connected to internal SPI flash).
 * 7. Simulation Effect:
 *    - Harmless LED/sound pulse only. Strictly no payload, weapon, or projectile.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Attempt to load local user credentials if present
#if __has_include("config.local.h")
#include "config.local.h"
#endif

// =============================================================================
// 1. PIN ASSIGNMENTS (ESP8266 NodeMCU / ESP-12E)
// =============================================================================

// Motors (L298N Dual H-Bridge)
// Default configuration keeps ENA and ENB jumpers connected to 5V on the L298N board.
// Speed and direction are controlled directly via PWM on IN1..IN4.
#ifndef PIN_MOTOR_LEFT_IN1
#define PIN_MOTOR_LEFT_IN1   4   // NodeMCU D2 (GPIO4) - Left Forward
#endif

#ifndef PIN_MOTOR_LEFT_IN2
#define PIN_MOTOR_LEFT_IN2   5   // NodeMCU D1 (GPIO5) - Left Reverse
#endif

#ifndef PIN_MOTOR_RIGHT_IN3
#define PIN_MOTOR_RIGHT_IN3  12  // NodeMCU D6 (GPIO12) - Right Forward
#endif

#ifndef PIN_MOTOR_RIGHT_IN4
#define PIN_MOTOR_RIGHT_IN4  13  // NodeMCU D7 (GPIO13) - Right Reverse
#endif

// Ultrasonic Scanning Servo
#ifndef PIN_RADAR_SERVO
#define PIN_RADAR_SERVO      14  // NodeMCU D5 (GPIO14) - PWM Servo Signal
#endif

// RCWL-1604 Ultrasonic Distance Sensor
#ifndef PIN_SONAR_TRIG
#define PIN_SONAR_TRIG       16  // NodeMCU D0 (GPIO16) - Output Trigger
#endif

#ifndef PIN_SONAR_ECHO
#define PIN_SONAR_ECHO       2   // NodeMCU D4 (GPIO2) - Echo Input (3.3V Logic Safe)
#endif

// Harmless Simulation Effect (Muzzle Flash LED / Active Buzzer)
#ifndef PIN_SIMULATED_EFFECT
#define PIN_SIMULATED_EFFECT 0   // NodeMCU D3 (GPIO0) - Active Low / High pulse
#endif

// =============================================================================
// 2. RADAR & SERVO CALIBRATION
// =============================================================================
#ifndef SERVO_MIN_ANGLE
#define SERVO_MIN_ANGLE      30   // Minimum sweep angle in degrees
#endif

#ifndef SERVO_MAX_ANGLE
#define SERVO_MAX_ANGLE      150  // Maximum sweep angle in degrees
#endif

#ifndef SERVO_STEP_DEG
#define SERVO_STEP_DEG       5    // Degrees to increment per step
#endif

#ifndef SERVO_SETTLE_MS
#define SERVO_SETTLE_MS      45   // Delay after moving servo before pulsing sonar
#endif

#ifndef SONAR_TIMEOUT_US
#define SONAR_TIMEOUT_US     25000 // Microseconds (~430 cm maximum range)
#endif

#ifndef OBSTACLE_THRESHOLD_CM
#define OBSTACLE_THRESHOLD_CM 22.0f // Autonomous stop distance threshold (cm)
#endif

#ifndef OBSTACLE_SECTOR_MIN_DEG
#define OBSTACLE_SECTOR_MIN_DEG 70  // Forward collision danger zone min angle
#endif

#ifndef OBSTACLE_SECTOR_MAX_DEG
#define OBSTACLE_SECTOR_MAX_DEG 110 // Forward collision danger zone max angle
#endif

// =============================================================================
// 3. SAFETY & WATCHDOG TIMERS
// =============================================================================
#ifndef COMMAND_TIMEOUT_MS
#define COMMAND_TIMEOUT_MS   1200 // Motor halts if no command or ping in 1200ms
#endif

#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 200 // Broadcast telemetry every 200ms
#endif

#ifndef EFFECT_DURATION_MS
#define EFFECT_DURATION_MS   150  // Harmless simulation LED/sound pulse duration
#endif

// =============================================================================
// 4. WI-FI & NETWORK DEFAULTS (CAN BE OVERRIDDEN IN config.local.h)
// =============================================================================
#ifndef WIFI_AP_SSID
#define WIFI_AP_SSID         "PanzerTank-AP"
#endif

#ifndef WIFI_AP_PASS
#define WIFI_AP_PASS         "panzer123456" // Minimum 8 chars for WPA2-PSK
#endif

#ifndef WIFI_AP_CHANNEL
#define WIFI_AP_CHANNEL      6
#endif

// Optional: Station mode (connects to existing home Wi-Fi if defined)
#ifndef WIFI_STA_SSID
#define WIFI_STA_SSID        ""
#endif

#ifndef WIFI_STA_PASS
#define WIFI_STA_PASS        ""
#endif

#ifndef MDNS_HOSTNAME
#define MDNS_HOSTNAME        "panzer"
#endif

#ifndef HTTP_PORT
#define HTTP_PORT            80
#endif

#ifndef WS_PORT
#define WS_PORT              81
#endif

#endif // CONFIG_H
