from flask import Flask, request, jsonify, send_from_directory
import os
import time
import base64
from datetime import datetime, timezone
from flask_cors import CORS
from models import db, Inspection, AcousticResult, VisualResult, CrackGeometry

app = Flask(__name__)
CORS(app)

# -------------------------------------------------
# Database Configuration
# -------------------------------------------------

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///groundstation.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "connect_args": {
        "check_same_thread": False,
        "timeout": 30,
    }
}

db.init_app(app)

with app.app_context():
    db.create_all()
    db.session.execute(db.text("PRAGMA journal_mode=WAL"))
    db.session.commit()

@app.teardown_appcontext
def shutdown_session(_exception=None):
    db.session.remove()

# -------------------------------------------------
# In-Memory State
# -------------------------------------------------

system_state          = "IDLE"
current_command       = {"type": "none"}
latest_telemetry      = {}
inspection_started_at = None
SESSION_START         = datetime.now(timezone.utc).isoformat()

# Folders to store images, audio, and spectrograms
IMAGE_FOLDER       = "images"
AUDIO_FOLDER       = "audio"
SPECTROGRAM_FOLDER = "spectrograms"
os.makedirs(IMAGE_FOLDER,       exist_ok=True)
os.makedirs(AUDIO_FOLDER,       exist_ok=True)
os.makedirs(SPECTROGRAM_FOLDER, exist_ok=True)


# -------------------------------------------------
# Basic Health Check
# -------------------------------------------------

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok"})


def check_timeout():
    global system_state, current_command, inspection_started_at

    if system_state == "INSPECTING" and inspection_started_at:
        if time.time() - inspection_started_at > 60:
            print("TIMEOUT → resetting")
            system_state          = "IDLE"
            current_command       = {"type": "none"}
            inspection_started_at = None


# -------------------------------------------------
# COMMANDS
# -------------------------------------------------

@app.route("/command", methods=["POST"])
def set_command():
    global current_command, system_state, inspection_started_at

    data = request.json
    if not data or "type" not in data:
        return jsonify({"status": "error", "message": "Invalid command"}), 400

    cmd_type        = data["type"]
    current_command = data

    if cmd_type in ("begin_inspection", "simulate_cracked", "simulate_intact"):
        system_state          = "INSPECTING"
        inspection_started_at = time.time()

    elif cmd_type == "clear":
        system_state    = "IDLE"
        current_command = {"type": "none"}

    else:
        return jsonify({"status": "error", "message": f"Unknown command: {cmd_type}"}), 400

    return jsonify({"status": "accepted", "system_state": system_state, "command": current_command})


@app.route("/command", methods=["GET"])
def get_command():
    check_timeout()
    return jsonify({"system_state": system_state, "command": current_command})


# -------------------------------------------------
# INSPECTIONS
# -------------------------------------------------

