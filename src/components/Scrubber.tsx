import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { IconButton, Paper, Slider, Stack, Typography } from "@mui/material";

interface ScrubberProps {
  elapsed: number;
  totalTime: number;
  playing: boolean;
  onElapsedChange(value: number): void;
  onPlayPause(): void;
}

export function Scrubber({ elapsed, totalTime, playing, onElapsedChange, onPlayPause }: ScrubberProps) {
  return (
    <Paper
      component="footer"
      variant="outlined"
      sx={{
        gridArea: "scrubber",
        p: 1.5,
        "@media (max-width: 1024px)": {
          order: 4
        },
        "@media (max-width: 1024px) and (orientation: landscape)": {
          order: 0
        }
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
        <IconButton
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
          color="primary"
          onClick={onPlayPause}
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Slider
          aria-label="Elapsed time in seconds"
          min={0}
          max={Number(totalTime.toFixed(1))}
          step={0.1}
          value={Number(elapsed.toFixed(1))}
          onChange={(_, value) => onElapsedChange(Array.isArray(value) ? value[0] : value)}
          sx={{ flex: 1 }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: "tabular-nums", textAlign: { xs: "left", sm: "right" }, minWidth: 120 }}
        >
          {elapsed.toFixed(1)} / {totalTime.toFixed(1)} s
        </Typography>
      </Stack>
    </Paper>
  );
}
