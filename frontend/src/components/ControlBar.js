function ControlBar({ status, onBeginInspection, getStateColor }) {
  return (
    <div className="control-bar">
      <span className="system-state">
        System State:
        <span
          style={{
            marginLeft: "10px",
            color: getStateColor()
          }}
        >
          {status ? status.system_state : "Loading..."}
        </span>
      </span>

      <button onClick={onBeginInspection} className="begin-button">
        BEGIN INSPECTION
      </button>
    </div>
  );
}

export default ControlBar;