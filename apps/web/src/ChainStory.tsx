import { BuildingMark } from "./BuildingMark";

export function ChainStory() {
  return (
    <section className="chain-story" aria-labelledby="chain-story-title">
      <div className="chain-story-copy">
        <h2 id="chain-story-title">
          Many chains.
          <br />
          One thing you’re building.
        </h2>
        <p>
          Save where your USDC already is. Progress comes together for one goal,
          while funds stay in their own vaults.
        </p>
        <span className="story-message-label">
          Progress messages, not moving funds
        </span>
      </div>
      <div
        className="chain-story-diagram"
        role="img"
        aria-label="Progress messages from Solana, Base, Arbitrum and Ethereum contribute to a single goal. Funds stay on each chain."
      >
        <svg
          className="chain-story-paths"
          viewBox="0 0 520 400"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {[
            "M90 84H176V200H260",
            "M430 84H344V200H260",
            "M90 316H176V200H260",
            "M430 316H344V200H260",
          ].map((d, i) => (
            <g key={d}>
              <path d={d} stroke="var(--line)" strokeWidth={2} />
              <path
                className="chain-flow-line"
                d={d}
                pathLength={1}
                strokeDasharray="1 1"
                strokeWidth={3}
                stroke={i % 2 ? "var(--brand-red)" : "var(--brand-blue)"}
              />
            </g>
          ))}
          {[
            [176, 142],
            [344, 142],
            [176, 258],
            [344, 258],
          ].map(([x, y]) => (
            <rect
              className="chain-checkpoint"
              key={x + ":" + y}
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              fill="var(--brand-yellow)"
            />
          ))}
        </svg>
        <div className="chain-story-node chain-node--solana">
          <img
            src="/chains/solana.png"
            width={36}
            height={36}
            alt=""
            aria-hidden="true"
          />
          <span>
            Solana<small>Your vault</small>
          </span>
        </div>
        <div className="chain-story-node chain-node--base">
          <img
            src="/chains/base.png"
            width={36}
            height={36}
            alt=""
            aria-hidden="true"
          />
          <span>
            Base<small>Your vault</small>
          </span>
        </div>
        <div className="chain-story-node chain-node--arbitrum">
          <img
            src="/chains/arbitrum.png"
            width={36}
            height={36}
            alt=""
            aria-hidden="true"
          />
          <span>
            Arbitrum<small>Your vault</small>
          </span>
        </div>
        <div className="chain-story-node chain-node--ethereum">
          <img
            src="/chains/ethereum.png"
            width={36}
            height={36}
            alt=""
            aria-hidden="true"
          />
          <span>
            Ethereum<small>Your vault</small>
          </span>
        </div>
        <div className="chain-story-goal">
          <BuildingMark />
          <strong>Your goal</strong>
        </div>
      </div>
    </section>
  );
}
