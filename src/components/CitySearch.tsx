import { useEffect, useMemo, useRef, useState } from "react";
import { alpha } from "../lib/color";
import { zoneCatalog, type City, type ZoneOption } from "../lib/time";

interface Props {
  existing: City[];
  placeholder: string;
  fg: string;
  accent: string;
  rounded: boolean;
  onPick: (zone: string, label: string) => void;
  onClose: () => void;
}

/** The "Add a city" line: a plus that becomes a filter field and its results. */
export function CitySearch({
  existing,
  placeholder,
  fg,
  accent,
  rounded,
  onPick,
  onClose,
}: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const have = new Set(existing.map((c) => `${c.label}|${c.id}`));
    const pool = catalog.filter((o) => !have.has(`${o.label}|${o.value}`));
    if (q === "") return pool.slice(0, 8);
    const starts: ZoneOption[] = [];
    const contains: ZoneOption[] = [];
    for (const o of pool) {
      const label = o.label.toLowerCase();
      const id = o.value.toLowerCase();
      if (label.startsWith(q)) starts.push(o);
      else if (label.includes(q) || id.includes(q)) contains.push(o);
      if (starts.length + contains.length > 60) break;
    }
    return [...starts, ...contains].slice(0, 40);
  }, [query, catalog, existing]);

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
        <span>{placeholder}</span>
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
          placeholder="City or zone…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setActive(false);
              onClose();
            } else if (e.key === "Enter" && results.length > 0) {
              onPick(results[0].value, results[0].label);
              setQuery("");
              setActive(false);
            }
          }}
          style={{ color: fg }}
          aria-label="Search for a city or time zone"
        />
        <button
          type="button"
          className="search-close"
          onClick={() => {
            setQuery("");
            setActive(false);
            onClose();
          }}
          aria-label="Close search"
          style={{ color: alpha(fg, 0.6) }}
        >
          ×
        </button>
      </div>

      <div className="search-results" role="listbox">
        {results.length === 0 && (
          <div className="search-empty" style={{ color: alpha(fg, 0.4) }}>
            Nothing matches “{query}”.
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
            <span className="search-result-label">{o.label}</span>
            <span className="search-result-zone" style={{ color: alpha(fg, 0.4) }}>
              {o.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
