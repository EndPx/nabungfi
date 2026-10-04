import { lazy, Suspense } from "react";
import { LoginPage } from "./LoginPage";
import { usePwa } from "./pwa";

const LiveApp = lazy(() => import("./LiveApp"));

export default function Entry() {
  const pwa = usePwa();
  return (
    <Suspense fallback={<LoginPage status="initializing" offline={pwa.offline} />}>
      <LiveApp />
    </Suspense>
  );
}
