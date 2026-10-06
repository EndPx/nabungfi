import { useEffect, useState, useSyncExternalStore } from "react";

export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let waitingWorker: ServiceWorker | null = null;
const subscribers = new Set<() => void>();
let installPrompt: InstallPrompt | null = null;
let installing = false;
let installed = false;
let registered = false;
let revision = 0;
const announce = () => { revision++; subscribers.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
const snapshot = () => revision;

export function registerPwa() {
  if (registered) return;
  registered = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installed = true;
    announce();
  });
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  let activeRegistration: ServiceWorkerRegistration | null = null;
  const watchInstalling = (registration: ServiceWorkerRegistration) => {
    const worker = registration.installing;
    if (!worker) return;
    const sync = () => {
      waitingWorker = registration.waiting ??
        (worker.state === "installed" && navigator.serviceWorker.controller ? worker : null);
      announce();
    };
    worker.addEventListener("statechange", sync);
    sync();
  };
  const register = () => {
    void navigator.serviceWorker
      .getRegistration("/")
      .then(existing => existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }))
      .then((registration) => {
        activeRegistration = registration;
        waitingWorker = registration.waiting;
        announce();
        registration.addEventListener("updatefound", () => watchInstalling(registration));
        watchInstalling(registration);
        if (navigator.onLine) void registration.update().catch(() => {});
      })
      .catch(() => {
        /* Installability never blocks the normal web app. */
      });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  window.addEventListener("online", () => {
    if (activeRegistration) void activeRegistration.update().catch(() => {});
    else register();
  });
}

export function usePwa() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installError, setInstallError] = useState("");
  const [installOutcome, setInstallOutcome] = useState<"accepted" | "dismissed" | null>(null);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener("change", announce);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      displayMode.removeEventListener("change", announce);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return {
    offline,
    standalone,
    installed,
    ios,
    installError,
    installOutcome,
    installing,
    canInstall: Boolean(installPrompt) && !standalone && !installed,
    updateAvailable: Boolean(waitingWorker),
    install: async () => {
      setInstallError("");
      setInstallOutcome(null);
      if (!installPrompt || installing || standalone || installed) return;
      const prompt = installPrompt;
      installing = true;
      announce();
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        setInstallOutcome(choice.outcome);
      } catch {
        setInstallError(
          "Installation could not open. You can keep using NabungFi in this browser.",
        );
      } finally {
        installPrompt = null;
        installing = false;
        announce();
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
