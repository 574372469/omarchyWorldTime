import { useEffect, useRef, useState } from "react";
import { alpha } from "../lib/color";
import { THEMES, type Theme } from "../lib/themes";

interface Props {
  theme: Theme;
  rounded: boolean;
  onTheme: (id: string) => void;
  onRounded: (v: boolean) => void;
}

/** The theme swatches, in a dropdown the bar's right end opens. */
export function ThemePicker({ theme, rounded, onTheme, onRounded }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={ref}>
      <button
        type="button"
        className="bar-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Theme"
        title={`Theme: ${theme.name}`}
      >
        <span className="swatch-row" aria-hidden="true">
          <span style={{ background: theme.accent }} />
          <span style={{ background: theme.foreground }} />
          <span style={{ background: theme.background }} />
        </span>
      </button>

      {open && (
        <div className="theme-menu" role="listbox" aria-label="Themes">
          <div className="theme-menu-head">
            <span>Omarchy themes</span>
            <span className="theme-menu-count">{THEMES.length}</span>
          </div>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={t.id === theme.id}
                className={`theme-item${t.id === theme.id ? " is-current" : ""}`}
                onClick={() => {
                  onTheme(t.id);
                  setOpen(false);
                }}
                title={t.name}
                style={{ borderColor: alpha(theme.foreground, t.id === theme.id ? 0.6 : 0.12) }}
              >
                <span className="theme-swatch" style={{ background: t.background }}>
                  <span style={{ background: t.foreground }} />
                  <span style={{ background: t.accent }} />
                </span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
          <label className="theme-toggle">
            <input
              type="checkbox"
              checked={rounded}
              onChange={(e) => onRounded(e.target.checked)}
            />
            <span>Rounded corners</span>
            <span className="theme-toggle-hint">off matches Hyprland's rounding = 0</span>
          </label>
        </div>
      )}
    </div>
  );
}
