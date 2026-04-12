const SEVERITY_BADGE = {
  Minor:    { background: "#166534", color: "#4ade80" },
  Moderate: { background: "#78350f", color: "#fbbf24" },
  Severe:   { background: "#7f1d1d", color: "#f87171" },
};

function VisionPanel({ selectedInspection }) {
  if (!selectedInspection) {
    return (
      <div className="panel">
        <h3>Vision Results</h3>
        <p>No inspection selected.</p>
      </div>
    );
  }

  const v = selectedInspection.visual;

  if (!v) {
    return (
      <div className="panel">
        <h3>Vision Results</h3>
        {selectedInspection.image_url && (
          <img
            src={`http://localhost:5000${selectedInspection.image_url}`}
            alt="Inspection"
            style={{ width: "100%", borderRadius: 6 }}
          />
        )}
        <p style={{ color: "#9ca3af", marginTop: 12 }}>No visual analysis data.</p>
      </div>
    );
  }

  const badgeStyle = v.severity_level ? SEVERITY_BADGE[v.severity_level] : null;
  const geo = v.crack_geometry;

  return (
    <div className="panel">
      <h3>Vision Results</h3>

      {/* Crack image */}
      {v.image_url && (
        <img
          src={`http://localhost:5000${v.image_url}`}
          alt="Visual Crack"
          style={{ width: "100%", borderRadius: 6, marginBottom: 14 }}
        />
      )}

      {/* Crack detected + severity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span>
          Crack Detected:{" "}
          <strong style={{ color: v.has_crack ? "#f87171" : "#4ade80" }}>
            {v.has_crack ? "Yes" : "No"}
          </strong>
        </span>

        {v.severity_level && badgeStyle && (
          <span style={{
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            background: badgeStyle.background,
            color: badgeStyle.color,
          }}>
            {v.severity_level}
          </span>
        )}
      </div>

      {/* Confidence + inference time */}
      <p style={{ margin: "4px 0" }}>
        Confidence in result:{" "}
        <strong>{(v.confidence * 100).toFixed(1)}%</strong>
      </p>

      {v.inference_seconds != null && (
        <p style={{ margin: "4px 0", color: "#9ca3af", fontSize: 13 }}>
          Inference: {v.inference_seconds.toFixed(2)}s
        </p>
      )}

      {/* Crack geometry table */}
      {v.has_crack && geo && (
        <table style={{
          width: "100%",
          marginTop: 14,
          borderCollapse: "collapse",
          fontSize: 13,
        }}>
          <tbody>
            {[
              ["Mask Area",    geo.mask_area_px   != null ? `${geo.mask_area_px} px`       : "—"],
              ["Length",       geo.length_px      != null ? `${geo.length_px} px`           : "—"],
              ["Avg Width",    geo.avg_width_px   != null ? `${geo.avg_width_px.toFixed(1)} px` : "—"],
              ["Max Width",    geo.max_width_px   != null ? `${geo.max_width_px.toFixed(1)} px` : "—"],
              ["Branch Points",geo.branch_points  != null ? geo.branch_points               : "—"],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "1px solid #3a3d4a" }}>
                <td style={{ padding: "5px 4px", color: "#9ca3af" }}>{label}</td>
                <td style={{ padding: "5px 4px", textAlign: "right", fontWeight: 600 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default VisionPanel;
