import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };
const blue = "var(--brand-blue)";
const yellow = "var(--brand-yellow)";
const green = "var(--brand-green)";

function icon(name: string, shape: ReactNode) {
  function BlockIcon({ size = 24, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden={props["aria-label"] ? undefined : true}
        data-block-icon={name}
        {...props}
      >
        {shape}
      </svg>
    );
  }
  BlockIcon.displayName = name;
  return BlockIcon;
}

// Identity icons use the same solid blocks and exposed studs as the N mark.
// Action glyphs use currentColor so warnings, disabled controls and focus stay legible.
export const Box = icon(
  "Goals",
  <g stroke="none">
    <path d="M3 15h8v7H3zm2-2h2v2H5zm4 0h2v2H9" fill={blue} />
    <path d="M11 8h10v7H11zm2-2h2v2h-2zm4 0h2v2h-2" fill={yellow} />
    <path d="M3 4h8v9H3zm2-2h2v2H5zm4 0h2v2H9m6 13h6v5h-6" fill={green} />
  </g>,
);
export const History = icon(
  "Activity",
  <g stroke="none">
    <path d="M3 15h6v7H3zm1-2h2v2H4" fill={blue} />
    <path d="M9 10h6v12H9zm1-2h2v2h-2" fill={green} />
    <path d="M15 5h6v17h-6zm1-2h2v2h-2" fill={yellow} />
  </g>,
);
export const Wallet = icon(
  "Wallet",
  <>
    <g stroke="none">
      <path d="M2 7h20v14H2Z" fill={blue} />
      <path d="M4 3h3v4H4zm6 0h3v4h-3zm6 0h3v4h-3" fill={blue} />
      <path d="M13 11h10v7H13Z" fill={yellow} />
    </g>
    <path d="M17 14h2" stroke="var(--ink)" />
  </>,
);
export const Settings2 = icon(
  "Settings",
  <>
    <path d="M5 3v18M12 3v18M19 3v18" />
    <g stroke="none">
      <path d="M2 6h6v5H2" fill={blue} />
      <path d="M9 13h6v5H9" fill={yellow} />
      <path d="M16 5h6v5h-6" fill={green} />
    </g>
  </>,
);
export const LockKeyhole = icon(
  "Lock",
  <>
    <path d="M7 10V4h10v6" />
    <path d="M4 10h16v11H4Z" />
    <path d="M11 14h2v3h-2Z" fill="currentColor" stroke="none" />
  </>,
);
export const ShieldCheck = icon(
  "Shield",
  <>
    <path d="M3 4h18v11l-9 7-9-7Z" />
    <path d="m7 12 3 3 6-6" />
  </>,
);
export const Plus = icon("Plus", <path d="M12 4v16M4 12h16" />);
export const X = icon("Close", <path d="m5 5 14 14M19 5 5 19" />);
export const Check = icon("Check", <path d="m4 12 5 5L20 6" />);
export const ArrowRight = icon(
  "Arrow right",
  <path d="M3 12h17m-6-6 6 6-6 6" />,
);
export const ArrowLeft = icon("Arrow left", <path d="M21 12H4m6-6-6 6 6 6" />);
export const ArrowUpRight = icon(
  "Arrow up right",
  <path d="M5 19 19 5M7 5h12v12" />,
);
export const ArrowDownLeft = icon(
  "Arrow down left",
  <path d="M19 5 5 19M5 7v12h12" />,
);
export const ChevronRight = icon("Chevron right", <path d="m9 5 7 7-7 7" />);
export const ChevronLeft = icon("Chevron left", <path d="m15 5-7 7 7 7" />);
export const ChevronDown = icon("Chevron down", <path d="m5 9 7 7 7-7" />);
export const ExternalLink = icon(
  "External link",
  <path d="M10 4H4v16h16v-6M14 3h7v7M11 13 21 3" />,
);
export const Download = icon(
  "Install",
  <path d="M12 2v13m-5-5 5 5 5-5M3 17v4h18v-4" />,
);
export const LogOut = icon(
  "Sign out",
  <path d="M10 3H3v18h7m3-15 6 6-6 6m-5-6h11" />,
);
export const RefreshCw = icon(
  "Refresh",
  <path d="M20 8V3m0 5h-5m5 0-5-5H6L3 6v5m1 5v5m0-5h5m-5 0 5 5h9l3-3v-5" />,
);
export const RotateCcw = icon(
  "Reset view",
  <path d="M4 8V3m0 5h5M4 8l5-5h9l3 4v10l-4 4H8l-4-4" />,
);
export const LoaderCircle = icon(
  "Loading",
  <path d="M13 3h5l3 3v12l-3 3H6l-3-3v-5" />,
);
export const TriangleAlert = icon(
  "Warning",
  <>
    <path d="m12 2 10 19H2Z" />
    <path d="M12 9v5m0 3v1" />
  </>,
);
export const Info = icon(
  "Information",
  <>
    <path d="M3 3h18v18H3Z" />
    <path d="M12 10v7m0-11v1" />
  </>,
);
export const CircleHelp = icon(
  "Help",
  <>
    <path d="M3 3h18v18H3ZM9 8V6h6v5l-3 2v2m0 3v1" />
  </>,
);
export const WifiOff = icon(
  "Offline",
  <path d="m3 3 18 18M8 4h8l5 5M3 9l2-2m5 3h4l3 3m-9 0 4 4m0 3v1" />,
);
export const Move = icon(
  "Rotate model",
  <path d="M12 2v20M2 12h20m-14-6 4-4 4 4m2 2 4 4-4 4M8 18l4 4 4-4M6 8l-4 4 4 4" />,
);
export const Volume2 = icon(
  "Sound on",
  <path d="M3 9h4l5-5v16l-5-5H3Zm13-2 3 3v4l-3 3m4-14 3 5v8l-3 5" />,
);
export const VolumeX = icon(
  "Sound off",
  <path d="M3 9h4l5-5v16l-5-5H3Zm13-1 6 8m0-8-6 8" />,
);
export const FlaskConical = icon(
  "Testnet",
  <path d="M9 2h6m-5 0v8L4 21h16l-6-11V2M7 16h10" />,
);
export const Sparkles = icon(
  "Built",
  <>
    <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
    <path d="M3 2v4M1 4h4" />
  </>,
);
export const Sprout = icon(
  "Earnings",
  <path d="M12 21V10M12 14H7L3 9V4h5l4 5m0 1h5l4-5V2h-5l-4 5" />,
);
