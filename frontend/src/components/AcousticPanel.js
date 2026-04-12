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

  return (
    <div className="panel">
      <h3>Acoustic Results</h3>

      {selectedInspection ? (
        selectedInspection.audio_url ? (
          <>
            <p style={{ marginBottom: 12, color: "#9ca3af", fontSize: 13 }}>
              ID: {selectedInspection.inspection_id}
            </p>

            <audio
              ref={audioRef}
              src={`http://localhost:5000${selectedInspection.audio_url}`}
              onEnded={handleEnded}
            />

            <button className="play-button" onClick={handlePlayPause}>
              {isPlaying ? "Pause" : "Play Audio"}
            </button>

            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "6px 0" }}>
                Crack Detected:{" "}
                <strong style={{ color: selectedInspection.has_crack ? "#f87171" : "#4ade80" }}>
                  {selectedInspection.has_crack ? "Yes" : "No"}
                </strong>
              </p>
              <p style={{ margin: "6px 0" }}>
                Confidence in result:{" "}
                <strong>{(selectedInspection.confidence * 100).toFixed(1)}%</strong>
              </p>
              {selectedInspection.dominant_frequency_hz != null && (
                <p style={{ margin: "6px 0" }}>
                  Dominant Frequency:{" "}
                  <strong>{selectedInspection.dominant_frequency_hz.toFixed(1)} Hz</strong>
                </p>
              )}
            </div>

            {selectedInspection.spectrogram_url && (
              <img
                src={`http://localhost:5000${selectedInspection.spectrogram_url}`}
                alt="Frequency Spectrogram"
                style={{ width: "100%", marginTop: 16, borderRadius: 6 }}
              />
            )}
          </>
        ) : (
          <p style={{ color: "#9ca3af" }}>No audio for this inspection.</p>
        )
      ) : (
        <p>No inspection selected.</p>
      )}
    </div>
  );
}

export default AcousticPanel;
