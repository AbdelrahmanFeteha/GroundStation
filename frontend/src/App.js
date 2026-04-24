import { useEffect, useState } from "react";
import ControlBar from "./components/ControlBar";
import InspectionList from "./components/InspectionList";
import VisionPanel from "./components/VisionPanel";
import AcousticPanel from "./components/AcousticPanel";
import "./Dashboard.css";

function App() {
  const [status, setStatus] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);

  // ----------------------------
  // Fetch System Status
  // ----------------------------
  const fetchStatus = () => {
    fetch("http://localhost:5000/system_status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error(err));
  };

  // ----------------------------
  // Fetch Inspections
  // ----------------------------
  const fetchInspections = () => {
    fetch("http://localhost:5000/inspections")
      .then((res) => res.json())
      .then((data) => setInspections(data))
      .catch((err) => console.error(err));
  };

  // ----------------------------
  // Poll Every 1 Second
  // ----------------------------
  useEffect(() => {
    fetchStatus();
    fetchInspections();

    const interval = setInterval(() => {
      fetchStatus();
      fetchInspections();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ----------------------------
  // Commands (Updated)
  // ----------------------------
  const sendCommand = (type) => {
    fetch("http://localhost:5000/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    }).catch((err) => console.error(err));
  };

  const handleBeginInspection  = () => sendCommand("begin_inspection");
  const handleSimulateCracked  = () => sendCommand("simulate_cracked");
  const handleSimulateIntact   = () => sendCommand("simulate_intact");



  return (
    <div className="app-container">
      {/* TOP BAR */}
      <ControlBar />

      {/* HERO TITLE BLOCK */}
      <section className="hero fade-up">
        <div>
          <h1 className="hero-title">
            Ground Station<em>.</em>
          </h1>
          <p className="hero-sub">
            Drone-Based Impact Sounding and Vision System for Non-Destructive Concrete Inspection
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="state-pill" data-state={status ? status.system_state : "IDLE"}>
            <span className="state-dot" />
            <span className="state-pill-label">State</span>
            <span>{status ? status.system_state : "CONNECTING"}</span>
          </div>
          <button onClick={handleBeginInspection} className="btn btn-primary begin-button" type="button">
            <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
            </svg>
            Begin Inspection
          </button>
          <button onClick={handleSimulateCracked} className="btn btn-alert" type="button">
            Simulate Cracked
          </button>
          <button onClick={handleSimulateIntact} className="btn btn-safe" type="button">
            Simulate Intact
          </button>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="grid-layout">
        <div className="inspection-panel fade-up delay-1">
          <InspectionList
            inspections={inspections}
            selectedInspection={selectedInspection}
            sessionStart={status?.session_start}
            onSelect={setSelectedInspection}
          />
        </div>

        <div className="vision-panel fade-up delay-2">
          <VisionPanel selectedInspection={selectedInspection} />
        </div>

        <div className="acoustic-panel fade-up delay-3">
          <AcousticPanel selectedInspection={selectedInspection} />
        </div>
      </div>
    </div>
  );
}

export default App;
