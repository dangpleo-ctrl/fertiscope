// Pure, deterministic math used by the UI. Everything here is exact token economics —
// NOT an accuracy prediction. The one estimate (multiTurnRisk) is clearly labelled.

export function costMultiplier(fertility: number, englishBaseline: number): number {
  return fertility / englishBaseline;
}

// How many in-context examples of `tokensPerExample` fit in window W (reserving room for a reply).
export function inContextCapacity(tokensPerExample: number, window: number, reserve = 512): number {
  return Math.max(0, Math.floor((window - reserve) / Math.max(1, tokensPerExample)));
}

// Cumulative context consumed across conversation turns (deterministic).
export function contextBudgetSeries(tokensPerTurn: number, turns = 12) {
  return Array.from({ length: turns }, (_, i) => ({ turn: i + 1, tokens: Math.round(tokensPerTurn * (i + 1)) }));
}

// The turn at which cumulative tokens cross a fraction of the window.
export function turnsToFraction(tokensPerTurn: number, window: number, frac = 0.75): number {
  return (frac * window) / Math.max(1, tokensPerTurn);
}

// HEURISTIC multi-turn degradation RISK — an estimate, not a precise accuracy number.
// Budget pressure (how fast cumulative tokens exhaust the window) is the PRIMARY driver,
// scored 0-2. Fertility (0-2) only AMPLIFIES once the budget is actually under pressure —
// so on a roomy window (e.g. 128k) where a short chat never dents the budget, risk stays Low
// regardless of fertility, exactly as the research notes (the mechanism mainly bites in
// constrained windows). Total 0-4 -> Low (<=1) / Medium (2) / High (>=3).
export function multiTurnRisk(tokensPerTurn: number, window: number, fertilityRatio: number) {
  const t75 = turnsToFraction(tokensPerTurn, window, 0.75);
  const budgetScore = t75 < 6 ? 2 : t75 < 12 ? 1 : 0;
  const fertilityRaw = fertilityRatio >= 8 ? 2 : fertilityRatio >= 4 ? 1 : 0;
  const fertilityScore = budgetScore > 0 ? fertilityRaw : 0; // amplifier: only under budget pressure
  const score = budgetScore + fertilityScore;
  const level = score >= 3 ? "High" : score >= 2 ? "Medium" : "Low";
  const color = level === "High" ? "#ef4444" : level === "Medium" ? "#f59e0b" : "#10b981";
  return { level, color, turnsTo75: Math.round(t75), score, budgetScore, fertilityScore, fertilityRaw };
}

export function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}
export function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
}
export function windowLabel(w: number): string {
  return w >= 1024 ? `${Math.round(w / 1024)}K` : `${w}`;
}
