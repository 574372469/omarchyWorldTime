import { useEffect, useState } from "react";
import { isDesktop } from "../lib/desktop";
import { t, type Lang } from "../lib/i18n";
import { watchForUpdates, type AvailableUpdate, type InstallPhase } from "../lib/updates";

interface Props {
  lang: Lang;
}

type State =
  | { kind: "hidden" }
  | { kind: "offered"; update: AvailableUpdate }
  | { kind: "working"; update: AvailableUpdate; phase: InstallPhase }
  | { kind: "failed"; update: AvailableUpdate };

/** A newer release, offered once the widget has found one. */
export function UpdateNotice({ lang }: Props) {
  const [state, setState] = useState<State>({ kind: "hidden" });

  useEffect(() => {
    if (!isDesktop) return;
    return watchForUpdates((update) => setState({ kind: "offered", update }));
  }, []);

  if (state.kind === "hidden") return null;

  const start = async () => {
    const { update } = state;
    try {
      await update.install((phase) => setState({ kind: "working", update, phase }));
    } catch {
      // A failed install leaves the running build untouched; the banner stays
      // so it can be tried again.
      setState({ kind: "failed", update });
    }
  };

  const working = state.kind === "working";
  const status =
    state.kind === "working"
      ? t(lang, state.phase === "downloading" ? "updateDownloading" : "updateInstalling")
      : state.kind === "failed"
        ? t(lang, "updateFailed")
        : null;

  return (
    <div className="update-notice" role="status" aria-live="polite">
      <span className="update-text">
        {status ?? t(lang, "updateReady", { version: state.update.version })}
      </span>
      {!working && (
        <>
          <button
            type="button"
            className="update-button"
            onClick={() => void start()}
          >
            {t(lang, "updateInstall")}
          </button>
          <button
            type="button"
            className="update-dismiss"
            onClick={() => setState({ kind: "hidden" })}
            aria-label={t(lang, "updateLater")}
            title={t(lang, "updateLater")}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
