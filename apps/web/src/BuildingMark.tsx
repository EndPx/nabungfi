import canonicalMark from "virtual:nabungfi-mark";
// Reuse the approved master. Local group data avoids duplicate document IDs.
const markup = canonicalMark.replaceAll(" id=", " data-piece-group=");
export function BuildingMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`building-mark ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
