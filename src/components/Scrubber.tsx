interface ScrubberProps {
  elapsed: number;
  totalTime: number;
  playing: boolean;
  onElapsedChange(value: number): void;
  onPlayPause(): void;
}

export function Scrubber({ elapsed, totalTime, playing, onElapsedChange, onPlayPause }: ScrubberProps) {
  return (
    <footer className="scrubber">
      <button
        className="icon-button"
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
        onClick={onPlayPause}
      >
        <span className={playing ? "pause-symbol" : "play-symbol"} aria-hidden="true" />
      </button>
      <input
        type="range"
        min="0"
        max={totalTime.toFixed(1)}
        step="0.1"
        value={elapsed.toFixed(1)}
        aria-label="Elapsed time in seconds"
        onChange={(event) => onElapsedChange(Number(event.target.value))}
      />
      <output className="time-readout">
        {elapsed.toFixed(1)} / {totalTime.toFixed(1)} s
      </output>
    </footer>
  );
}
