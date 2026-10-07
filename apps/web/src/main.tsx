import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import { registerPwa } from "./pwa";
import { Logo } from "./ui";
import { AppSplash } from "./LoadingState";
import "./styles.css";
import { isAppRoute } from "./app-routes";

const Entry = lazy(() => import("./Entry"));

const Showcase = lazy(() => import("./DesignShowcase"));
const Landing = lazy(() => import("./Landing"));
const ModelShowcase = lazy(() => import("./ModelShowcase"));
const parameters = new URLSearchParams(window.location.search);
const legacyDemoPath=/^\/demo(?:\/|$)/.test(location.pathname);
if (legacyDemoPath || parameters.has("demo") || parameters.has("legacy-demo")) {
  parameters.delete("demo");
  parameters.delete("legacy-demo");
  const query=parameters.toString();
  history.replaceState(null,"",`${legacyDemoPath ? "/" : location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}
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
      fallback={appRoute ? <AppSplash /> :
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
      ) : (
        <Landing />
      )}
    </Suspense>
  </React.StrictMode>,
);
