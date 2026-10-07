// Original marketing artwork export fixture; excluded from the production build.
import {createRoot} from "react-dom/client";
import {StaticLandingModel} from "../../src/LandingSculpture";
import {LANDING_MODELS} from "../../src/landing-models";
import "../../src/styles.css";
import "../../src/landing.css";
const id=LANDING_MODELS.find(model=>model.id===new URLSearchParams(location.search).get("model"))?.id ?? "camera";
createRoot(document.getElementById("root")!).render(<StaticLandingModel id={id} />);
