import { useEffect, useMemo, useRef, useState } from "react";
import { alpha } from "../lib/color";
import { localizedCity } from "../lib/cityNames";
import { t, type Lang } from "../lib/i18n";
import { canonicalZone, zoneCatalog, type City } from "../lib/time";
import { nativeLang, nativeZoneName, targetZoneName } from "../lib/zoneNames";

interface Props {
  existing: City[];
  fg: string;
  accent: string;
  rounded: boolean;
  lang: Lang;
  /** The tag the panel's own dates and zone names are written in. */
  locale: string;
  onPick: (zone: string, label: string) => void;
  onClose: () => void;
}

/** The "Add a city" line: a plus that becomes a filter field and its results. */
export function CitySearch({
  existing,
  fg,
  accent,
  rounded,
  lang,
  locale,
  onPick,
  onClose,
}: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    inputRef.current?.focus();
    // The field sits at the foot of the list; bring it and its results up.
    const t = window.setTimeout(() => {
      rootRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 30);
    return () => window.clearTimeout(t);
  }, [active]);

  const catalog = useMemo(() => zoneCatalog(), []);

  // Each entry carries the name this language gives it, and is searched by
  // both that name and the English one, so either script finds the city.
  // Names are gathered once per language, not once per keystroke.
  const pool = useMemo(() => {
    if (!active) return [];
    // The zone is a city's real identity: a saved city may carry either its
    // English or its local label, so matching labels alone lets duplicates in.
    const have = new Set(existing.map((c) => canonicalZone(c.id)));
    return catalog
      .filter((o) => !have.has(o.canonical))
      .map((o) => {
        const local = localizedCity(o.value, lang);
        // The panel's language names the zone; the zone's own language names
        // it again, so a reader of either finds it here.
        const target = targetZoneName(o.value, locale);
        const native = nativeZoneName(o.value);
        const spellings = [o.label, local, target, native, o.value, ...o.aliases].join("\n");
        return { ...o, local, target, native, probe: spellings.toLowerCase() };
      });
  }, [active, catalog, existing, lang, locale]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return pool;
    const starts: typeof pool = [];
    const contains: typeof pool = [];
    for (const o of pool) {
      // A name that begins with what was typed outranks one that merely
      // contains it, whichever of the zone's names it is.
      if (
        o.label.toLowerCase().startsWith(q) ||
        o.local.toLowerCase().startsWith(q) ||
        o.target.toLowerCase().startsWith(q) ||
        o.native.toLowerCase().startsWith(q)
      ) {
        starts.push(o);
      } else if (o.probe.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [pool, query]);

  if (!active) {
    return (
      <button
        type="button"
        className="add-row"
        onClick={() => setActive(true)}
        style={{
          borderColor: alpha(fg, 0.18),
          color: alpha(fg, 0.55),
          borderRadius: rounded ? 6 : 0,
        }}
      >
        <span className="add-plus" aria-hidden="true">
          +
        </span>
        <span>{t(lang, "addCity")}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="search" style={{ borderRadius: rounded ? 6 : 0 }}>
      <div
        className="search-field"
        style={{ borderColor: alpha(accent, 0.55), background: alpha(fg, 0.04) }}
      >
        <span className="search-icon" aria-hidden="true">
          +
        </span>
        <input
          ref={inputRef}
          value={query}
          placeholder={t(lang, "searchPlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            if (resultsRef.current) resultsRef.current.scrollTop = 0;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setActive(false);
              onClose();
            } else if (
              e.key === "Enter" &&
              !e.nativeEvent.isComposing &&
              results.length > 0
            ) {
              onPick(results[0].value, results[0].label);
              setQuery("");
              setActive(false);
            }
          }}
          style={{ color: fg }}
          aria-label={t(lang, "searchAria")}
        />
        <button
          type="button"
          className="search-close"
          onClick={() => {
            setQuery("");
            setActive(false);
            onClose();
          }}
          aria-label={t(lang, "closeSearch")}
          style={{ color: alpha(fg, 0.6) }}
        >
          ×
        </button>
      </div>

      <div ref={resultsRef} className="search-results" role="listbox">
        {results.length === 0 && (
          <div className="search-empty" style={{ color: alpha(fg, 0.4) }}>
            {t(lang, "noMatch", { q: query })}
          </div>
        )}
        {results.map((o) => (
          <button
            key={`${o.label}|${o.value}`}
            type="button"
            role="option"
            aria-selected={false}
            className="search-result"
            onClick={() => {
              onPick(o.value, o.label);
              setQuery("");
              setActive(false);
            }}
            style={{ color: fg }}
          >
            <span className="search-result-main">
              <span className="search-result-label">{o.local || o.label}</span>
              <span
                className="search-result-names"
                style={{ color: alpha(fg, 0.45) }}
                title={o.native && o.native !== o.target ? `${o.target} · ${o.native}` : o.target}
              >
                <span>{o.target}</span>
                {o.native && o.native !== o.target && (
                  <>
                    {" · "}
                    <span lang={nativeLang(o.value)} dir="auto">
                      {o.native}
                    </span>
                  </>
                )}
              </span>
            </span>
            <span className="search-result-zone" style={{ color: alpha(fg, 0.35) }}>
              {o.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
