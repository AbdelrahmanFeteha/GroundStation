function ControlBar({ status, onBeginInspection, onSimulateCracked, onSimulateIntact, getStateColor }) {
  return (
    <div className="control-bar">
      <span className="system-state">
        System State:
        <span style={{ marginLeft: "10px", color: getStateColor() }}>
          {status ? status.system_state : "Loading..."}
        </span>
      </span>

      <button onClick={onBeginInspection} className="begin-button">
        BEGIN INSPECTION
      </button>

      <button onClick={onSimulateCracked} className="simulate-crack-button">
        SIMULATE CRACKED
      </button>

      <button onClick={onSimulateIntact} className="simulate-intact-button">
        SIMULATE INTACT
      </button>
    </div>
  );
}

export default ControlBar;
