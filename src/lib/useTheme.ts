import { useEffect } from "react";
import { alpha, darken, mix } from "./color";
import type { Theme } from "./themes";

/** The Omarchy palette roles this app reads, as CSS custom properties. */
const VARS: Record<string, keyof Theme> = {
  "--bg": "background",
  "--bg-dark": "darkBackground",
  "--bg-darker": "darkerBackground",
  "--bg-light": "lighterBackground",
  "--fg": "foreground",
  "--fg-bright": "brightForeground",
  "--accent": "accent",
  "--selection": "selection",
  "--muted": "muted",
  "--red": "red",
  "--yellow": "yellow",
  "--green": "green",
  "--cyan": "cyan",
  "--blue": "blue",
  "--magenta": "magenta",
};

/** Push a theme's palette onto the document, plus the tokens derived from it. */
export function useTheme(theme: Theme, rounded: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, key] of Object.entries(VARS)) {
      root.style.setProperty(name, String(theme[key]));
    }

    // Qt.darker(fg, 1.55) and 2.1, the two dims every Elsewhen surface uses.
    root.style.setProperty("--fg-dim", darken(theme.foreground, 1.55));
    root.style.setProperty("--fg-fainter", darken(theme.foreground, 2.1));
    root.style.setProperty("--surface", theme.background);
    root.style.setProperty("--row-normal", mix(theme.background, theme.foreground, 0.07));
    root.style.setProperty("--hover", alpha(theme.foreground, 0.08));
    root.style.setProperty("--hairline", alpha(theme.foreground, 0.12));
    root.style.setProperty("--border", theme.accent);
    root.style.setProperty("--daylight", "#E5C736");

    root.style.setProperty("--radius", rounded ? "6px" : "0px");
    root.dataset.theme = theme.id;
    root.dataset.mode = theme.mode;
    root.style.colorScheme = theme.mode;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.background);
  }, [theme, rounded]);
}
