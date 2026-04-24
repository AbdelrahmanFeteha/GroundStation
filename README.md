# Drone-Based Concrete Inspection — Ground Station

> Senior Design Project II · Department of Electrical & Computer Engineering

A web-based ground station for commanding an RC drone to perform automated non-destructive inspection of concrete structures. The operator issues inspection commands through a real-time dashboard; an onboard NVIDIA Jetson executes the full capture and analysis pipeline and uploads results back to the ground station.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Inspection Payload](#inspection-payload)
- [Simulation Mode](#simulation-mode)

---

## Overview

The system detects both **surface cracks** (visual) and **subsurface defects** (acoustic) in concrete structures such as bridge columns and overpasses. A pilot manually flies the drone to the inspection target; the operator then triggers an inspection cycle from the ground station UI. The Jetson autonomously handles the rest — activating the impactor, recording audio, capturing an image, running ML inference, and uploading all results over Wi-Fi.

---

## System Architecture

```
Pilot (RC remote)       →   Manual drone positioning
Operator (Ground Station UI)  →   Issue inspection command
Jetson (onboard)        →   Capture → Infer → Upload
Flask Backend           →   Command relay + result storage
React Frontend          →   Real-time dashboard
SQLite Database         →   Persistent inspection records
```

**Network:** All components share the same local Wi-Fi network. The Flask backend binds to `0.0.0.0:5000`, making it reachable from the Jetson via the laptop's LAN IP (e.g. `192.168.1.25:5000`).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (SPA, polling every 1s) |
| Backend | Flask + Flask-CORS |
| Database | SQLite via Flask-SQLAlchemy |
| Audio ML | 1D CNN (PyTorch) — trained on impact sounding data |
| Visual ML | Image-based crack detection model |
| Transport | REST over HTTP, binary files as base64 JSON |

---

## Project Structure

```
SD2-Ground-Station/
├── backend/
│   ├── app.py              # Flask REST API + state machine
│   ├── models.py           # SQLAlchemy models (Inspection, AcousticResult, VisualResult, CrackGeometry)
│   ├── requirements.txt    # Python dependencies
│   ├── images/             # Saved JPEG frames
│   ├── audio/              # Saved WAV recordings
│   └── spectrograms/       # Saved mel spectrogram PNGs
├── frontend/
│   └── src/
│       ├── App.js                      # Root component, polling, command handlers
│       ├── components/
│       │   ├── ControlBar.js           # Command buttons + system state
│       │   ├── InspectionList.js       # Clickable inspection history
│       │   ├── VisionPanel.js          # Visual ML results + crack geometry
│       │   └── AcousticPanel.js        # Audio playback + ML results + spectrogram
│       ├── Dashboard.css
│       └── index.js
├── API_SPEC.md
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Laptop and Jetson on the **same Wi-Fi network**

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python app.py
```

Backend starts at `http://0.0.0.0:5000`.  
The SQLite database (`groundstation.db`) is created automatically on first run.  
Find your laptop's LAN IP and configure the Jetson to POST to `http://<LAPTOP_IP>:5000`.

### Frontend

```bash
cd frontend
npm install
npm start
```

Dashboard opens at `http://localhost:3000`.

---

## How It Works

### Inspection Flow

```
1. Operator clicks BEGIN INSPECTION
        ↓
2. Backend sets system_state = "INSPECTING"
        ↓
3. Jetson polls GET /command, detects begin_inspection
        ↓
4. Jetson executes:
   - Activates impactor (GPIO)
   - Records audio (WAV, 22050 Hz)
   - Captures image (JPEG)
   - Runs audio 1D CNN  →  has_crack, confidence, dominant_frequency_hz
   - Runs visual model  →  has_crack, confidence, crack geometry
   - Generates mel spectrogram (PNG, in-memory)
        ↓
5. Jetson POSTs all results to /inspection (base64-encoded media)
        ↓
6. Backend decodes files → saves to disk → writes to SQLite → resets to IDLE
        ↓
7. Frontend polls /inspections → displays results in real time
```

### State Machine

The backend runs a two-state machine:

| State | Meaning |
|-------|---------|
| `IDLE` | Waiting for operator command |
| `INSPECTING` | Jetson is executing an inspection cycle |

A **60-second timeout** automatically resets state to `IDLE` if the Jetson fails to upload results.

### UI Panels

| Panel | Content |
|-------|---------|
| **Inspection List** | Clickable log of all inspections in the session |
| **Vision Panel** | Crack image, crack detected (Yes/No), confidence, inference time, crack geometry table |
| **Acoustic Panel** | Audio playback (Play/Pause), crack detected, confidence, dominant frequency, mel spectrogram image |

---

## API Reference

### Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/command` | Issue a command from the UI |
| `GET` | `/command` | Jetson polls for the latest command |

**Command types:**

```json
{ "type": "begin_inspection" }
{ "type": "simulate_cracked" }
{ "type": "simulate_intact"  }
{ "type": "clear"            }
```

### Inspections

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/inspection` | Jetson uploads full inspection result |
| `GET` | `/inspections` | List all inspections (newest first) |
| `GET` | `/inspection/<id>` | Single inspection by ID |

### Media

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/images/<filename>` | Serve stored JPEG |
| `GET` | `/audio/<filename>` | Serve stored WAV |
| `GET` | `/spectrograms/<filename>` | Serve stored spectrogram PNG |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ping` | Health check |
| `GET` | `/system_status` | Current state + inspection count |
| `POST` | `/telemetry` | Jetson pushes system metrics |
| `GET` | `/telemetry` | Frontend fetches latest telemetry |

---

## Database Schema

All inspection data is persisted in a SQLite database managed through SQLAlchemy. Four tables, matching the ERD below.

### `inspections`
| Column | Type | Notes |
|--------|------|-------|
| `inspection_id` | String | **PK** — e.g. `insp_1744484000000` |
| `timestamp` | String | ISO 8601, set by Jetson |
| `height_cm` | Float | Drone height at inspection time |
| `created_at` | String | ISO 8601, set by Flask on receipt |

### `acoustic_results` — 1:1 with inspections
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK, autoincrement |
| `inspection_id` | String | FK → inspections |
| `has_crack` | Boolean | From audio 1D CNN |
| `confidence` | Float | Softmax probability of predicted class |
| `dominant_frequency_hz` | Float | FFT peak of impact signal (nullable) |
| `audio_url_path` | String | Served at `/audio/<filename>` (nullable) |
| `spectrogram_url_path` | String | Served at `/spectrograms/<filename>` (nullable) |

### `visual_results` — 1:1 with inspections
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK, autoincrement |
| `inspection_id` | String | FK → inspections |
| `has_crack` | Boolean | From visual model |
| `confidence` | Float | Softmax probability of predicted class |
| `severity_score` | Float | Continuous 0–1 severity (nullable) |
| `inference_seconds` | Float | Model inference time (nullable) |
| `image_url_path` | String | Served at `/images/<filename>` (nullable) |

### `crack_geometry` — 1:0..1 with visual_results (only when has_crack = true)
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK, autoincrement |
| `visual_result_id` | Integer | FK → visual_results |
| `mask_area_px` | Integer | Total crack pixels in segmentation mask |
| `length_px` | Integer | Crack skeleton length |
| `avg_width_px` | Float | Average crack width |
| `max_width_px` | Float | Maximum crack width |
| `branch_points` | Integer | Number of crack branching points |

---

## Inspection Payload

Full JSON body sent by the Jetson to `POST /inspection`:

```json
{
  "inspection_id": "insp_1744484000000",
  "timestamp": "2026-04-12T14:32:00",
  "height_cm": 120,
  "has_crack": true,
  "confidence": 0.94,
  "dominant_frequency_hz": 3200.5,
  "audio": "<base64 WAV>",
  "spectrogram": "<base64 PNG>",
  "visual": {
    "has_crack": true,
    "confidence": 0.91,
    "severity_score": 0.42,
    "inference_seconds": 0.34,
    "image": "<base64 JPEG>",
    "crack_geometry": {
      "mask_area_px": 1840,
      "length_px": 312,
      "avg_width_px": 5.8,
      "max_width_px": 11.2,
      "branch_points": 3
    }
  }
}
```

- `has_crack` + `confidence` at the top level come from the **audio 1D CNN**
- `visual.has_crack` + `visual.confidence` come from the **visual model**
- `confidence` always means: softmax probability of whichever class was predicted
- When `has_crack = false`, all `crack_geometry` fields and `severity_score` are `null`
- Base64 fields accept an optional data URI header (e.g. `data:audio/wav;base64,...`) which is stripped automatically

---

## Simulation Mode

Two buttons in the control bar allow end-to-end testing without a physical drone:

| Button | Command sent | Jetson behaviour |
|--------|-------------|-----------------|
| **SIMULATE CRACKED** | `simulate_cracked` | Uses pre-stored cracked sample audio + image |
| **SIMULATE INTACT** | `simulate_intact` | Uses pre-stored intact sample audio + image |

The Jetson runs the full pipeline (ML inference, spectrogram generation, encoding, POST) on the sample files. The ground station treats simulation results identically to live results — they are stored in the database and displayed in the UI normally.
