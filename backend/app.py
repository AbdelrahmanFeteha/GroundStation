from flask import Flask, request, jsonify, send_from_directory
import os
import time
import base64
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -------------------------------------------------
# In-Memory State (Temporary – No Database Yet)
# -------------------------------------------------

system_state = "IDLE"
current_command = {"type": "none"}
inspections = []
latest_telemetry = {}
inspection_started_at = None   #added

# Folders to store images, audio, and spectrograms
IMAGE_FOLDER = "images"
AUDIO_FOLDER = "audio"
SPECTROGRAM_FOLDER = "spectrograms"
os.makedirs(IMAGE_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)
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
        if time.time() - inspection_started_at > 10:
            print("TIMEOUT → resetting")
            system_state = "IDLE"
            current_command = {"type": "none"}
            inspection_started_at = None

# -------------------------------------------------
# COMMANDS
# -------------------------------------------------
# Updated spec:
# - No Pixhawk interface (no ARM / drone control states)
# - Ground station only tells Jetson to begin an inspection cycle
#   (camera + mic capture + impactor activation)
# - Removed Emergency Stop endpoint (RC pilot handles flight safety)

@app.route("/command", methods=["POST"])
def set_command():
    
    global current_command, system_state, inspection_started_at

    data = request.json
    if not data or "type" not in data:
        return jsonify({"status": "error", "message": "Invalid command"}), 400

    cmd_type = data["type"]
    current_command = data  # store last command for Jetson to poll if needed

    # New command set for updated system behavior
    if cmd_type == "begin_inspection":
        system_state = "INSPECTING"
        inspection_started_at = time.time()

    elif cmd_type == "simulate_cracked":
        system_state = "INSPECTING"
        inspection_started_at = time.time()

    elif cmd_type == "simulate_intact":
        system_state = "INSPECTING"
        inspection_started_at = time.time()

    elif cmd_type == "clear":
        system_state = "IDLE"
        current_command = {"type": "none"}

    else:
        return jsonify({"status": "error", "message": f"Unknown command: {cmd_type}"}), 400

    return jsonify({"status": "accepted", "system_state": system_state, "command": current_command})


@app.route("/command", methods=["GET"])
def get_command():
    check_timeout()
    return jsonify({
        "system_state": system_state,
        "command": current_command
    })


# -------------------------------------------------
# INSPECTIONS (WITH BASE64 IMAGE SUPPORT)
# -------------------------------------------------

