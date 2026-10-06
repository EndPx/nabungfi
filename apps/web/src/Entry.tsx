import { lazy, Suspense, useEffect, useState } from "react";
import { LoginPage } from "./LoginPage";
import { usePwa } from "./pwa";

const LiveApp = lazy(() => import("./LiveApp"));

export default function Entry() {
  const pwa = usePwa();
  const [requestedSdk, setRequestedSdk] = useState(!pwa.offline);
  useEffect(() => { if (!pwa.offline) setRequestedSdk(true); }, [pwa.offline]);
  // A cold offline launch has no authenticated cache. A running wallet session stays mounted.
  if (!requestedSdk) return <LoginPage status="ready" offline />;
  return (
    <Suspense fallback={<LoginPage status="initializing" offline={pwa.offline} />}>
      <LiveApp />
    </Suspense>
  );
}
