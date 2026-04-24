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

  const getStateColor = () => {
    if (!status) return "black";
    if (status.system_state === "INSPECTING") return "green";
    if (status.system_state === "PAUSED") return "orange"; // optional future use
    if (status.system_state === "EMERGENCY") return "red"; // optional future use
    return "gray"; // IDLE, unknown
  };

  return (
    <div className="app-container">
      <h1 className="title">Drone-Based Concrete Inspection – Ground Station</h1>

      {/* CONTROL BAR COMPONENT */}
      <ControlBar
        status={status}
        onBeginInspection={handleBeginInspection}
        onSimulateCracked={handleSimulateCracked}
        onSimulateIntact={handleSimulateIntact}
        getStateColor={getStateColor}
      />

      {/* MAIN GRID */}
      <div className="grid-layout">
        {/* LEFT PANEL */}
        <InspectionList
          inspections={inspections}
          selectedInspection={selectedInspection}
          sessionStart={status?.session_start}
          onSelect={setSelectedInspection}
        />

        {/* CENTER PANEL */}
        <VisionPanel selectedInspection={selectedInspection} />

        {/* RIGHT PANEL */}
        <AcousticPanel selectedInspection={selectedInspection} />
      </div>
    </div>
  );
}

export default App;