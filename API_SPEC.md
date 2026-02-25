
# Ground Station API Specification

This API defines communication between:

- React Ground Station (Frontend)
- Flask Backend (Ground Station API)
- Jetson (Onboard Inspection Computer)

The drone is manually controlled via RC.
There is no Pixhawk integration and no STM32.

The Jetson handles:

- Camera capture
- Microphone recording
- Impactor activation (directly)
- Optional local inference

---

# Base URL

http://<GROUND_STATION_IP>:5000

Example:
http://192.168.1.25:5000

---

# 1. Health Check

## GET /ping

Returns basic server health.

Response:
{
  "status": "ok"
}

---

# 2. System Status

## GET /system_status

Returns current system state and inspection count.

Response:
{
  "system_state": "IDLE",
  "current_command": { "type": "none" },
  "inspection_count": 3
}

System States:

- IDLE
- INSPECTING

---

# 3. Commands

## POST /command

Used by the Ground Station UI to trigger Jetson actions.

Request Body:
{
  "type": "begin_inspection"
}

Valid Commands:

- begin_inspection
- clear

Response:
{
  "status": "accepted",
  "system_state": "INSPECTING",
  "command": { "type": "begin_inspection" }
}

---

## GET /command

Used by Jetson to poll the latest command.

Response:
{
  "system_state": "INSPECTING",
  "command": { "type": "begin_inspection" }
}

---

# 4. Inspections

## POST /inspection

Used by Jetson to upload inspection results.

Required Fields:

- inspection_id (string)
- timestamp (string)
- height_cm (number)
- has_crack (boolean)
- confidence (number)

Optional:

- image (base64 string)

Example Request:
{
  "inspection_id": "insp_001",
  "timestamp": "2026-02-25T14:32:00",
  "height_cm": 120,
  "has_crack": true,
  "confidence": 0.91,
  "image": "`<base64-encoded-image>`"
}

Response:
{
  "status": "stored"
}

After storing:

- system_state is reset to IDLE
- current_command is cleared

---

## GET /inspections

Returns list of all inspections.

Response:
[
  {
    "inspection_id": "insp_001",
    "timestamp": "...",
    "height_cm": 120,
    "has_crack": true,
    "confidence": 0.91,
    "image_url": "/images/insp_001.jpg"
  }
]

---

## GET /inspection/<inspection_id>

Returns a single inspection.

---

# 5. Images

## GET /images/`<filename>`

Serves stored inspection images.

Example:
http://`<ip>`:5000/images/insp_001.jpg

---

# 6. Telemetry (Optional)

Telemetry now refers to Jetson system/inspection telemetry,
NOT drone flight telemetry.

## POST /telemetry

Jetson → Backend

## GET /telemetry

Frontend → Backend

Example telemetry:
{
  "jetson_cpu_percent": 42,
  "jetson_temp_c": 55,
  "inspection_stage": "recording_audio",
  "progress_percent": 60
}
