# KnexFlex — Knee Motion Tracking and Gait Analysis
**Developed by Andrew Metz**
I independently designed and assembled the wearable hardware, developed the gait-analysis methodology, and integrated the electronics and software into a functioning rehabilitation prototype.

KnexFlex is an affordable wearable device I developed to measure knee movement and analyze gait patterns during rehabilitation. The system combines an ESP32 microcontroller, magnetic rotary encoder, wireless data transmission, and custom gait-analysis software.

### Note
AI tools were used during portions of software development to help implement, debug, and refine code as well as some structural/design components of the website itself. I independently developed the underlying algorithms, mathematical formulas, and hardware design based on research and personally tested and iterated the completed system into the hardware.
## Where to Look

For MIT Maker Portfolio reviewers, I recommend focusing on these files:

### 1. Device Firmware and Web Server

**[Web_Server.ino](Web_Server_FINAL/Web_Server_FINAL.ino)**

The main microcontroller code. Reads knee-angle measurements from the AS5600 magnetic encoder, converts raw sensor values into degrees, creates a local Wi-Fi network, and transmits measurements through WebSockets.

**[app.js](Web_Server_FINAL/data/app.js)**

Handles live wireless data reception, real-time graphing, session recording, local storage, and data exporting.

### 2. Gait Analysis Algorithms

**[gaitAnalysis.ts](The%20Website/lib/gaitAnalysis.ts)**

My main gait-analysis algorithm. Detects individual walking gait cycles, filters irregular measurements, normalizes cycles, and calculates an average gait pattern.

**[gaitSimilarity.ts](The%20Website/lib/gaitSimilarity.ts)**

Compares recorded gait cycles using mathematical alignment and root mean square error (RMSE) calculations.

### 3. Movement Metrics

**[analytics.ts](The%20Website/lib/analytics.ts)** and **[analyticsPro.ts](The%20Website/lib/analyticsPro.ts)**

Calculate range of motion, angular velocity, acceleration, and other measurements from recorded knee movement.

### 4. Website and Visualization

**[Gait Lab](The%20Website/app/online/gait-lab/page.tsx)**

Connects the gait-analysis algorithms to interactive graphs for examining recorded movement.

**[Gait Similarity](The%20Website/app/online/gait-similarity/page.tsx)**

Allows users to compare gait patterns between recording sessions.

## Technologies Used

- **Hardware:** XIAO ESP32-C3, AS5600 magnetic rotary encoder
- **Firmware:** C++, Arduino, Wi-Fi, WebSockets
- **Website:** Next.js, React, TypeScript
- **Data:** Firebase, JavaScript, custom gait-analysis algorithms

## Project Goal

After experiencing multiple ACL injuries, I developed KnexFlex to make knee-motion tracking and gait analysis more affordable and accessible. The project combines mechanical design, embedded electronics, and software to turn raw knee-angle measurements into meaningful movement data.

**Recommended starting points: [Web_Server.ino](Web_Server_FINAL/Web_Server.ino) and [gaitAnalysis.ts](The%20Website/lib/gaitAnalysis.ts).**
