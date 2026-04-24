import { useState } from "react";

function formatTimestamp(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function InspectionList({ inspections, selectedInspection, sessionStart, onSelect }) {
  const [activeTab, setActiveTab] = useState("session");

  const sessionInspections = inspections.filter(
    (i) => i.created_at && sessionStart && i.created_at >= sessionStart
  );

  const historyInspections = inspections.filter(
    (i) => !i.created_at || !sessionStart || i.created_at < sessionStart
  );

  const displayed = activeTab === "session" ? sessionInspections : historyInspections;

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
        {[
          { key: "session", label: "This Session", count: sessionInspections.length },
          { key: "history", label: "History",      count: historyInspections.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: key === "session" ? "6px 0 0 6px" : "0 6px 6px 0",
              border: "1px solid #3a3d4a",
              background: activeTab === key ? "#1f6feb" : "#2b2d36",
              color: activeTab === key ? "white" : "#9ca3af",
              fontWeight: activeTab === key ? 700 : 400,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {label}
            <span style={{
              marginLeft: 6,
              background: activeTab === key ? "rgba(255,255,255,0.2)" : "#3a3d4a",
              borderRadius: 10,
              padding: "1px 7px",
              fontSize: 11,
            }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <ul style={{ overflowY: "auto", maxHeight: 420, margin: 0, padding: 0, listStyle: "none" }}>
        {displayed.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 4px" }}>
            {activeTab === "session" ? "No inspections this session." : "No previous inspections."}
          </p>
        ) : (
          displayed.map((inspection) => (
            <li
              key={inspection.inspection_id}
              className={
                selectedInspection?.inspection_id === inspection.inspection_id
                  ? "inspection-item inspection-selected"
                  : "inspection-item"
              }
              onClick={() => onSelect(inspection)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {inspection.inspection_id}
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 3,
                fontSize: 12,
                opacity: 0.65,
              }}>
                <span>Height: {inspection.height_cm} cm</span>
                <span>{formatTimestamp(inspection.timestamp)}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default InspectionList;
