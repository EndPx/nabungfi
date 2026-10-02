import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import { registerPwa } from "./pwa";
import { Logo } from "./ui";
import Entry from "./Entry";
import "./styles.css";

const DemoApp = lazy(() => import("./App"));
const Showcase = lazy(() =>
  import("./App").then((module) => ({ default: module.PrimitiveShowcase })),
);
const ModelShowcase = lazy(() => import("./ModelShowcase"));
const parameters = new URLSearchParams(window.location.search);
registerPwa();

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
    <Suspense
      fallback={
        <div className="app" style={{ padding: 32 }}>
          <Logo />
          <p role="status" style={{ marginTop: 24 }}>
            Opening your workshop…
          </p>
        </div>
      }
    >
      {parameters.get("showcase") === "models" ? (
        <ModelShowcase />
      ) : parameters.has("showcase") ? (
        <Showcase />
      ) : parameters.get("demo") === "1" ? (
        <DemoApp />
      ) : (
        <Entry />
      )}
    </Suspense>
  </React.StrictMode>,
);
