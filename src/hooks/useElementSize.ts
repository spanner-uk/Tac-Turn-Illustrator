import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Viewport } from "../domain/types";

export function useElementSize(ref: RefObject<HTMLElement | null>): Viewport {
  const [size, setSize] = useState<Viewport>({ width: 1, height: 1 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height)
      });
    };

    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [ref]);

  return size;
}
