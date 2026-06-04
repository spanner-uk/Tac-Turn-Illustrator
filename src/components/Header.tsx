import { useEffect, useRef, useState } from "react";
import { formatG, formatNm, formatSeconds } from "../domain/format";
import { getManeuverInfo, getManeuverTitle } from "../domain/maneuverInfo";
import type { ManeuverParams, Route } from "../domain/types";

interface HeaderProps {
  params: ManeuverParams;
  route: Route;
  elapsed: number;
}

export function Header({ params, route, elapsed }: HeaderProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const titleRowRef = useRef<HTMLDivElement | null>(null);
  const info = getManeuverInfo(params.maneuverType);

  useEffect(() => {
    if (!infoOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!titleRowRef.current?.contains(event.target as Node)) {
        setInfoOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInfoOpen(false);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [infoOpen]);

  return (
    <header className="topbar">
      <div className="headline">
        <div className="title-row" ref={titleRowRef}>
          <h1>{getManeuverTitle(params.maneuverType)}</h1>
          <button
            className="info-button"
            type="button"
            aria-label="Show maneuver information"
            aria-expanded={infoOpen}
            aria-controls="maneuverInfo"
            title="Maneuver information"
            onClick={(event) => {
              event.stopPropagation();
              setInfoOpen((open) => !open);
            }}
          >
            i
          </button>
          {infoOpen && (
            <div className="info-popover" id="maneuverInfo" role="tooltip" onClick={(event) => event.stopPropagation()}>
              {info.description.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {info.pros.map((text) => (
                <div className="info-item info-pro" key={`pro-${text}`}>
                  + {text}
                </div>
              ))}
              {info.cons.map((text) => (
                <div className="info-item info-con" key={`con-${text}`}>
                  - {text}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="meta" aria-live="polite">
          <span className="pill">Turn time {route.maneuverEnd.toFixed(1)} s</span>
          <span className="pill">Time in blindspot {formatSeconds(route.blindspotTime)}</span>
          <span className="pill">Radius {route.radius.toFixed(2)} NM</span>
          <span className="pill">Turn {formatG(params.turnLoadFactor)}</span>
          <span className="pill">Spacing {formatNm(route.completionSpacing)}</span>
        </div>
      </div>
      <div className="time-card" aria-live="polite">
        <span>Elapsed</span>
        <strong>{formatSeconds(elapsed)}</strong>
      </div>
    </header>
  );
}
