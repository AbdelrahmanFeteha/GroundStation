import { useState } from "react";

function formatTimestamp(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return (
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      " · " +
      d.toLocaleDateString([], { month: "short", day: "numeric" })
    );
  } catch {
    return ts;
  }
}

function InspectionList({
  inspections,
  selectedInspection,
  sessionStart,
  onSelect,
}) {
  const [activeTab, setActiveTab] = useState("session");

  const sessionInspections = inspections.filter(
    (i) => i.created_at && sessionStart && i.created_at >= sessionStart
  );

  const historyInspections = inspections.filter(
    (i) => !i.created_at || !sessionStart || i.created_at < sessionStart
  );

  const displayed =
    activeTab === "session" ? sessionInspections : historyInspections;

  const tabs = [
    { key: "session", label: "Session", count: sessionInspections.length },
    { key: "history", label: "History", count: historyInspections.length },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Archive</p>
          <h3 className="panel-title">Inspections</h3>
        </div>
        <span className="panel-count">
          {String(inspections.length).padStart(3, "0")}
        </span>
      </div>

      {/* Segmented tabs */}
      <div className="seg-tabs" role="tablist">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`seg-tab ${activeTab === key ? "is-active" : ""}`}
            type="button"
          >
            {label}
            <span className="seg-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="panel-empty">
          <div className="panel-empty-mark" />
          <span>
            {activeTab === "session"
              ? "No inspections this session."
              : "No previous inspections."}
          </span>
        </div>
      ) : (
        <ul className="inspection-list">
          {displayed.map((inspection) => {
            const isSelected =
              selectedInspection?.inspection_id === inspection.inspection_id;
            const crackFlag =
              inspection.has_crack === true
                ? "true"
                : inspection.has_crack === false
                ? "false"
                : "unknown";

            return (
              <li
                key={inspection.inspection_id}
                className={
                  isSelected
                    ? "inspection-item is-selected"
                    : "inspection-item"
                }
                data-crack={crackFlag}
                onClick={() => onSelect(inspection)}
              >
                <div className="ii-top">
                  <span className="ii-id">{inspection.inspection_id}</span>
                  <span className="ii-marker" />
                </div>
                <div className="ii-bottom">
                  <span className="ii-height">
                    {inspection.height_cm}
                    <span className="ii-unit">cm</span>
                  </span>
                  <span className="ii-time">
                    {formatTimestamp(inspection.timestamp)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default InspectionList;
