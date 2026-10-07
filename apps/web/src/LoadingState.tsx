import { useEffect, useRef } from "react";
import { BuildingMark } from "./BuildingMark";
import "./loading.css";

export function LoadingState({ message, description, fullscreen = false }: {
  message: string;
  description?: string;
  fullscreen?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const Heading = fullscreen ? "h1" : "h2";
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => { element.dataset.hidden = document.visibilityState === "hidden" ? "true" : "false"; };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <div ref={root} className={`loading-state ${fullscreen ? "app-splash" : "goal-loading"}`} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-state-content">
        <BuildingMark className="loading-mark" />
        {fullscreen && <p className="loading-brand">NabungFi</p>}
        <Heading>{message}</Heading>
        {description && <p className="loading-description">{description}</p>}
      </div>
    </div>
  );
}

export function AppSplash() {
  return <LoadingState fullscreen message="Opening NabungFi…" description="Your workshop is getting ready." />;
}
