import { Component, type ReactNode } from "react";

export function LandingPoster() {
  return (
    <figure className="landing-studio landing-studio--poster">
      <div className="landing-studio-note" aria-hidden="true"><span className="studio-note-block" />Small steps. Real possibilities.</div>
      <div className="landing-sculpture">
        <img src="/illustrations/landing-camera.webp" width={800} height={800}
          alt="An original blue and ivory camera built from toy bricks" fetchPriority="high" />
      </div>
    </figure>
  );
}

export class LandingArtBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <LandingPoster /> : this.props.children;}
}
