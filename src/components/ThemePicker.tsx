import { useEffect, useRef, useState } from "react";
import { alpha } from "../lib/color";
import { LANGS, LANG_NAMES, t, type Lang } from "../lib/i18n";
import { THEMES, type Theme } from "../lib/themes";

interface Props {
  theme: Theme;
  rounded: boolean;
  lang: Lang;
  langChoice: string;
  onTheme: (id: string) => void;
  onRounded: (v: boolean) => void;
  onLang: (choice: string) => void;
}

/** The theme swatches, in a dropdown the bar's right end opens. */
export function ThemePicker({
  theme,
  rounded,
  lang,
  langChoice,
  onTheme,
  onRounded,
  onLang,
}: Props) {
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
        aria-label={t(lang, "theme")}
        title={`${t(lang, "theme")}: ${theme.name}`}
      >
        <span className="swatch-row" aria-hidden="true">
          <span style={{ background: theme.accent }} />
          <span style={{ background: theme.foreground }} />
          <span style={{ background: theme.background }} />
        </span>
      </button>

      {open && (
        <div className="theme-menu" role="listbox" aria-label={t(lang, "themes")}>
          <div className="theme-menu-head">
            <span>{t(lang, "themes")}</span>
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
            <span>{t(lang, "rounded")}</span>
            <span className="theme-toggle-hint">{t(lang, "roundedHint")}</span>
          </label>

          <div className="theme-lang">
            <span className="theme-menu-head">
              <span>{t(lang, "language")}</span>
              <span className="theme-menu-count">
                {langChoice === "auto" ? t(lang, "languageAuto") : LANG_NAMES[lang]}
              </span>
            </span>
            <div className="lang-grid">
              <button
                type="button"
                className={`lang-item${langChoice === "auto" ? " is-current" : ""}`}
                onClick={() => onLang("auto")}
              >
                {t(lang, "languageAuto")}
              </button>
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  className={`lang-item${langChoice === l ? " is-current" : ""}`}
                  onClick={() => {
                    onLang(l);
                    // Picking a language closes the menu: the panel behind it
                    // is now written in the one just chosen.
                    setOpen(false);
                  }}
                >
                  {LANG_NAMES[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
