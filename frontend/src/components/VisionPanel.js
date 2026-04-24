function VisionPanel({ selectedInspection }) {
  if (!selectedInspection) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Channel · 01</p>
            <h3 className="panel-title">Vision</h3>
          </div>
        </div>
        <div className="panel-empty">
          <div className="panel-empty-mark" />
          <span>Select an inspection to review visual results</span>
        </div>
      </div>
    );
  }

  const v = selectedInspection.visual;

  if (!v) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Channel · 01</p>
            <h3 className="panel-title">Vision</h3>
          </div>
        </div>

        {selectedInspection.image_url && (
          <div className="vision-image-wrap">
            <span className="vision-image-badge">
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 100,
                  background: "var(--framer-blue)",
                }}
              />
              Raw Capture
            </span>
            <img
              className="vision-image"
              src={`http://localhost:5000${selectedInspection.image_url}`}
              alt="Inspection"
            />
          </div>
        )}
        <div className="panel-empty" style={{ minHeight: 80 }}>
          <span>No visual analysis data.</span>
        </div>
      </div>
    );
  }

  const geo = v.crack_geometry;
  const confPct = (v.confidence * 100).toFixed(1);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Channel · 01</p>
          <h3 className="panel-title">Vision</h3>
        </div>
        <span className="panel-count">
          ID · {selectedInspection.inspection_id}
        </span>
      </div>

      {/* Crack image */}
      {v.image_url && (
        <div className="vision-image-wrap">
          <span className="vision-image-badge">
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 100,
                background: v.has_crack ? "var(--alert)" : "var(--safe)",
                boxShadow: v.has_crack
                  ? "0 0 8px var(--alert-ring)"
                  : "0 0 8px var(--safe-ring)",
              }}
            />
            Segmentation
          </span>
          <img
            className="vision-image"
            src={`http://localhost:5000${v.image_url}`}
            alt="Visual Crack"
          />
        </div>
      )}

      {/* Stat rail */}
      <div className="stat-rail">
        <div className="stat-card">
          <span className="stat-label">Detection</span>
          <span
            className={`stat-value ${v.has_crack ? "is-alert" : "is-safe"}`}
          >
            {v.has_crack ? "Cracked" : "Intact"}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Confidence</span>
          <span className="stat-value is-accent">{confPct}%</span>
          <div className="conf-bar">
            <div
              className="conf-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, parseFloat(confPct)))}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Inference</span>
          <span className="stat-value">
            {v.inference_seconds != null
              ? `${v.inference_seconds.toFixed(2)}s`
              : "—"}
          </span>
        </div>
      </div>

      {/* Crack geometry data grid */}
      {v.has_crack && geo && (
        <div className="data-grid">
          <div className="data-grid-title">Crack Geometry</div>

          {[
            [
              "Mask Area",
              geo.mask_area_px != null ? `${geo.mask_area_px} px²` : "—",
            ],
            [
              "Length",
              geo.length_px != null ? `${geo.length_px} px` : "—",
            ],
            [
              "Avg Width",
              geo.avg_width_px != null
                ? `${geo.avg_width_px.toFixed(1)} px`
                : "—",
            ],
            [
              "Max Width",
              geo.max_width_px != null
                ? `${geo.max_width_px.toFixed(1)} px`
                : "—",
            ],
            [
              "Branch Points",
              geo.branch_points != null ? geo.branch_points : "—",
            ],
          ].map(([label, value]) => (
            <div className="data-row" key={label}>
              <span className="data-row-label">{label}</span>
              <span className="data-row-value">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VisionPanel;
