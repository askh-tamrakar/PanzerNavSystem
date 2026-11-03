/**
 * PanzerNavSystem - Firmware Configuration & Hardware Profile
 * Target: ESP8266 (ESP-12E / NodeMCU v2)
 *
 * REVISED ACTUATOR INVENTORY (8 ACTUATORS TOTAL):
 * 1. Four (4) Propulsion Actuators (Forward/Reverse drive)
 * 2. Two (2) Steering Servos (Left & Right steering geometry)
 * 3. One (1) Aiming Servo (Turret / payload traverse pan)
 * 4. One (1) Ultrasonic Sensor Scanning Servo (RCWL-1604 sweep)
 * 5. Two (2) L298N Dual H-Bridge Motor Driver Boards
 * 6. One (1) RCWL-1604 Ultrasonic Sensor
 *
 * HARDWARE PROFILE MATRIX:
 * -----------------------------------------------------------------------------
 * PROFILE A: Four Propulsion Units are Brushed DC Motors
 *   - The 2x L298N boards drive the 4 DC motors (each L298N controls 2 motors:
 *     L298N #1 for Left Front/Rear; L298N #2 for Right Front/Rear).
 *   - Four separate servo outputs drive the 2 steering servos, 1 aiming servo,
 *     and 1 scanner servo.
 *   - The 4 DC motors must NEVER be wired as or referred to as servos.
 *
 * PROFILE B: Four Propulsion Units are Servos
 *   - The 4 propulsion actuators are continuous-rotation or positional servos.
 *   - NEVER connect any servo to an L298N output.
 *   - The 2x L298N boards are marked UNUSED for this profile.
 *   - An 8-channel servo driver (such as PCA9685 I2C) controls all 8 servos:
 *     4 propulsion servos + 2 steering servos + 1 aiming servo + 1 scanner servo.
 *
 * UNCONFIRMED PROFILE (DEFAULT):
 *   - If the physical hardware profile is not yet confirmed by the builder,
 *     the firmware safely locks out propulsion commands to prevent electrical
 *     or mechanical damage. The active profile must be explicitly chosen.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Attempt to load local user credentials and overrides if present
#if __has_include("config.local.h")
#include "config.local.h"
#endif

// =============================================================================
// 1. HARDWARE PROFILES
// =============================================================================
// Profile B is the sole active profile: 8 Servos (4 Propulsion + 2 Steering + 1 Aiming + 1 Scanner)
#define PROFILE_UNCONFIRMED             0
#define PROFILE_A_DC_MOTORS             1
#define PROFILE_B_PROPULSION_SERVOS     2

#ifndef ACTIVE_HARDWARE_PROFILE
#define ACTIVE_HARDWARE_PROFILE         PROFILE_B_PROPULSION_SERVOS
#endif

// Profile B Propulsion Servo Type: 0 = Continuous Rotation, 1 = Positional
#ifndef PROPULSION_SERVO_TYPE
#define PROPULSION_SERVO_TYPE_CONTINUOUS 0
#define PROPULSION_SERVO_TYPE_POSITIONAL 1
#define PROPULSION_SERVO_TYPE           PROPULSION_SERVO_TYPE_CONTINUOUS
#endif

// Continuous-rotation servo calibration (microseconds)
#ifndef SERVO_PULSE_NEUTRAL_US
#define SERVO_PULSE_NEUTRAL_US          1500  // Calibrated neutral pulse (stop)
#endif
#ifndef SERVO_PULSE_FORWARD_MAX_US
#define SERVO_PULSE_FORWARD_MAX_US      2000  // Full forward pulse
#endif
#ifndef SERVO_PULSE_REVERSE_MAX_US
#define SERVO_PULSE_REVERSE_MAX_US      1000  // Full reverse pulse
#endif

// =============================================================================
// 2. ACTUATOR LIMITS & DEFAULTS (8 CHANNELS)
// =============================================================================

// Steering Servos (2 Channels: Left & Right)
#ifndef STEERING_MIN_ANGLE
#define STEERING_MIN_ANGLE              45    // Minimum mechanical limit (degrees)
#endif
#ifndef STEERING_MAX_ANGLE
#define STEERING_MAX_ANGLE              135   // Maximum mechanical limit (degrees)
#endif
#ifndef STEERING_CENTER_ANGLE
#define STEERING_CENTER_ANGLE           90    // Center / straight-ahead position
#endif

// Aiming Servo (1 Channel: Turret / Pan Traverse)
#ifndef AIMING_MIN_ANGLE
#define AIMING_MIN_ANGLE                30    // Minimum traverse angle (degrees)
#endif
#ifndef AIMING_MAX_ANGLE
#define AIMING_MAX_ANGLE                150   // Maximum traverse angle (degrees)
#endif
#ifndef AIMING_CENTER_ANGLE
#define AIMING_CENTER_ANGLE             90    // Center forward position
#endif

// Ultrasonic Scanner Servo (1 Channel: Sensor Pan Sweep - 0.25° ultra-smooth steps)
#ifndef SCANNER_MIN_ANGLE
#define SCANNER_MIN_ANGLE               0.0f  // Minimum sweep angle (degrees) - Full 0-180 sweep
#endif
#ifndef SCANNER_MAX_ANGLE
#define SCANNER_MAX_ANGLE               180.0f// Maximum sweep angle (degrees) - Full 0-180 sweep
#endif
#ifndef SCANNER_STEP_DEG
#define SCANNER_STEP_DEG                0.25f // Step size per measurement (0.25° ultra-smooth)
#endif
#ifndef SCANNER_SETTLE_MS
#define SCANNER_SETTLE_MS               15    // Mechanical settling delay (ms) for fine micro-steps
#endif

// =============================================================================
// 3. PIN ASSIGNMENTS & ARCHITECTURE
// =============================================================================
/**
 * ESP-12E PIN CONSTRAINT ARCHITECTURE:
 * The ESP8266 provides only ~9 usable general-purpose GPIOs.
 * Controlling 8 independent actuator signals (4 propulsion + 2 steering +
 * 1 aiming + 1 scanner) plus 2 ultrasonic pins directly on ESP GPIOs exceeds
 * the available pin count.
 *
 * RECOMMENDED EXPANSION: PCA9685 16-Channel 12-Bit I2C PWM Controller
 * - Connected via ESP-12E I2C pins:
 *     SDA -> GPIO4 (NodeMCU D2)
 *     SCL -> GPIO5 (NodeMCU D1)
 * - Directly drives all 8 servos with dedicated external servo power.
 *
 * DIRECT GPIO FALLBACK ARCHITECTURE (When PCA9685 is not fitted):
 * In Profile A, the 4 DC motors share Left/Right pair control lines across
 * the 2x L298N boards (parallel input lines for Left and Right sides), while
 * the 4 servos are attached to the remaining safe GPIOs.
 */

