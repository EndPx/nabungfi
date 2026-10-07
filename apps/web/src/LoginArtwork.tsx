import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { BuildingMark } from "./BuildingMark";
import { Button } from "./ui";

export function LoginArtwork() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    let timeline: gsap.core.Timeline | undefined;
    const syncVisibility = () => {
      if (!timeline) return;
      const visible = document.visibilityState !== "hidden";
      timeline.paused(!visible);
      element.dataset.running = visible ? "true" : "false";
    };

    media.add({ desktop: "(min-width: 900px)", reduced: "(prefers-reduced-motion: reduce)" }, context => {
      element.dataset.running = "false";
      if (!context.conditions?.desktop || context.conditions.reduced || paused) return;
      const bodies = Array.from(element.querySelectorAll<SVGRectElement>(
        'svg > g:not([data-piece-group="exposed-studs"]) rect, svg > rect',
      )).sort((a, b) => Number(b.getAttribute("y")) - Number(a.getAttribute("y")));
      const studs = element.querySelector('[data-piece-group="exposed-studs"]');
      const mark = element.querySelector(".login-emblem");
      const hold = { value: 0 };
      timeline = gsap.timeline({ repeat: -1 });
      timeline
        .fromTo(bodies, {
          x: i => i % 2 ? 26 : -26,
          y: i => -46 - (i % 3) * 12,
          rotation: i => i % 2 ? 9 : -9,
          opacity: 0,
          transformOrigin: "50% 50%",
        }, {
          x: 0, y: 0, rotation: 0, opacity: 1,
          duration: 0.6, stagger: 0.065, ease: "back.out(1.1)",
        }, 0.18)
        .fromTo(studs, { opacity: 0, y: -3 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 1.65)
        .to(mark, { y: -6, duration: 1.5, ease: "sine.inOut" }, 2)
        .to(mark, { y: 0, duration: 1.5, ease: "sine.inOut" }, 3.5)
        .to(studs, { opacity: 0, duration: 0.15 }, 5.05)
        .to(bodies, {
          x: i => i % 2 ? 22 : -22,
          y: i => -30 - (i % 3) * 18,
          rotation: i => i % 2 ? -7 : 7,
          opacity: 0, duration: 0.5,
          stagger: { each: 0.03, from: "end" }, ease: "power2.in",
        }, 5.2)
        .to(hold, { value: 1, duration: 0.4 }, 6.1);
      syncVisibility();
      return () => { timeline?.kill(); timeline = undefined; element.dataset.running = "false"; };
    }, element);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      media.revert();
    };
  }, [paused]);

  return (
    <div className="login-art" ref={root}>
      <div className="login-art-scene" role="img" aria-label="The NabungFi N assembled from blue, yellow and red toy blocks">
        <span className="login-art-shadow" aria-hidden="true" />
        <BuildingMark className="login-emblem" />
      </div>
      <Button variant="quiet" className="login-art-pause" aria-pressed={paused}
        onClick={() => setPaused(value => !value)}>
        {paused ? "Resume artwork" : "Pause artwork"}
      </Button>
    </div>
  );
}