@app.route("/inspection", methods=["POST"])
def add_inspection():
    global system_state, current_command, inspection_started_at

    data = request.json

    required_fields = ["inspection_id", "timestamp", "height_cm", "has_crack", "confidence"]

    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    for field in required_fields:
        if field not in data:
            return jsonify({"status": "error", "message": f"Missing field: {field}"}), 400

    # Handle optional base64 audio
    audio_url = None
    if "audio" in data:
        try:
            audio_data = data["audio"]
            if "base64," in audio_data:
                audio_data = audio_data.split("base64,")[1]
            audio_bytes = base64.b64decode(audio_data)
            filename    = f"{data['inspection_id']}.wav"
            with open(os.path.join(AUDIO_FOLDER, filename), "wb") as f:
                f.write(audio_bytes)
            audio_url = f"/audio/{filename}"
        except Exception as e:
            return jsonify({"status": "error", "message": f"Audio decoding failed: {str(e)}"}), 400

    # Handle optional base64 spectrogram
    spectrogram_url = None
    if "spectrogram" in data:
        try:
            spec_data = data["spectrogram"]
            if "base64," in spec_data:
                spec_data = spec_data.split("base64,")[1]
            spec_bytes = base64.b64decode(spec_data)
            filename   = f"{data['inspection_id']}_spectrogram.png"
            with open(os.path.join(SPECTROGRAM_FOLDER, filename), "wb") as f:
                f.write(spec_bytes)
            spectrogram_url = f"/spectrograms/{filename}"
        except Exception as e:
            return jsonify({"status": "error", "message": f"Spectrogram decoding failed: {str(e)}"}), 400

    # Handle optional visual object
    visual_image_url = None
    visual_data      = None
    if "visual" in data:
        visual_data = data["visual"].copy()
        if visual_data.get("image"):
            try:
                vis_data = visual_data["image"]
                if "base64," in vis_data:
                    vis_data = vis_data.split("base64,")[1]
                vis_bytes = base64.b64decode(vis_data)
                filename  = f"{data['inspection_id']}_visual.jpg"
                with open(os.path.join(IMAGE_FOLDER, filename), "wb") as f:
                    f.write(vis_bytes)
                visual_image_url = f"/images/{filename}"
            except Exception as e:
                return jsonify({"status": "error", "message": f"Visual image decoding failed: {str(e)}"}), 400

    # -------------------------------------------------
    # Write to database
    # -------------------------------------------------

    inspection = Inspection(
        inspection_id = data["inspection_id"],
        timestamp     = data["timestamp"],
        height_cm     = data["height_cm"],
        created_at    = datetime.now(timezone.utc).isoformat(),
    )

    acoustic = AcousticResult(
        inspection_id         = data["inspection_id"],
        has_crack             = data["has_crack"],
        confidence            = data["confidence"],
        dominant_frequency_hz = data.get("dominant_frequency_hz"),
        audio_url_path        = audio_url,
        spectrogram_url_path  = spectrogram_url,
    )

    db.session.add(inspection)
    db.session.add(acoustic)

    if visual_data:
        visual = VisualResult(
            inspection_id     = data["inspection_id"],
            has_crack         = visual_data.get("has_crack", False),
            confidence        = visual_data.get("confidence", 0.0),
            inference_seconds = visual_data.get("inference_seconds"),
            image_url_path    = visual_image_url,
        )
        db.session.add(visual)
        db.session.flush()  # gives visual.id before commit so CrackGeometry can reference it

        if visual_data.get("has_crack") and visual_data.get("crack_geometry"):
            geo = visual_data["crack_geometry"]
            crack_geo = CrackGeometry(
                visual_result_id = visual.id,
                mask_area_px     = geo.get("mask_area_px"),
                length_px        = geo.get("length_px"),
                avg_width_px     = geo.get("avg_width_px"),
                max_width_px     = geo.get("max_width_px"),
                branch_points    = geo.get("branch_points"),
            )
            db.session.add(crack_geo)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    system_state          = "IDLE"
    current_command       = {"type": "none"}
    inspection_started_at = None

    return jsonify({"status": "stored"})


@app.route("/inspections", methods=["GET"])
def get_inspections():
    results = Inspection.query.order_by(Inspection.timestamp.desc()).all()
    return jsonify([r.to_dict() for r in results])


@app.route("/inspection/<inspection_id>", methods=["GET"])
def get_single_inspection(inspection_id):
    inspection = Inspection.query.get(inspection_id)
    if not inspection:
        return jsonify({"status": "error", "message": "Inspection not found"}), 404
    return jsonify(inspection.to_dict())


# -------------------------------------------------
# Serve Stored Files
# -------------------------------------------------

@app.route("/images/<filename>", methods=["GET"])
def serve_image(filename):
    return send_from_directory(IMAGE_FOLDER, filename)


@app.route("/audio/<filename>", methods=["GET"])
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename)


@app.route("/spectrograms/<filename>", methods=["GET"])
def serve_spectrogram(filename):
    return send_from_directory(SPECTROGRAM_FOLDER, filename)


# -------------------------------------------------
# TELEMETRY
# -------------------------------------------------

@app.route("/telemetry", methods=["POST"])
def receive_telemetry():
    global latest_telemetry
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No telemetry data"}), 400
    latest_telemetry = data
    return jsonify({"status": "received"})


@app.route("/telemetry", methods=["GET"])
def get_telemetry():
    return jsonify(latest_telemetry)


# -------------------------------------------------
# SYSTEM STATUS
# -------------------------------------------------

@app.route("/system_status", methods=["GET"])
def system_status():
    check_timeout()
    return jsonify({
        "system_state":     system_state,
        "current_command":  current_command,
        "inspection_count": Inspection.query.count(),
        "session_start":    SESSION_START,
    })


# -------------------------------------------------
# RUN SERVER
# -------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
