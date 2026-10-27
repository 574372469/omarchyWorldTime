import { useEffect, useState } from "react";
import { closeWindow, dragWindow, isDesktop } from "../lib/desktop";
import { t, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
}

/** The widget's own title bar: drag by it, pin the window, close it. */
export function WidgetBar({ lang }: Props) {
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const onTop = await getCurrentWindow().isAlwaysOnTop();
        if (!cancelled) setPinned(onTop);
      } catch {
        /* keep the window's configured state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isDesktop) return null;

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setAlwaysOnTop(next);
    } catch {
      setPinned(!next);
    }
  };

  return (
    <div className="widget-bar" onPointerDown={() => void dragWindow()}>
      <span className="widget-bar-title">World Clock</span>
      <span className="widget-bar-spacer" />
      <button
        type="button"
        className="widget-bar-button"
        aria-pressed={pinned}
        aria-label={t(lang, "widgetTitle")}
        title={t(lang, "widgetTitle")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void togglePin()}
      >
        {pinned ? "◆" : "◇"}
      </button>
      <button
        type="button"
        className="widget-bar-button widget-close"
        aria-label={t(lang, "closeWidget")}
        title={t(lang, "closeWidget")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void closeWindow()}
      >
        ×
      </button>
    </div>
  );
}
