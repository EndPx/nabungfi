import { useEffect, useState } from "react";

export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let waitingWorker: ServiceWorker | null = null;
const subscribers = new Set<() => void>();
let installPrompt: InstallPrompt | null = null;
const announce = () => subscribers.forEach((listener) => listener());

export function registerPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    announce();
  });
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        waitingWorker = registration.waiting;
        announce();
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", () => {
            waitingWorker = registration.waiting;
            announce();
          });
        });
      })
      .catch(() => {
        /* Installability never blocks the normal web app. */
      });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

export function usePwa() {
  const [, update] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installError, setInstallError] = useState("");
  useEffect(() => {
    const listener = () => update((count) => count + 1);
    const online = () => setOffline(!navigator.onLine);
    subscribers.add(listener);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      subscribers.delete(listener);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return {
    offline,
    standalone,
    ios,
    installError,
    canInstall: Boolean(installPrompt),
    updateAvailable: Boolean(waitingWorker),
    install: async () => {
      setInstallError("");
      if (!installPrompt) return;
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        announce();
      } catch {
        setInstallError(
          "Installation could not open. You can keep using NabungFi in this browser.",
        );
      }
    },
    update: () => {
      // The caller must reconcile pending wallet operations before requesting an update.
      if (!waitingWorker) return;
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true },
      );
      waitingWorker.postMessage({ type: "ACTIVATE_UPDATE" });
    },
  };
}
