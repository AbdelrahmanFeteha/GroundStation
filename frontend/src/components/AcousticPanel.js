import { useRef, useState, useEffect } from "react";

function AcousticPanel({ selectedInspection }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset playback state when a different inspection is selected
  useEffect(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [selectedInspection]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleEnded = () => setIsPlaying(false);

  const hasSelection = Boolean(selectedInspection);
  const hasAudio = hasSelection && Boolean(selectedInspection.audio_url);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Channel · 02</p>
          <h3 className="panel-title">Acoustic</h3>
        </div>
        {hasSelection && (
          <span className="panel-count">
            ID · {selectedInspection.inspection_id}
          </span>
        )}
      </div>

      {!hasSelection && (
        <div className="panel-empty">
          <div className="panel-empty-mark" />
          <span>Select an inspection to play acoustic capture</span>
        </div>
      )}

      {hasSelection && !hasAudio && (
        <div className="panel-empty">
          <div className="panel-empty-mark" />
          <span>No audio for this inspection.</span>
        </div>
      )}

      {hasAudio && (
        <>
          <audio
            ref={audioRef}
            src={`http://localhost:5000${selectedInspection.audio_url}`}
            onEnded={handleEnded}
          />

          {/* Player shell */}
          <div className="play-shell">
            <button
              className="play-btn play-button"
              onClick={handlePlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
              type="button"
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="play-meta">
              <span className="play-meta-kicker">
                {isPlaying ? "Playing" : "Ready"}
              </span>
              <span className="play-meta-id">
                Sample · {selectedInspection.inspection_id}
              </span>
            </div>

            <div className={`waveform ${isPlaying ? "is-playing" : ""}`}>
              <span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>

          {/* Verdict row */}
          <div
            className="verdict-row"
            data-crack={String(Boolean(selectedInspection.has_crack))}
          >
            <span className="verdict-icon">
              {selectedInspection.has_crack ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8v5" />
                  <path d="M12 16.5v.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              )}
            </span>

            <div className="verdict-text">
              <span className="verdict-kicker">Acoustic Verdict</span>
              <span className="verdict-value">
                {selectedInspection.has_crack
                  ? "Crack Detected"
                  : "Surface Intact"}
              </span>
            </div>

            <span className="verdict-conf">
              {(selectedInspection.confidence * 100).toFixed(1)}%
            </span>
          </div>

          {/* Dominant frequency */}
          {selectedInspection.dominant_frequency_hz != null && (
            <div className="data-grid" style={{ marginBottom: 0 }}>
              <div className="data-row">
                <span className="data-row-label">Dominant Frequency</span>
                <span className="data-row-value">
                  {selectedInspection.dominant_frequency_hz.toFixed(1)} Hz
                </span>
              </div>
            </div>
          )}

          {/* Spectrogram */}
          {selectedInspection.spectrogram_url && (
            <div className="spectrogram-wrap">
              <img
                src={`http://localhost:5000${selectedInspection.spectrogram_url}`}
                alt="Frequency Spectrogram"
              />
              <div className="spectrogram-caption">
                Frequency · Time Spectrogram
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AcousticPanel;
