
# Drone-Based Concrete Inspection – Ground Station

Senior Design Project

This system performs automated concrete inspection using:

- RC-controlled drone
- NVIDIA Jetson (onboard computer)
- Camera
- Microphone
- Impactor actuator

There is:

- No Pixhawk integration
- No STM32 microcontroller
- No flight control interface from the Ground Station

The drone is manually flown via RC.

---

# System Architecture

Pilot (RC) → Drone Positioning
Ground Station → Triggers inspection cycle
Jetson → Executes inspection + uploads results

---

# Workflow

1. Pilot positions drone near inspection surface.
2. Operator clicks "BEGIN INSPECTION (JETSON)" in Ground Station UI.
3. Backend sets system_state = INSPECTING.
4. Jetson polls `/command` and detects begin_inspection.
5. Jetson:
   - Captures image
   - Activates impactor
   - Records audio
   - (Optional) runs inference
6. Jetson uploads results via `/inspection`.
7. Backend stores inspection and resets system_state to IDLE.
8. Results appear in UI.

---

# Tech Stack

Frontend:

- React

Backend:

- Flask
- REST API
- Base64 image storage

Onboard:

- NVIDIA Jetson
- Camera
- Microphone
- Direct actuator control (GPIO / relay)

---

# Running the System

## Backend

cd backend
python app.py

Server runs on:
http://0.0.0.0:5000

---

## Frontend

cd frontend
npm install
npm start

Runs on:
http://localhost:3000

---

# Key API Endpoints

GET /system_status
POST /command
GET /command
POST /inspection
GET /inspections

Full API details in:
API_SPEC.md

---

# System States

IDLE
INSPECTING

---

# Future Improvements

- Real-time Jetson telemetry dashboard
- Acoustic waveform visualization
- Inspection database persistence
- User authentication
- Cloud storage integration
