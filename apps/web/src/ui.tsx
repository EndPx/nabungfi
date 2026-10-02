import {
  Component,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Box, LoaderCircle, X } from "./icons";

export class WorkshopBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="workshop workshop-skeleton">
          <Box size={36} />
          <h2>The workshop couldn't load</h2>
          <p>Your savings details and financial actions are still available.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload workshop
          </Button>
        </div>
      );
    return this.props.children;
  }
}

export function Button({
  children,
  className = "",
  variant = "primary",
  busy,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "build" | "quiet";
  busy?: boolean;
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      type="button"
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${wide ? "dialog--wide" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={onClose}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </div>
        {description && (
          <p className="dialog-description" id={descriptionId}>
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}

export function ChainMark({ chain }: { chain: "solana" | "base" }) {
  return (
    <span className={`chain-mark chain-mark--${chain}`} aria-hidden="true">
      {chain === "solana" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m6 5-3 3h15l3-3H6Zm-3 6 3 3h15l-3-3H3Zm3 6-3 3h15l3-3H6Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <span />
      )}
    </span>
  );
}

export function Logo() {
  return (
    <span className="brand">
      <img
        className="brand-mark"
        src="/brand/nabungfi-mark-small.svg"
        width={36}
        height={36}
        alt=""
        aria-hidden="true"
      />
      <span className="brand-wordmark">NabungFi</span>
    </span>
  );
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