#ifdef ESP32
// =============================================================================
// ESP32 DIRECT PIN ASSIGNMENTS (ALL 8 SERVOS HAVE DEDICATED GPIOS!)
// =============================================================================

// 4 Propulsion Servos (Profile B: Continuous-Rotation or Positional Drive)
#ifndef PIN_SERVO_PROP_FL
#define PIN_SERVO_PROP_FL               18    // Front-Left Propulsion Servo (GPIO18)
#endif
#ifndef PIN_SERVO_PROP_RL
#define PIN_SERVO_PROP_RL               19    // Rear-Left Propulsion Servo (GPIO19)
#endif
#ifndef PIN_SERVO_PROP_FR
#define PIN_SERVO_PROP_FR               21    // Front-Right Propulsion Servo (GPIO21)
#endif
#ifndef PIN_SERVO_PROP_RR
#define PIN_SERVO_PROP_RR               22    // Rear-Right Propulsion Servo (GPIO22)
#endif

// 2 Steering Servos (Left & Right Articulation Geometry)
#ifndef PIN_SERVO_STEER_L
#define PIN_SERVO_STEER_L               23    // Left Steering Servo (GPIO23)
#endif
#ifndef PIN_SERVO_STEER_R
#define PIN_SERVO_STEER_R               25    // Right Steering Servo (GPIO25)
#endif

// 1 Aiming Servo (Turret / Payload Pan Traverse)
#ifndef PIN_SERVO_AIMING
#define PIN_SERVO_AIMING                26    // Aiming Pan Servo (GPIO26)
#endif

// 1 Ultrasonic Scanner Servo (Sonar Sweep Arc)
#ifndef PIN_SERVO_SCANNER
#define PIN_SERVO_SCANNER               27    // Scanner Servo (GPIO27)
#endif

