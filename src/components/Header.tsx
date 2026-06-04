import { useState } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Chip, IconButton, Paper, Popover, Stack, Typography } from "@mui/material";
import { formatG, formatNm, formatSeconds } from "../domain/format";
import { getManeuverInfo, getManeuverTitle } from "../domain/maneuverInfo";
import type { ManeuverParams, Route } from "../domain/types";

interface HeaderProps {
  params: ManeuverParams;
  route: Route;
  elapsed: number;
}

export function Header({ params, route, elapsed }: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const info = getManeuverInfo(params.maneuverType);
  const infoOpen = Boolean(anchorEl);

  return (
    <Box
      component="header"
      sx={{
        gridArea: "topbar",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "end",
        gap: 2,
        "@media (max-width: 1024px)": {
          order: 2,
          gridTemplateColumns: "1fr",
          alignItems: "stretch"
        },
        "@media (max-width: 1024px) and (orientation: landscape)": {
          order: 0,
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "end"
        }
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: "clamp(1.2rem, 2vw, 1.8rem)", lineHeight: 1.1 }}>
            {getManeuverTitle(params.maneuverType)}
          </Typography>
          <IconButton
            size="small"
            aria-label="Show maneuver information"
            aria-expanded={infoOpen}
            aria-controls={infoOpen ? "maneuverInfo" : undefined}
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
          <Popover
            id="maneuverInfo"
            open={infoOpen}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <Stack spacing={1} sx={{ maxWidth: 430, maxHeight: "58vh", overflow: "auto", p: 2 }}>
              {info.description.map((text) => (
                <Typography variant="body2" key={text}>
                  {text}
                </Typography>
              ))}
              {info.pros.map((text) => (
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }} key={`pro-${text}`}>
                  + {text}
                </Typography>
              ))}
              {info.cons.map((text) => (
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 700 }} key={`con-${text}`}>
                  - {text}
                </Typography>
              ))}
            </Stack>
          </Popover>
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }} aria-live="polite">
          <Chip label={`Turn time ${route.maneuverEnd.toFixed(1)} s`} size="small" variant="outlined" />
          <Chip label={`Time in blindspot ${formatSeconds(route.blindspotTime)}`} size="small" variant="outlined" />
          <Chip label={`Radius ${route.radius.toFixed(2)} NM`} size="small" variant="outlined" />
          <Chip label={`Turn ${formatG(params.turnLoadFactor)}`} size="small" variant="outlined" />
          <Chip label={`Spacing ${formatNm(route.completionSpacing)}`} size="small" variant="outlined" />
        </Stack>
      </Box>
      <Paper variant="outlined" sx={{ minWidth: 172, p: 1.5, textAlign: { xs: "left", md: "right" } }} aria-live="polite">
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
          Elapsed
        </Typography>
        <Typography variant="h5" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {formatSeconds(elapsed)}
        </Typography>
      </Paper>
    </Box>
  );
}