@app.route("/inspection", methods=["POST"])
def add_inspection():
    global inspections, system_state, current_command

    data = request.json

    required_fields = [
        "inspection_id",
        "timestamp",
        "height_cm",
        "has_crack",
        "confidence"
    ]

    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    for field in required_fields:
        if field not in data:
            return jsonify({
                "status": "error",
                "message": f"Missing field: {field}"
            }), 400

    # Handle optional base64 image
    image_url = None

    if "image" in data:
        try:
            image_data = data["image"]

            # Remove base64 header if present
            if "base64," in image_data:
                image_data = image_data.split("base64,")[1]

            image_bytes = base64.b64decode(image_data)

            filename = f"{data['inspection_id']}.jpg"
            file_path = os.path.join(IMAGE_FOLDER, filename)

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            image_url = f"/images/{filename}"

        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Image decoding failed: {str(e)}"
            }), 400

    # Handle optional base64 audio
    audio_url = None

    if "audio" in data:
        try:
            audio_data = data["audio"]

            # Remove base64 header if present (e.g. "data:audio/wav;base64,")
            if "base64," in audio_data:
                audio_data = audio_data.split("base64,")[1]

            audio_bytes = base64.b64decode(audio_data)

            filename = f"{data['inspection_id']}.wav"
            file_path = os.path.join(AUDIO_FOLDER, filename)

            with open(file_path, "wb") as f:
                f.write(audio_bytes)

            audio_url = f"/audio/{filename}"

        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Audio decoding failed: {str(e)}"
            }), 400

    # Handle optional base64 spectrogram image
    spectrogram_url = None

    if "spectrogram" in data:
        try:
            spec_data = data["spectrogram"]

            if "base64," in spec_data:
                spec_data = spec_data.split("base64,")[1]

            spec_bytes = base64.b64decode(spec_data)

            filename = f"{data['inspection_id']}_spectrogram.png"
            file_path = os.path.join(SPECTROGRAM_FOLDER, filename)

            with open(file_path, "wb") as f:
                f.write(spec_bytes)

            spectrogram_url = f"/spectrograms/{filename}"

        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Spectrogram decoding failed: {str(e)}"
            }), 400

    # Handle optional visual object (image model results + embedded image)
    visual_record = None

    if "visual" in data:
        visual_record = data["visual"].copy()

        if visual_record.get("image"):
            try:
                vis_data = visual_record["image"]

                if "base64," in vis_data:
                    vis_data = vis_data.split("base64,")[1]

                vis_bytes = base64.b64decode(vis_data)

                filename = f"{data['inspection_id']}_visual.jpg"
                file_path = os.path.join(IMAGE_FOLDER, filename)

                with open(file_path, "wb") as f:
                    f.write(vis_bytes)

                visual_record["image_url"] = f"/images/{filename}"

            except Exception as e:
                return jsonify({
                    "status": "error",
                    "message": f"Visual image decoding failed: {str(e)}"
                }), 400

        visual_record.pop("image", None)

    # Store inspection (without full base64 strings)
    inspection_record = data.copy()
    inspection_record.pop("image", None)
    inspection_record.pop("audio", None)
    inspection_record.pop("spectrogram", None)
    inspection_record.pop("visual", None)
    inspection_record["image_url"] = image_url
    inspection_record["audio_url"] = audio_url
    inspection_record["spectrogram_url"] = spectrogram_url
    inspection_record["visual"] = visual_record

    inspections.append(inspection_record)

    # Updated behavior:
    # Once Jetson posts the inspection result, we consider that inspection cycle complete.
    system_state = "IDLE"
    current_command = {"type": "none"}
    inspection_started_at = None

    return jsonify({"status": "stored"})


@app.route("/inspections", methods=["GET"])
def get_inspections():
    return jsonify(inspections)


@app.route("/inspection/<inspection_id>", methods=["GET"])
def get_single_inspection(inspection_id):
    for inspection in inspections:
        if inspection.get("inspection_id") == inspection_id:
            return jsonify(inspection)

    return jsonify({
        "status": "error",
        "message": "Inspection not found"
    }), 404


# -------------------------------------------------
# Serve Stored Images
# -------------------------------------------------

@app.route("/images/<filename>", methods=["GET"])
def serve_image(filename):
    return send_from_directory(IMAGE_FOLDER, filename)


# -------------------------------------------------
# Serve Stored Audio
# -------------------------------------------------

@app.route("/audio/<filename>", methods=["GET"])
def serve_audio(filename):
    return send_from_directory(AUDIO_FOLDER, filename)


# -------------------------------------------------
# Serve Stored Spectrograms
# -------------------------------------------------

@app.route("/spectrograms/<filename>", methods=["GET"])
def serve_spectrogram(filename):
    return send_from_directory(SPECTROGRAM_FOLDER, filename)


# -------------------------------------------------
# TELEMETRY
# -------------------------------------------------

# Jetson → Send Telemetry
@app.route("/telemetry", methods=["POST"])
def receive_telemetry():
    global latest_telemetry

    data = request.json

    if not data:
        return jsonify({"status": "error", "message": "No telemetry data"}), 400

    latest_telemetry = data

    return jsonify({"status": "received"})


# Frontend → Get Latest Telemetry
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
        "system_state": system_state,
        "current_command": current_command,
        "inspection_count": len(inspections)
    })


# -------------------------------------------------
# RUN SERVER
# -------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

# Run the server.
# host="0.0.0.0" allows devices on the same local network (e.g., the Jetson)
# to access this backend using the laptop's IP address (e.g., http://192.168.x.x:5000).
# If we used 127.0.0.1 instead, only this machine could access the server.
# This is required so the Jetson can communicate with the Ground Station backend over WiFi.