// Profile A DC Motor Fallback Pins (If 2x L298N are used on ESP32)
#ifndef PIN_MOTOR_LEFT_IN1
#define PIN_MOTOR_LEFT_IN1              18
#endif
#ifndef PIN_MOTOR_LEFT_IN2
#define PIN_MOTOR_LEFT_IN2              19
#endif
#ifndef PIN_MOTOR_RIGHT_IN3
#define PIN_MOTOR_RIGHT_IN3             21
#endif
#ifndef PIN_MOTOR_RIGHT_IN4
#define PIN_MOTOR_RIGHT_IN4             22
#endif

// RCWL-1604 Ultrasonic Distance Sensor (ESP32)
#ifndef PIN_SONAR_TRIG
#define PIN_SONAR_TRIG                  32    // Output Trigger (GPIO32)
#endif
#ifndef PIN_SONAR_ECHO
#define PIN_SONAR_ECHO                  33    // Echo Input via voltage divider (GPIO33)
#endif

// Harmless Simulation Effect (Muzzle Flash LED / Active Buzzer)
#ifndef PIN_SIMULATED_EFFECT
#define PIN_SIMULATED_EFFECT            13    // Status / Effect Output (GPIO13)
#endif

// Optional I2C Bus for PCA9685 Expansion
#ifndef PIN_I2C_SDA
#define PIN_I2C_SDA                     21
#endif
#ifndef PIN_I2C_SCL
#define PIN_I2C_SCL                     22
#endif

#else // ESP8266 (ESP-12E / NodeMCU v2)

// =============================================================================
// ESP8266 / NODEMCU PIN ASSIGNMENTS
// =============================================================================

// 4 Propulsion Servos (Profile B Direct Mode):
// On ESP8266, Left Front & Rear share D1; Right Front & Rear share D2
#ifndef PIN_SERVO_PROP_LEFT
#define PIN_SERVO_PROP_LEFT             5     // NodeMCU D1 (GPIO5) - Left Pair
#endif
#ifndef PIN_SERVO_PROP_RIGHT
#define PIN_SERVO_PROP_RIGHT            4     // NodeMCU D2 (GPIO4) - Right Pair
#endif
#ifndef PIN_SERVO_PROP_FL
#define PIN_SERVO_PROP_FL               PIN_SERVO_PROP_LEFT
#endif
#ifndef PIN_SERVO_PROP_RL
#define PIN_SERVO_PROP_RL               PIN_SERVO_PROP_LEFT
#endif
#ifndef PIN_SERVO_PROP_FR
#define PIN_SERVO_PROP_FR               PIN_SERVO_PROP_RIGHT
#endif
#ifndef PIN_SERVO_PROP_RR
#define PIN_SERVO_PROP_RR               PIN_SERVO_PROP_RIGHT
#endif

// 2 Steering Servos
#ifndef PIN_SERVO_STEER_L
#define PIN_SERVO_STEER_L               12    // NodeMCU D6 (GPIO12)
#endif
#ifndef PIN_SERVO_STEER_R
#define PIN_SERVO_STEER_R               13    // NodeMCU D7 (GPIO13)
#endif

// 1 Aiming Servo
#ifndef PIN_SERVO_AIMING
#define PIN_SERVO_AIMING                15    // NodeMCU D8 (GPIO15)
#endif

// 1 Scanner Servo
#ifndef PIN_SERVO_SCANNER
#define PIN_SERVO_SCANNER               14    // NodeMCU D5 (GPIO14)
#endif

// Profile A Motor Pins (DC Motors on 2x L298N)
#ifndef PIN_MOTOR_LEFT_IN1
#define PIN_MOTOR_LEFT_IN1              4     // NodeMCU D2 (GPIO4)
#endif
#ifndef PIN_MOTOR_LEFT_IN2
#define PIN_MOTOR_LEFT_IN2              5     // NodeMCU D1 (GPIO5)
#endif
#ifndef PIN_MOTOR_RIGHT_IN3
#define PIN_MOTOR_RIGHT_IN3             12    // NodeMCU D6 (GPIO12)
#endif
#ifndef PIN_MOTOR_RIGHT_IN4
#define PIN_MOTOR_RIGHT_IN4             13    // NodeMCU D7 (GPIO13)
#endif

