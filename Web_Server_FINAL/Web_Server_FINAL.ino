#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <LittleFS.h>


#define SDA_PIN 21
#define SCL_PIN 6
#define AS5600_ADDR 0x36
#define ANGLE_REG 0x0E
#define MAX_ANGLE 4096.0
#define CORRECTION_OFFSET 149.24
#define CORRECTION_THRESHOLD 300


const char* AP_SSID = "KnexFlex2";
const char* AP_PASS = "Metz";

WebServer server(80);
WebSocketsServer ws(81);


uint16_t readAS5600() {
  Wire.beginTransmission(AS5600_ADDR);
  Wire.write(ANGLE_REG);
  Wire.endTransmission();
  Wire.requestFrom(AS5600_ADDR, 2);
  if (Wire.available() == 2) {
    return (Wire.read() << 8) | Wire.read();
  }
  return 0;
}

float calculateDegrees(uint16_t raw) {
  float angle = (raw * 360.0) / MAX_ANGLE;
  return (angle < CORRECTION_THRESHOLD)
    ? (angle - CORRECTION_OFFSET) * -1
    : ((angle - 360) - CORRECTION_OFFSET) * -1;
}

void serveFile(const String& path, const String& type) {
  if (!LittleFS.exists(path)) {
    server.send(404, "text/plain", "Not found");
    return;
  }
  File f = LittleFS.open(path, "r");
  server.streamFile(f, type);
  f.close();
}


void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);

  // FS
  LittleFS.begin(true);

  // WiFi AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());

  // HTTP routes
  server.on("/", []() { serveFile("/index.html", "text/html"); });
  server.on("/app.js", []() { serveFile("/app.js", "application/javascript"); });
  server.on("/style.css", []() { serveFile("/style.css", "text/css"); });
  server.begin();

  // WebSocket
  ws.begin();
}

void loop() {
  server.handleClient();
  ws.loop();

  static unsigned long last = 0;
  if (micros() - last >= 10000) { //  Hz
    last = micros();
    float angle = calculateDegrees(readAS5600());
    char buf[12];
    dtostrf(angle, 7, 2, buf);
    ws.broadcastTXT(buf);
  }
}



