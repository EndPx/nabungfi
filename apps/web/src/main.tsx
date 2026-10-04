import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import { registerPwa } from "./pwa";
import { Logo } from "./ui";
import "./styles.css";
import { isAppRoute } from "./app-routes";

const Entry = lazy(() => import("./Entry"));

const DemoApp = lazy(() => import("./App"));
const Showcase = lazy(() => import("./DesignShowcase"));
const Landing = lazy(() => import("./Landing"));
const ModelShowcase = lazy(() => import("./ModelShowcase"));
const parameters = new URLSearchParams(window.location.search);
const appRoute = isAppRoute(location);
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
            Opening NabungFi…
          </p>
        </div>
      }
    >
      {appRoute ? (
        <Entry />
      ) : parameters.get("showcase") === "models" ? (
        <ModelShowcase />
      ) : parameters.has("showcase") ? (
        <Showcase />
      ) : import.meta.env.DEV && parameters.get("legacy-demo") === "1" ? (
        <DemoApp />
      ) : (
        <Landing initialPreviewMode={parameters.get("demo") === "1" ? "build" : "poster"} />
      )}
    </Suspense>
  </React.StrictMode>,
);
