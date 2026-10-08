import { useEffect, useRef, useState } from "react";
import type { AppNetwork, GoalDTO } from "@nabungfi/shared/application";
import { clearGoalSetup, goalSetupStage, restoreGoalSetup, saveGoalSetup, type GoalSetupIntent } from "./goal-setup";

interface Options {
  userId: string | null;
  goals: GoalDTO[];
  blocked: boolean;
  initialReadSettled: boolean;
  plan: (goal: GoalDTO, action: "create-vault" | "initialize", network: AppNetwork) => Promise<boolean>;
  refresh: () => Promise<void>;
  ready: () => void;
  error: (failure: unknown) => void;
}
export function useGoalSetup(options: Options) {
  const current = useRef(options); current.current = options;
  const [intent, setIntent] = useState<GoalSetupIntent | null>(null);
  const intentRef = useRef<GoalSetupIntent | null>(null);
  const [tick, setTick] = useState(0);
  const planning = useRef(false);
  useEffect(() => {
    try { const next = options.userId ? restoreGoalSetup(localStorage, options.userId) : null; intentRef.current = next; setIntent(next); }
    catch (failure) { intentRef.current = null; setIntent(null); current.current.error(failure); }
  }, [options.userId]);
  const ownIntent = intent?.userId === options.userId ? intent : null;
  const pause = () => {
    const previous = intentRef.current;
    if (!previous || previous.userId !== current.current.userId) return;
    const next = { ...previous, paused: true };
    try { saveGoalSetup(localStorage, next); } catch (failure) { current.current.error(failure); }
    intentRef.current = next; setIntent(next);
  };
  const start = (goal: GoalDTO) => {
    const userId = current.current.userId;
    if (!userId) return;
    const next = { userId, goalId: goal.id, name: goal.name, paused: false };
    try { saveGoalSetup(localStorage, next); intentRef.current = next; setIntent(next); }
    catch (failure) { current.current.error(failure); }
  };
  useEffect(() => {
    if (!ownIntent || ownIntent.paused || options.blocked || !options.initialReadSettled || planning.current) return;
    const goal = options.goals.find(goal => goal.id === ownIntent.goalId);
    if (!goal) return;
    const stage = goalSetupStage(goal);
    if (stage.kind === "ready") {
      clearGoalSetup(localStorage, ownIntent.userId); intentRef.current = null; setIntent(null); current.current.ready(); return;
    }
    if (stage.kind !== "wallet") {
      const timer = setTimeout(() => void current.current.refresh(), 5000);
      return () => clearTimeout(timer);
    }
    const original = ownIntent;
    planning.current = true;
    void options.plan(goal, stage.action, stage.network).then(success => {
      if (!success && current.current.userId === original.userId) pause();
    }).catch(failure => {
      if (current.current.userId === original.userId) { current.current.error(failure); pause(); }
    }).finally(() => { planning.current = false; setTick(value => value + 1); });
  }, [ownIntent, options.goals, options.blocked, options.initialReadSettled, tick]);
  return { intent: ownIntent, running: Boolean(ownIntent && !ownIntent.paused), start, pause,
    isActive: (goalId: string) => Boolean(intentRef.current && intentRef.current.userId === current.current.userId &&
      intentRef.current.goalId === goalId && !intentRef.current.paused),
  };
}
