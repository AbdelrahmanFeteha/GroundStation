# Ground Station – Drone-Based Concrete Inspection

Senior Design Project II  
Department of Electrical & Computer Engineering

A web-based ground station for commanding an RC drone to perform automated concrete inspections using an onboard NVIDIA Jetson.

---

## Overview

The system lets a ground operator trigger inspection cycles on a hovering drone without any flight control integration. The pilot manually positions the drone; the operator fires inspection commands from the UI. The Jetson onboard handles everything else — image capture, impactor actuation, audio recording, and result upload.

```
Pilot (RC remote)  →  Drone positioning
Operator (UI)      →  Begin Inspection command
Jetson (onboard)   →  Capture → Actuate → Analyze → Upload
```

---

## System Architecture

| Component | Role |
|-----------|------|
| React Frontend | Operator dashboard (commands, telemetry, inspection log) |
| Flask Backend | REST API hub between UI and Jetson |
| NVIDIA Jetson | Onboard computer — runs capture, impactor, inference |
| Camera | Visual inspection image |
| Microphone | Acoustic tap-test recording |
| Impactor Actuator | Physical tap via GPIO/relay |

> No Pixhawk. No STM32. No flight control from ground station.

---

## Repo Structure

```
SD2-Ground-Station/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── encode.py           # Base64 image encoding utility
│   ├── requirements.txt    # Python dependencies
│   └── images/             # Runtime inspection image storage
│       ├── 002.jpg         # Sample reference image
│       └── insp_1772566449.jpg  # Sample inspection result
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── Dashboard.js / Dashboard.css
│   │   └── components/
│   │       ├── ControlBar.js      # Command buttons
│   │       ├── InspectionList.js  # Inspection history log
│   │       ├── VisionPanel.js     # Live image viewer
│   │       └── AcousticPanel.js   # Audio/waveform display
│   └── public/
├── API_SPEC.md             # Full REST API reference
└── requirements.txt        # Top-level dependency list
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Both the ground station laptop and the Jetson on the **same Wi-Fi network**

---

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs at `http://0.0.0.0:5000`  
Jetson should point to `http://<LAPTOP_IP>:5000`

---

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`

---

## Inspection Workflow

1. Pilot flies drone to inspection target and holds position.
2. Operator clicks **Begin Inspection** in the UI.
3. Backend sets `system_state = INSPECTING`.
4. Jetson polls `GET /command`, detects `begin_inspection`.
5. Jetson executes:
   - Captures image (camera)
   - Activates impactor (GPIO/relay)
   - Records audio (microphone)
   - Optionally runs local crack-detection inference
6. Jetson posts results to `POST /inspection` (with optional base64 image).
7. Backend stores the result, resets state to `IDLE`.
8. Result appears in the Ground Station UI instantly.

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Health check |
| GET | `/system_status` | Current state + inspection count |
| POST | `/command` | Send command from UI (`begin_inspection`, `clear`) |
| GET | `/command` | Jetson polls for latest command |
| POST | `/inspection` | Jetson uploads inspection result + image |
| GET | `/inspections` | Retrieve all stored inspections |
| GET | `/inspection/<id>` | Retrieve single inspection |
| GET | `/images/<filename>` | Serve stored inspection images |
| POST | `/telemetry` | Jetson pushes system telemetry |
| GET | `/telemetry` | UI fetches latest Jetson telemetry |

Full details in [API_SPEC.md](API_SPEC.md).

---

## System States

| State | Meaning |
|-------|---------|
| `IDLE` | Waiting for operator command |
| `INSPECTING` | Jetson is executing an inspection cycle |

A 10-second timeout auto-resets state to `IDLE` if Jetson doesn't respond.

---

## Tech Stack

- **Frontend:** React
- **Backend:** Flask, flask-cors
- **Transport:** REST over local Wi-Fi (JSON + Base64 images)
- **Onboard:** NVIDIA Jetson, Python, direct GPIO control

---

## Future Work

- Persistent inspection database (SQLite / PostgreSQL)
- Real-time acoustic waveform visualization
- Automated crack severity grading
- Cloud sync and inspection report export
- User authentication for multi-operator support
