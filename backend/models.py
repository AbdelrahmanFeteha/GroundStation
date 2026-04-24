from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Inspection(db.Model):
    __tablename__ = "inspections"

    inspection_id = db.Column(db.String, primary_key=True)
    timestamp     = db.Column(db.String, nullable=False)
    height_cm     = db.Column(db.Float,  nullable=False)
    created_at    = db.Column(db.String, nullable=False)

    acoustic_result = db.relationship("AcousticResult", back_populates="inspection", uselist=False, cascade="all, delete-orphan")
    visual_result   = db.relationship("VisualResult",   back_populates="inspection", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        d = {
            "inspection_id":         self.inspection_id,
            "timestamp":             self.timestamp,
            "height_cm":             self.height_cm,
            "created_at":            self.created_at,
            "has_crack":             None,
            "confidence":            None,
            "dominant_frequency_hz": None,
            "audio_url":             None,
            "spectrogram_url":       None,
            "image_url":             None,
            "visual":                None,
        }

        if self.acoustic_result:
            ar = self.acoustic_result
            d["has_crack"]              = ar.has_crack
            d["confidence"]             = ar.confidence
            d["dominant_frequency_hz"]  = ar.dominant_frequency_hz
            d["audio_url"]              = ar.audio_url_path
            d["spectrogram_url"]        = ar.spectrogram_url_path

        if self.visual_result:
            vr = self.visual_result
            geo = None
            if vr.crack_geometry:
                cg = vr.crack_geometry
                geo = {
                    "mask_area_px":  cg.mask_area_px,
                    "length_px":     cg.length_px,
                    "avg_width_px":  cg.avg_width_px,
                    "max_width_px":  cg.max_width_px,
                    "branch_points": cg.branch_points,
                }
            d["visual"] = {
                "has_crack":         vr.has_crack,
                "confidence":        vr.confidence,
                "inference_seconds": vr.inference_seconds,
                "image_url":         vr.image_url_path,
                "crack_geometry":    geo,
            }

        return d


class AcousticResult(db.Model):
    __tablename__ = "acoustic_results"

    id                    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    inspection_id         = db.Column(db.String,  db.ForeignKey("inspections.inspection_id", ondelete="CASCADE"), nullable=False, unique=True)
    has_crack             = db.Column(db.Boolean, nullable=False)
    confidence            = db.Column(db.Float,   nullable=False)
    dominant_frequency_hz = db.Column(db.Float,   nullable=True)
    audio_url_path        = db.Column(db.String,  nullable=True)
    spectrogram_url_path  = db.Column(db.String,  nullable=True)

    inspection = db.relationship("Inspection", back_populates="acoustic_result")


class VisualResult(db.Model):
    __tablename__ = "visual_results"

    id                = db.Column(db.Integer, primary_key=True, autoincrement=True)
    inspection_id     = db.Column(db.String,  db.ForeignKey("inspections.inspection_id", ondelete="CASCADE"), nullable=False, unique=True)
    has_crack         = db.Column(db.Boolean, nullable=False)
    confidence        = db.Column(db.Float,   nullable=False)
    inference_seconds = db.Column(db.Float,   nullable=True)
    image_url_path    = db.Column(db.String,  nullable=True)

    inspection     = db.relationship("Inspection",    back_populates="visual_result")
    crack_geometry = db.relationship("CrackGeometry", back_populates="visual_result", uselist=False, cascade="all, delete-orphan")


class CrackGeometry(db.Model):
    __tablename__ = "crack_geometry"

    id               = db.Column(db.Integer, primary_key=True, autoincrement=True)
    visual_result_id = db.Column(db.Integer, db.ForeignKey("visual_results.id", ondelete="CASCADE"), nullable=False, unique=True)
    mask_area_px     = db.Column(db.Integer, nullable=True)
    length_px        = db.Column(db.Integer, nullable=True)
    avg_width_px     = db.Column(db.Float,   nullable=True)
    max_width_px     = db.Column(db.Float,   nullable=True)
    branch_points    = db.Column(db.Integer, nullable=True)

    visual_result = db.relationship("VisualResult", back_populates="crack_geometry")
