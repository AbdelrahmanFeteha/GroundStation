# Ground Station – Drone-Based Concrete Inspection System

**Senior Design Project II**  
Department of Electrical & Computer Engineering

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Software Implementation](#3-software-implementation)
   - 3.1 [Backend – Flask REST API](#31-backend--flask-rest-api)
   - 3.2 [Frontend – React Dashboard](#32-frontend--react-dashboard)
4. [Inspection Data Model](#4-inspection-data-model)
5. [Machine Learning Pipeline](#5-machine-learning-pipeline)
6. [Integration and Deployment](#6-integration-and-deployment)
7. [API Reference](#7-api-reference)
8. [Running the System](#8-running-the-system)
9. [Simulation Mode](#9-simulation-mode)
10. [Future Work](#10-future-work)

---

## 1. System Overview

This ground station supports an RC-controlled drone that performs automated structural inspection of concrete surfaces. The drone carries an NVIDIA Jetson onboard computer equipped with a camera, microphone, and an impactor actuator. The ground station provides the operator interface and the communication hub between the operator and the Jetson.

The inspection method is **impact sounding** — a hammer-like actuator strikes the concrete surface, and the resulting acoustic response (combined with a visual image of the surface) is analysed by machine learning models running on the Jetson to detect subsurface cracks, voids, and surface fractures.

There is no Pixhawk integration and no autonomous flight. The pilot flies the drone manually via RC. The operator's only job via this ground station is to trigger inspection cycles and review results in real time.

```
Pilot (RC remote)    →  Manual drone positioning
Operator (UI)        →  Trigger inspection / view results
Jetson (onboard)     →  Capture → Analyse → Upload results
Ground Station API   →  Command relay + result storage
```

---

## 2. Architecture

### Component Roles

| Component | Technology | Role |
|-----------|-----------|------|
| Ground Station Frontend | React (SPA) | Operator dashboard — commands, inspection log, result display |
| Ground Station Backend | Flask (Python) | REST API hub — command relay, file storage, state machine |
| NVIDIA Jetson | Python on Linux | Onboard computer — sensor capture, ML inference, result upload |
| Camera | MIPI/USB camera | Visual inspection image capture |
| Microphone | USB/analog mic | Acoustic response recording after impactor strike |
| Impactor Actuator | GPIO/relay controlled | Mechanical tap on concrete surface |

### Communication Flow

```
Operator clicks "BEGIN INSPECTION"
        ↓
Frontend  →  POST /command {"type": "begin_inspection"}  →  Backend
                                                               ↓
                                              system_state = "INSPECTING"
                                                               ↓
Jetson polls  →  GET /command  →  Backend returns command
        ↓
Jetson executes:
  1. Activates impactor (GPIO)
  2. Records audio (microphone, WAV)
  3. Captures image (camera, JPEG)
  4. Runs audio ML model  → has_crack, confidence, dominant_frequency_hz
  5. Runs visual ML model → has_crack, confidence, severity, crack geometry
  6. Generates mel spectrogram (PNG) from WAV
  7. Base64-encodes WAV + spectrogram + visual image
        ↓
Jetson  →  POST /inspection  →  Backend
                                  ↓
                   Decodes and saves files to disk
                   Stores inspection record in memory
                   Resets system_state = "IDLE"
                                  ↓
Frontend polls  →  GET /inspections  →  renders results
```

### Network Topology

All three components (frontend browser, Flask backend, Jetson) operate on the **same local Wi-Fi network**. The backend binds to `0.0.0.0:5000`, making it reachable at the laptop's LAN IP address (e.g. `192.168.1.25:5000`). The Jetson is configured with this IP. The frontend runs on the same laptop at `localhost:3000` and communicates with `localhost:5000`.

---

## 3. Software Implementation

### 3.1 Backend – Flask REST API

**File:** `backend/app.py`

The backend is a single-file Flask application. It acts as the central state machine and data store for the system. There is intentionally no database — all state is kept in-memory for simplicity and low-latency access. This is appropriate for a single-session inspection deployment.

#### Entities (In-Memory State)

```python
system_state        # str  — "IDLE" | "INSPECTING"
current_command     # dict — the last command issued by the operator
inspections         # list — all inspection records accumulated in the session
latest_telemetry    # dict — most recent telemetry from the Jetson
inspection_started_at  # float — Unix timestamp of when INSPECTING began
```

#### State Machine

The backend implements a two-state machine:

```
IDLE  ──→  INSPECTING  ──→  IDLE
      (command issued)    (result received or timeout)
```

Transitions:
- `IDLE → INSPECTING`: triggered by a `POST /command` with type `begin_inspection`, `simulate_cracked`, or `simulate_intact`
- `INSPECTING → IDLE`: triggered automatically when the Jetson posts a result via `POST /inspection`, or after a **10-second timeout** (see `check_timeout()`)

The timeout mechanism prevents the system from being stuck in `INSPECTING` if the Jetson fails to respond. It is evaluated lazily — checked on each `GET /command` and `GET /system_status` call rather than via a background thread, avoiding concurrency complexity.

```python
def check_timeout():
    if system_state == "INSPECTING" and inspection_started_at:
        if time.time() - inspection_started_at > 10:
            system_state = "IDLE"
            current_command = {"type": "none"}
            inspection_started_at = None
```

#### Functions

| Function | Route | Method | Description |
|----------|-------|--------|-------------|
| `ping` | `/ping` | GET | Health check — returns `{"status": "ok"}` |
| `set_command` | `/command` | POST | Operator issues a command; updates state machine |
| `get_command` | `/command` | GET | Jetson polls for the latest command |
| `add_inspection` | `/inspection` | POST | Jetson uploads full inspection result |
| `get_inspections` | `/inspections` | GET | Frontend fetches all stored inspections |
| `get_single_inspection` | `/inspection/<id>` | GET | Fetch one inspection by ID |
| `serve_image` | `/images/<filename>` | GET | Serve stored JPEG images |
| `serve_audio` | `/audio/<filename>` | GET | Serve stored WAV audio files |
| `serve_spectrogram` | `/spectrograms/<filename>` | GET | Serve stored spectrogram PNGs |
| `receive_telemetry` | `/telemetry` | POST | Jetson pushes system telemetry |
| `get_telemetry` | `/telemetry` | GET | Frontend fetches latest telemetry |
| `system_status` | `/system_status` | GET | Returns state, current command, and inspection count |

#### File Storage

Binary payloads (images, audio, spectrograms) are transported as **base64-encoded strings** inside the JSON body of `POST /inspection`. The backend decodes each field and writes it to the appropriate folder on disk. The base64 string is then discarded and replaced with a URL path in the stored record, keeping the in-memory inspection records small.

```
backend/
├── images/          ← JPEG frames (raw + visual model annotated)
├── audio/           ← WAV recordings from the microphone
└── spectrograms/    ← PNG mel spectrograms generated on the Jetson
```

Each file is named after the `inspection_id` (e.g. `insp_1744484000000.wav`). The visual model image uses the suffix `_visual.jpg` and the spectrogram uses `_spectrogram.png`.

The `visual` sub-object is handled specially: its `image` field is extracted, decoded, and saved separately, then replaced with `image_url` before the object is stored in the inspection record. The rest of the `visual` fields (ML outputs and geometry) are stored as-is.

#### CORS

`flask-cors` is applied globally (`CORS(app)`) to allow the React frontend running on `localhost:3000` to make requests to `localhost:5000` without browser cross-origin restrictions.

---

### 3.2 Frontend – React Dashboard

**Directory:** `frontend/src/`

The frontend is a single-page React application with no routing. It polls the backend every second to keep the display live. All state is managed via React `useState` hooks at the `App` component level and passed down to child components as props — no external state library is used.

#### Component Structure

```
App.js                  — Root component, polling logic, command handlers, state owner
├── ControlBar.js       — Operator command buttons + system state indicator
├── InspectionList.js   — Scrollable list of past inspections; click to select
├── VisionPanel.js      — Visual ML results: image, severity badge, geometry table
└── AcousticPanel.js    — Audio ML results: playback, crack decision, spectrogram
```

#### App.js — Polling and State

`App.js` owns three pieces of state:

```javascript
status              // system_state + inspection_count from /system_status
inspections         // full list of inspection records from /inspections
selectedInspection  // the record the operator has clicked on
```

A `useEffect` hook starts a `setInterval` on mount that fires every 1000ms, refreshing both `status` and `inspections`. This gives the operator near-real-time feedback as the Jetson uploads results. All command functions use a shared helper:

```javascript
const sendCommand = (type) => {
  fetch("http://localhost:5000/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type })
  });
};
```

Three command handlers are wired to buttons: `begin_inspection`, `simulate_cracked`, `simulate_intact`.

#### ControlBar.js — Interface

Displays the current `system_state` with colour coding (grey = IDLE, green = INSPECTING) and three action buttons:

- **BEGIN INSPECTION** (green) — triggers a live inspection cycle on the Jetson
- **SIMULATE CRACKED** (red) — instructs the Jetson to run the pipeline using pre-stored cracked samples
- **SIMULATE INTACT** (blue) — instructs the Jetson to run the pipeline using pre-stored intact samples

#### InspectionList.js — Interface

Renders the accumulated inspection records as a clickable list. The selected item is highlighted with a blue background. Each item shows the `inspection_id` and `height_cm`. Clicking an item sets `selectedInspection` in `App.js`, which cascades to `VisionPanel` and `AcousticPanel`.

#### VisionPanel.js — Visual Results

Displays the contents of `selectedInspection.visual` — the output of the visual crack detection model:

- **Crack image** — the JPEG frame from the camera, served from `/images/<id>_visual.jpg`
- **Crack Detected** — boolean, coloured red (Yes) or green (No)
- **Severity badge** — pill-shaped badge with colour coding:
  - `Minor` — dark green background, green text
  - `Moderate` — dark amber background, amber text
  - `Severe` — dark red background, red text
- **Confidence in result** — softmax probability of the predicted class, expressed as a percentage
- **Inference time** — seconds taken by the visual model on the Jetson
- **Crack geometry table** — shown only when `has_crack` is true; displays mask area, skeleton length, average width, maximum width, and branch point count

Falls back gracefully if the `visual` object is absent (legacy inspection records without visual data).

#### AcousticPanel.js — Acoustic Results

Displays the output of the audio 1D CNN model and the associated audio data:

- **Inspection ID** label
- **Play / Pause button** — controls an HTML `<audio>` element pointed at `/audio/<id>.wav`. Playback state resets automatically when a different inspection is selected (via `useEffect` on `selectedInspection`)
- **Crack Detected** — from the audio model, coloured red/green
- **Confidence in result** — softmax probability of the audio model's predicted class, as a percentage
- **Dominant Frequency** — FFT peak frequency of the full audio signal in Hz; shown only if present
- **Mel spectrogram image** — PNG rendered from the WAV file by the Jetson using `librosa`, served from `/spectrograms/<id>_spectrogram.png`

---

## 4. Inspection Data Model

Each inspection record stored by the backend has the following structure. All fields marked optional are absent or `null` if not sent by the Jetson.

```json
{
  "inspection_id":          "insp_1744484000000",
  "timestamp":              "2026-04-12T14:32:00",
  "height_cm":              120,

  "has_crack":              true,
  "confidence":             0.94,
  "dominant_frequency_hz":  3200.5,

  "image_url":              "/images/insp_1744484000000.jpg",
  "audio_url":              "/audio/insp_1744484000000.wav",
  "spectrogram_url":        "/spectrograms/insp_1744484000000_spectrogram.png",

  "visual": {
    "has_crack":            true,
    "confidence":           0.91,
    "severity_score":       0.42,
    "severity_level":       "Moderate",
    "crack_geometry": {
      "mask_area_px":       1840,
      "length_px":          312,
      "avg_width_px":       5.8,
      "max_width_px":       11.2,
      "branch_points":      3
    },
    "inference_seconds":    0.34,
    "image_url":            "/images/insp_1744484000000_visual.jpg"
  }
}
```

**Top-level acoustic fields** (`has_crack`, `confidence`, `dominant_frequency_hz`) come from the audio 1D CNN model.  
**`visual` object** contains all outputs of the visual crack detection model, including the annotated image URL and crack geometry metrics.  
When `has_crack` is `false`, `severity_score`, `severity_level`, and all `crack_geometry` sub-fields are `null`.

---

## 5. Machine Learning Pipeline

Both ML models run entirely on the Jetson — the ground station receives only the final numerical results and encoded media files.

### 5.1 Audio Model — 1D CNN Crack Detection

**Source repository:** [ImpactSounding](https://github.com/shafie25/ImpactSounding)  
**File used:** `Classifier_1DCNN.py` (model class) + `Classifier Results/CrackDetection/CNN_1D/best_model.pt` (trained weights)

**Architecture:**

```
Input: (1, 4410) — raw mono waveform at 22,050 Hz, 0.20 s window
  ↓ Conv1d(1→32,  kernel=64, stride=4) + BatchNorm + ReLU
  ↓ Conv1d(32→64, kernel=32, stride=2) + BatchNorm + ReLU
  ↓ Conv1d(64→128,kernel=16, stride=2) + BatchNorm + ReLU
  ↓ Conv1d(128→256,kernel=8, stride=2) + BatchNorm + ReLU
  ↓ AdaptiveAvgPool1d(1)
  ↓ Linear(256→64) + ReLU + Dropout(0.3)
  ↓ Linear(64→2)
Output: logits for [Intact, Cracked]
```

**Inference procedure:**
1. Load WAV with `librosa.load(path, sr=22050, mono=True)`
2. Segment the full signal into non-overlapping 4,410-sample chunks
3. Run each chunk through the model; collect softmax probabilities
4. Apply majority voting across all chunks to determine the final class
5. Report the average softmax probability of the winning class as `confidence`
6. Compute FFT on the full signal; report the peak frequency bin (excluding DC) as `dominant_frequency_hz`

**Reported performance on test set:** Accuracy 99.75%, F1 99.31%

**Output fields sent to backend:**

| Field | Type | Description |
|-------|------|-------------|
| `has_crack` | bool | True = Cracked, False = Intact |
| `confidence` | float 0–1 | Softmax probability of the predicted class |
| `dominant_frequency_hz` | float | FFT peak frequency of the impact signal |

### 5.2 Visual Model — Image-Based Crack Detection

The visual model runs on the camera image captured at the time of inspection. It outputs a binary crack detection result along with severity classification and geometric crack characterisation.

**Output fields sent inside the `visual` object:**

| Field | Type | Description |
|-------|------|-------------|
| `has_crack` | bool | Whether a crack is detected in the image |
| `confidence` | float 0–1 | Softmax probability of the predicted class |
| `severity_score` | float 0–1 | Continuous severity estimate (null if no crack) |
| `severity_level` | string | `"Minor"` / `"Moderate"` / `"Severe"` (null if no crack) |
| `crack_geometry.mask_area_px` | int | Total crack pixel area in the segmentation mask |
| `crack_geometry.length_px` | int | Crack skeleton length in pixels |
| `crack_geometry.avg_width_px` | float | Mean crack width in pixels |
| `crack_geometry.max_width_px` | float | Maximum crack width in pixels |
| `crack_geometry.branch_points` | int | Number of branching points in the skeleton |
| `inference_seconds` | float | Wall-clock time of model inference |

### 5.3 Spectrogram Generation

After recording the audio, the Jetson generates a **mel spectrogram** PNG entirely in memory (no disk write) using `librosa` and `matplotlib`:

- `librosa.feature.melspectrogram(y, sr=22050, n_mels=128)`
- Converted to dB scale: `librosa.power_to_db(S, ref=np.max)`
- Rendered with `librosa.display.specshow`, axes and whitespace stripped
- Buffered via `io.BytesIO`, base64-encoded, and sent as the `spectrogram` field

The ground station backend saves this PNG and serves it at `/spectrograms/<id>_spectrogram.png`. The frontend renders it as an image in the Acoustic panel below the playback button.

---

## 6. Integration and Deployment

### 6.1 Networking

The system uses a **flat local Wi-Fi network** with no internet dependency. All devices (operator laptop + Jetson) connect to the same access point.

| Device | Role | Address |
|--------|------|---------|
| Operator Laptop | Backend + Frontend host | `192.168.x.x:5000` (backend), `localhost:3000` (frontend) |
| NVIDIA Jetson | Onboard inspection computer | `192.168.x.x` (DHCP or static) |

The backend binds to `0.0.0.0:5000` so it accepts connections on all network interfaces — the Jetson reaches it via the laptop's LAN IP. The frontend runs on the same machine as the backend, so it accesses it via `localhost:5000`.

**Polling interval:** The Jetson polls `GET /command` on a short interval (e.g. 500ms–1s) to detect new commands quickly. The frontend polls `GET /system_status` and `GET /inspections` every 1000ms to keep the UI live.

**Timeout:** If the Jetson fails to deliver a result within 10 seconds of a command being issued, the backend automatically resets to `IDLE`. This prevents the operator from being locked out if the Jetson crashes mid-inspection.

### 6.2 Data Transport

Binary data (images, audio, spectrograms) is transported inside the JSON body of `POST /inspection` as base64-encoded strings. This avoids multipart form handling and keeps the entire inspection result — metadata, ML outputs, and all media — in a single atomic HTTP request.

Base64 encoding adds approximately 33% overhead over raw binary. For typical inspection payloads (a JPEG frame ~100–300 KB, a 0.5s WAV ~44 KB, a spectrogram PNG ~30–80 KB), the total encoded payload is typically under 1 MB, well within the capacity of a local Wi-Fi link.

The backend strips the base64 strings immediately after decoding, so in-memory inspection records remain small and `GET /inspections` responses stay fast regardless of the number of accumulated inspections.

### 6.3 Embedding — Jetson Integration

The Jetson runs a Python script that handles the full onboard pipeline. It integrates with the ground station via four HTTP calls:

| Call | Direction | Purpose |
|------|-----------|---------|
| `GET /command` | Jetson → Backend | Poll for operator commands |
| `POST /inspection` | Jetson → Backend | Upload full inspection result |
| `POST /telemetry` | Jetson → Backend | Push Jetson system metrics (CPU, temp, stage) |

The Jetson script is stateless with respect to the ground station — it simply polls, reacts to commands, and uploads. No persistent connection (WebSocket, etc.) is required. This makes the Jetson script resilient to backend restarts.

### 6.4 Simulation Mode

To support testing without a physical drone, the system implements a simulation mode controlled via the ground station UI. Two command types — `simulate_cracked` and `simulate_intact` — instruct the Jetson to substitute pre-stored sample WAV and JPEG files for live sensor input, then run the full pipeline (ML inference, spectrogram generation, encoding, POST) on those samples. The backend treats simulation results identically to live results. This allows end-to-end validation of the entire data pipeline from command issuance to result display without requiring the drone to be airborne.

---

## 7. API Reference

### Command Types

| Type | Effect |
|------|--------|
| `begin_inspection` | Live inspection — Jetson uses camera and mic |
| `simulate_cracked` | Simulation — Jetson uses pre-stored cracked samples |
| `simulate_intact` | Simulation — Jetson uses pre-stored intact samples |
| `clear` | Manually resets state to IDLE |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ping` | Health check |
| GET | `/system_status` | State machine status + inspection count |
| POST | `/command` | Issue a command |
| GET | `/command` | Poll latest command (Jetson) |
| POST | `/inspection` | Upload inspection result |
| GET | `/inspections` | List all inspections |
| GET | `/inspection/<id>` | Single inspection by ID |
| GET | `/images/<filename>` | Serve image file |
| GET | `/audio/<filename>` | Serve audio file |
| GET | `/spectrograms/<filename>` | Serve spectrogram file |
| POST | `/telemetry` | Receive Jetson telemetry |
| GET | `/telemetry` | Fetch latest telemetry |

Full request/response shapes are documented in [API_SPEC.md](API_SPEC.md).

---

## 8. Running the System

### Prerequisites

- Python 3.10+
- Node.js 18+
- Both laptop and Jetson on the same Wi-Fi network

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Server starts at `http://0.0.0.0:5000`.  
Find your laptop's LAN IP (`ipconfig` on Windows / `ip a` on Linux) and configure the Jetson to use `http://<LAPTOP_IP>:5000`.

### Frontend

```bash
cd frontend
npm install
npm start
```

Dashboard opens at `http://localhost:3000`.

---

## 9. Simulation Mode

Two buttons in the control bar trigger simulation without a live drone:

- **SIMULATE CRACKED** — sends `simulate_cracked` command. Jetson runs its full pipeline on a pre-stored cracked WAV and JPEG, then uploads results normally.
- **SIMULATE INTACT** — sends `simulate_intact` command. Same process with intact samples.

Results appear in the inspection list and panels identically to live inspections. Useful for demonstrating the system, testing the UI, and validating the ML pipeline without flight.

---

## 10. Future Work

- **Persistent storage** — replace in-memory lists with SQLite or PostgreSQL so inspection history survives backend restarts
- **Real-time Jetson telemetry panel** — display CPU load, temperature, and inspection stage progress in the UI
- **Acoustic waveform visualisation** — render the raw waveform alongside the spectrogram in the Acoustic panel
- **Inspection report export** — generate a PDF summary of a session's inspections with images and ML results
- **User authentication** — restrict access to the ground station UI in multi-operator environments
- **Cloud sync** — upload completed inspections to cloud storage for long-term archiving and remote access
- **Crack severity calibration** — map pixel-space geometry metrics (length, width) to physical units using known camera parameters and inspection height
