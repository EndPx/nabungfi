export const APP_DESTINATIONS = [
  "goals",
  "activity",
  "wallets",
  "faucets",
  "settings",
] as const;
export type Destination = (typeof APP_DESTINATIONS)[number];
type RouteLocation = Pick<Location, "pathname" | "search" | "hash">;
const isDestination = (value: string): value is Destination =>
  APP_DESTINATIONS.some((item) => item === value);

export function isAppRoute(location: RouteLocation) {
  return (
    location.pathname === "/login" ||
    location.pathname === "/login/" ||
    location.pathname === "/app" ||
    location.pathname.startsWith("/app/") ||
    new URLSearchParams(location.search).get("source") === "pwa" ||
    isDestination(location.hash.slice(1).split("?")[0])
  );
}

export function readAppRoute(location: RouteLocation) {
  if (location.pathname.replace(/\/$/, "") === "/login") {
    return readAppRoute(new URL(loginReturnTarget(location.search), "https://app.invalid"));
  }
  const path = location.pathname.replace(/\/$/, "").split("/")[2] ?? "";
  const [legacy, legacySearch = ""] = location.hash.slice(1).split("?");
  const destination: Destination = isDestination(path)
    ? path
    : isDestination(legacy)
      ? legacy
      : "goals";
  const params = new URLSearchParams(
    isDestination(path) ? location.search : legacySearch || location.search,
  );
  return {
    destination,
    goalId: destination === "goals" ? params.get("goal") : null,
  };
}

export function appHref(destination: Destination, goalId?: string) {
  return `/app/${destination}${destination === "goals" && goalId ? `?goal=${encodeURIComponent(goalId)}` : ""}`;
}

export function safeAppReturnTarget(value: string | null | undefined) {
  const fallback = appHref("goals");
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || !/^\/app(?:\/(goals|activity|wallets|faucets|settings))?\/?$/.test(url.pathname)) return fallback;
    const route = readAppRoute(url);
    return appHref(route.destination, route.goalId ?? undefined);
  } catch { return fallback; }
}

export function loginReturnTarget(search: string) {
  return safeAppReturnTarget(new URLSearchParams(search).get("next"));
}

export function loginHref(returnTo = appHref("goals")) {
  return `/login?next=${encodeURIComponent(safeAppReturnTarget(returnTo))}`;
}

export function replaceAppLocation(href: string) {
  if (location.pathname + location.search + location.hash === href) return;
  history.replaceState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function navigateApp(destination: Destination, goalId?: string) {
  const next = appHref(destination, goalId);
  if (location.pathname + location.search + location.hash === next) return;
  history.pushState(null, "", next);
  // pushState does not emit an event. Use the same read path as browser Back.
  window.dispatchEvent(new PopStateEvent("popstate"));
}
