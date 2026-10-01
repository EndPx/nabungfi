import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import App, { PrimitiveShowcase } from "./App";
import "./styles.css";

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1"
) {
  void import("react-grab");
  void import("react-scan").then(({ scan }) =>
    scan({ enabled: true, showToolbar: false }),
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has("showcase") ? (
      <PrimitiveShowcase />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
