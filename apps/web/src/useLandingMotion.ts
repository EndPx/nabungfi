import { useEffect, useRef, type RefObject } from "react";

export function useLandingMotion(
  root: RefObject<HTMLDivElement | null>,
  disabled: boolean,
) {
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (disabled || !root.current) return;
    let active = true;
    let context: { revert(): void } | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (!active || !root.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const page = root.current;
        context = gsap.context(() => {
          const hero = gsap.timeline({
            defaults: { ease: "power3.out", duration: 0.95 },
          });
          hero
            .from(".hero-word", { yPercent: 65, stagger: 0.06 }, 0)
            .from(".landing-hero-copy > p", { y: 18 }, 0.14)
            .from(
              ".landing-preview",
              { y: 28, rotation: 1.5, scale: 0.96 },
              0.1,
            );

          const reading = page.querySelector(".landing-reading-progress");
          gsap.fromTo(
            reading,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: page,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.2,
              },
            },
          );

          const assemble = (mark: Element, scrollTrigger: object) => {
            const bodies = mark.querySelectorAll(
              'svg > g:not([data-piece-group="exposed-studs"]) rect, svg > rect',
            );
            const studs = mark.querySelectorAll(
              '[data-piece-group="exposed-studs"] rect',
            );
            return gsap
              .timeline({ scrollTrigger })
              .from(bodies, {
                x: (i) => (i % 2 ? 52 : -52),
                y: (i) => -55 - (i % 4) * 12,
                rotation: (i) => (i % 2 ? 12 : -12),
                opacity: 0.08,
                transformOrigin: "50% 50%",
                stagger: 0.055,
                duration: 0.7,
                ease: "back.out(1.15)",
              })
              .from(
                studs,
                { opacity: 0, y: -5, duration: 0.22, stagger: 0.015 },
                "-=.22",
              );
          };

          const diagram = page.querySelector(".chain-story-diagram");
          if (diagram) {
            const flow = gsap.timeline({
              scrollTrigger: {
                trigger: diagram,
                start: "top 80%",
                end: "center 48%",
                scrub: 0.65,
              },
            });
            flow
              .from(".chain-story-node", {
                y: 20,

                stagger: 0.1,
                ease: "power2.out",
              })
              .fromTo(
                ".chain-flow-line",
                { strokeDashoffset: 1 },
                {
                  strokeDashoffset: 0,
                  stagger: 0.12,
                  duration: 0.7,
                  ease: "none",
                },
                0.15,
              )
              .fromTo(
                ".chain-checkpoint",
                { scale: 0.4, opacity: 0.1 },
                {
                  scale: 1,
                  opacity: 1,
                  stagger: 0.12,
                  transformOrigin: "50% 50%",
                  ease: "back.out(1.4)",
                },
                0.5,
              );
            const mark = diagram.querySelector(".building-mark");
            if (mark)
              assemble(mark, {
                trigger: diagram,
                start: "top 72%",
                end: "center 48%",
                scrub: 0.65,
              });
          }

          const steps = gsap.utils.toArray<HTMLElement>(".landing-steps li");
          steps.forEach((step) => {
            gsap.from(step.querySelector(".step-number"), {
              scale: 0.65,
              rotation: -10,
              duration: 0.65,
              ease: "back.out(1.5)",
              scrollTrigger: {
                trigger: step,
                start: "top 88%",
                once: true,
                invalidateOnRefresh: true,
              },
            });
            gsap.from(step.querySelector("div"), {
              x: () => (innerWidth < 768 ? 12 : 24),

              duration: 0.65,
              ease: "power3.out",
              scrollTrigger: {
                trigger: step,
                start: "top 88%",
                once: true,
                invalidateOnRefresh: true,
              },
            });
          });
          gsap.from(".landing-commitment .commitment-icon", {
            y: -30,
            rotation: -12,
            duration: 0.7,
            ease: "back.out(1.3)",
            scrollTrigger: {
              trigger: ".landing-commitment",
              start: "top 88%",
              once: true,
            },
          });
          gsap.from(".landing-faq details", {
            x: 16,

            stagger: 0.075,
            duration: 0.65,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".landing-faq",
              start: "top 85%",
              once: true,
            },
          });
          const finish = page.querySelector(".landing-finish .building-mark");
          if (finish)
            assemble(finish, {
              trigger: ".landing-finish",
              start: "top 85%",
              once: true,
            });
        }, page);
        refresh.current = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            if (active) ScrollTrigger.refresh();
          });
        };
        observer = new ResizeObserver(refresh.current);
        const preview = page.querySelector(".landing-preview");
        if (preview) observer.observe(preview);
        void document.fonts.ready.then(() => {
          if (active) refresh.current();
        });
      })
      .catch(() => {
        // Fully visible document content remains usable if motion cannot load.
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      context?.revert();
      refresh.current = () => undefined;
    };
  }, [root, disabled]);
  return () => refresh.current();
}
