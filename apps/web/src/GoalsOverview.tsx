import { useId, useState } from "react";
import type { GoalDTO } from "@nabungfi/shared/application";
import { Box, History, Plus, Search, Wallet, X } from "./icons";
import { Button, IconButton } from "./ui";
import { GoalCard, PortfolioSummary } from "./live-components";

type Filter = "all" | "progress" | "reached";
const filters = [{ id: "all", label: "All goals" }, { id: "progress", label: "In progress" }, { id: "reached", label: "Reached" }] as const;
const reached = (goal: GoalDTO) => ["achieved", "claimed"].includes(goal.chainState?.phase ?? "");

export function GoalsOverview({ goals, balance, scope, blocked, create, open, activity, wallets }: {
  goals: GoalDTO[];
  balance: string;
  scope: string;
  blocked: boolean;
  create: () => void;
  open: (id: string) => void;
  activity: () => void;
  wallets: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searchId = useId();
  const visible = goals.filter(goal => goal.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (filter === "all" || (filter === "reached" ? reached(goal) : !reached(goal))));
  const reset = () => { setQuery(""); setFilter("all"); };
  return <>
    <div className="page-heading goals-heading">
      <div><p className="page-eyebrow">YOUR SAVINGS, TAKING SHAPE</p><h1>Your goals</h1><p>A little closer with every deposit.</p></div>
      <Button variant="build" onClick={create} disabled={blocked}><Plus size={18} />New goal</Button>
    </div>
    <PortfolioSummary balance={balance} scope={scope} />
    <div className="overview-actions" role="group" aria-label="Savings shortcuts">
      <Button variant="secondary" onClick={activity}><History size={21} />View activity</Button>
      <Button variant="secondary" onClick={wallets}><Wallet size={21} />Your wallets</Button>
    </div>
    <section className="goal-collection" aria-labelledby="goal-collection-heading">
      <div className="collection-heading"><h2 id="goal-collection-heading">Your builds <span>{goals.length}</span></h2><span className="live-help">Each one has its own target.</span></div>
      {goals.length > 0 && <>
        <div className="goals-tools">
          <label className="app-search" htmlFor={searchId}><Search size={19} /><span className="sr-only">Search goals</span><input id={searchId} type="search" placeholder="Search your goals" value={query} onChange={event => setQuery(event.target.value)} />{query && <IconButton label="Clear goal search" onClick={() => setQuery("")}><X size={16} /></IconButton>}</label>
          <div className="app-filters" role="group" aria-label="Filter goals">{filters.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        </div>
        <p className="sr-only" role="status">{visible.length} matching goal{visible.length === 1 ? "" : "s"}</p>
      </>}
      {goals.length === 0 ? <div className="empty-state goals-empty">
        <span className="empty-mark"><Box size={56} /></span><h2>Your first build starts here.</h2><p>A car, a laptop, a place of your own. Give your plan a target, then add USDC at your own pace.</p><Button variant="build" disabled={blocked} onClick={create}>Create your first goal <Plus size={18} /></Button>
      </div> : visible.length > 0 ? <div className="goal-grid">
        {visible.map(goal => <GoalCard key={goal.id} goal={goal} onOpen={() => open(goal.id)} />)}
        {filter === "all" && !query && <button type="button" className="goal-card goal-card-add" disabled={blocked} onClick={create}><span className="section-icon"><Plus size={26} /></span><strong>Make room for another goal</strong><span>A new plan. A new build.</span></button>}
      </div> : <div className="empty-state goals-empty"><Search size={40} /><h2>No goals found.</h2><p>Try another name or see all of your goals.</p><Button variant="secondary" onClick={reset}>Reset filters</Button></div>}
    </section>
  </>;
}