// RCWL-1604 Ultrasonic Distance Sensor
#ifndef PIN_SONAR_TRIG
#define PIN_SONAR_TRIG                  16    // NodeMCU D0 (GPIO16) - Output Trigger
#endif
#ifndef PIN_SONAR_ECHO
#define PIN_SONAR_ECHO                  2     // NodeMCU D4 (GPIO2) - Echo Input (3.3V safe!)
#endif

// Harmless Simulation Effect (Muzzle Flash LED / Active Buzzer)
#ifndef PIN_SIMULATED_EFFECT
#define PIN_SIMULATED_EFFECT            0     // NodeMCU D3 (GPIO0) - Active pulse
#endif

// I2C Bus for PCA9685 / Expansion
#ifndef PIN_I2C_SDA
#define PIN_I2C_SDA                     4     // NodeMCU D2 (GPIO4)
#endif
#ifndef PIN_I2C_SCL
#define PIN_I2C_SCL                     5     // NodeMCU D1 (GPIO5)
#endif

#endif // ESP32 vs ESP8266

// =============================================================================
// 4. SENSOR & SAFETY CONSTANTS
// =============================================================================
#ifndef SONAR_TIMEOUT_US
#define SONAR_TIMEOUT_US                25000 // Microseconds (~430 cm maximum range)
#endif
#ifndef OBSTACLE_THRESHOLD_CM
#define OBSTACLE_THRESHOLD_CM           22.0f // Autonomous braking threshold (cm)
#endif
#ifndef OBSTACLE_SECTOR_MIN_DEG
#define OBSTACLE_SECTOR_MIN_DEG         70    // Danger zone min angle
#endif
#ifndef OBSTACLE_SECTOR_MAX_DEG
#define OBSTACLE_SECTOR_MAX_DEG         110   // Danger zone max angle
#endif

#ifndef COMMAND_TIMEOUT_MS
#define COMMAND_TIMEOUT_MS              1200  // Failsafe shutdown timeout (ms)
#endif
#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS           200   // Telemetry broadcast interval (ms)
#endif
#ifndef EFFECT_DURATION_MS
#define EFFECT_DURATION_MS              150   // Harmless LED/sound pulse duration (ms)
#endif

// =============================================================================
// 5. WI-FI ACCESS POINT (PRIMARY MODE) & NETWORK DEFAULTS
// =============================================================================
// The ESP-12E operates as an autonomous, self-hosted Wi-Fi Access Point (AP)
// as the default and primary connection method. No internet, router, or external
// infrastructure is required.

#ifndef WIFI_AP_SSID
#define WIFI_AP_SSID                    "PanzerTank-AP"
#endif

// Private WPA2-PSK password. Minimum 8 characters.
// An open/unprotected network is NOT recommended to prevent unauthorized control.
#ifndef WIFI_AP_PASS
#define WIFI_AP_PASS                    "panzer123456"
#endif

#ifndef WIFI_AP_CHANNEL
#define WIFI_AP_CHANNEL                 1     // 2.4 GHz channel 1 (Scanned first by 100% of global mobile phones)
#endif

#ifndef WIFI_AP_MAX_CONN
#define WIFI_AP_MAX_CONN                4     // Maximum simultaneous phone/tablet clients
#endif

#ifndef WIFI_AP_HIDDEN
#define WIFI_AP_HIDDEN                  0     // 0 = Broadcast SSID, 1 = Hidden SSID
#endif

// Configurable Access Point Static IP Address (Default: 192.168.4.1)
#ifndef WIFI_AP_IP_OCT1
#define WIFI_AP_IP_OCT1                 192
#define WIFI_AP_IP_OCT2                 168
#define WIFI_AP_IP_OCT3                 4
#define WIFI_AP_IP_OCT4                 1
#endif

// Enable lightweight DNS captive assistant helper on port 53
#ifndef ENABLE_CAPTIVE_PORTAL_HELPER
#define ENABLE_CAPTIVE_PORTAL_HELPER    1
#endif

// Optional Station Wi-Fi Mode (Secondary override for developer/shared-network use)
#ifndef WIFI_STA_SSID
#define WIFI_STA_SSID                   ""
#endif
#ifndef WIFI_STA_PASS
#define WIFI_STA_PASS                   ""
#endif

#ifndef MDNS_HOSTNAME
#define MDNS_HOSTNAME                   "panzer"
#endif
#ifndef HTTP_PORT
#define HTTP_PORT                       80
#endif
#ifndef WS_PORT
#define WS_PORT                         81
#endif

#endif // CONFIG_H
