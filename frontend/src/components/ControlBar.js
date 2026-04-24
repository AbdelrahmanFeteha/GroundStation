function ControlBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div className="brand-text">
          <span className="brand-kicker">GS // v1</span>
          <span className="brand-name">Ground Station</span>
        </div>
      </div>

      <span className="topbar-center-tag">
        American University of Sharjah
      </span>

      <div style={{ textAlign: "right" }}>
        <p className="hero-team-project">Senior Design Project · Group 32</p>
        <p className="hero-team-names">
          Abdelrahman Feteha · Ahmad ElShafie · Louy Abbas
        </p>
      </div>
    </header>
  );
}

export default ControlBar;
