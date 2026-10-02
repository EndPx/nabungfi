export const APP_DESTINATIONS = [
  "goals",
  "activity",
  "wallets",
  "settings",
] as const;
export type Destination = (typeof APP_DESTINATIONS)[number];
type RouteLocation = Pick<Location, "pathname" | "search" | "hash">;
const isDestination = (value: string): value is Destination =>
  APP_DESTINATIONS.some((item) => item === value);

export function isAppRoute(location: RouteLocation) {
  return (
    location.pathname === "/app" ||
    location.pathname.startsWith("/app/") ||
    new URLSearchParams(location.search).get("source") === "pwa" ||
    isDestination(location.hash.slice(1).split("?")[0])
  );
}

export function readAppRoute(location: RouteLocation) {
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

export function navigateApp(destination: Destination, goalId?: string) {
  const next = appHref(destination, goalId);
  if (location.pathname + location.search + location.hash === next) return;
  history.pushState(null, "", next);
  // pushState does not emit an event. Use the same read path as browser Back.
  window.dispatchEvent(new PopStateEvent("popstate"));
}
