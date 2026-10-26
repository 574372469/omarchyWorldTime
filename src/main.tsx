import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Omarchy ships JetBrainsMono Nerd Font; this is the same face, self-hosted so
// the clock looks the same on a machine that has never installed it.
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
