"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  TOKENIZERS, LANGUAGES, ENGLISH_BASELINE, CONTEXT_WINDOWS, tierFor, type TokenizerId,
} from "@/lib/constants";
import { costMultiplier, inContextCapacity, contextBudgetSeries, multiTurnRisk, fmt, windowLabel } from "@/lib/calc";
import { Card, SectionLabel, Caveat, Deterministic, Estimated } from "@/components/ui";
import samples from "@/lib/samples.json";

type AnalyzeResult = {
  words: number;
  chars: number;
  display: TokenizerId;
  perTokenizer: Record<TokenizerId, { tokens: number; fertility: number }>;
  chips: string[];
  chipsTruncated: boolean;
};

export default function AnalyzerPage() {
  const [text, setText] = useState("");
  const [bcp47, setBcp47] = useState("ta");
  const [display, setDisplay] = useState<TokenizerId>("llama3");
  const [windowSize, setWindowSize] = useState(8192);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(t = text, loc = bcp47, disp = display) {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, bcp47: loc, display: disp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function loadSample(s: (typeof samples)[number]) {
    setText(s.text);
    setBcp47(s.bcp47);
    setResult(null);
  }

  const dPer = result?.perTokenizer[display];
  const tokensPerTurn = dPer?.tokens ?? 0;
  const tier = dPer ? tierFor(dPer.fertility) : null;
  const budget = contextBudgetSeries(tokensPerTurn, 12);
  const ratio = dPer ? costMultiplier(dPer.fertility, ENGLISH_BASELINE[display]) : 0;
  const risk = dPer ? multiTurnRisk(tokensPerTurn, windowSize, ratio) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <div className="mb-8 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Real tokenizers · GPT-4o · GPT-4/3.5 · Llama-3.1 / SEA-LION v3
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          The hidden <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">multilingual tax</span> in your tokenizer
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-400">
          Paste text in any Asian language and see its tokenizer <b className="text-gray-200">fertility</b> (tokens per word),
          the <b className="text-gray-200">cost multiplier</b> vs. English, and the <b className="text-gray-200">context-budget risk</b> over a
          multi-turn chat — before you deploy.
        </p>
      </div>

      {/* Input */}
      <Card className="p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text in any language…  (e.g. Tamil, Thai, Burmese, Khmer)"
          rows={4}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-[15px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/50"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Language (for word counting)">
            <select value={bcp47} onChange={(e) => setBcp47(e.target.value)} className="select">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.bcp47}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tokenizer to visualise">
            <select value={display} onChange={(e) => setDisplay(e.target.value as TokenizerId)} className="select">
              {TOKENIZERS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Field>
          <button
            onClick={() => analyze()}
            disabled={loading || !text.trim()}
            className="ml-auto rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          {samples.map((s) => (
            <button
              key={s.code}
              onClick={() => loadSample(s)}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300 transition hover:border-indigo-500/40 hover:text-white"
            >
              {s.name}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">⚠ {error}</p>}
      </Card>

      {result && dPer && tier && risk && (
        <div className="mt-6 space-y-6">
          {/* Tokenizer comparison */}
          <section>
            <SectionLabel>Fertility by tokenizer · cost multiplier vs. English <Deterministic /></SectionLabel>
            <div className="grid gap-3 sm:grid-cols-3">
              {TOKENIZERS.map((t) => {
                const p = result.perTokenizer[t.id];
                const tt = tierFor(p.fertility);
                const mult = costMultiplier(p.fertility, ENGLISH_BASELINE[t.id]);
                const isSel = t.id === display;
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border p-4 transition ${isSel ? "border-indigo-400/50 bg-indigo-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{t.label}</span>
                      <span className="text-[10px] text-gray-500">{t.family}</span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-4xl font-bold tabular-nums" style={{ color: tt.color }}>{p.fertility.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">tok / word</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-300">
                      <b className="tabular-nums" style={{ color: tt.color }}>{mult.toFixed(1)}×</b> the cost of English
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.fertility / 13) * 100)}%`, background: tt.color }} />
                    </div>
                    <div className="mt-1.5 text-[11px]" style={{ color: tt.color }}>{tt.label} · {tt.blurb}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Token fragmentation */}
          <section>
            <SectionLabel>How {TOKENIZERS.find((t) => t.id === display)?.label} shatters this text <Deterministic /></SectionLabel>
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Stat label="words" value={fmt(result.words)} />
                <Stat label="tokens" value={fmt(dPer.tokens)} accent={tier.color} />
                <Stat label="characters" value={fmt(result.chars)} />
                <Stat label="fertility" value={`${dPer.fertility.toFixed(2)} tok/word`} accent={tier.color} />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2" dir="auto">
                {result.chips.map((c, i) => (
                  <span
                    key={i}
                    className="tok"
                    style={{ background: i % 2 ? "rgba(129,140,248,0.16)" : "rgba(217,70,239,0.13)", color: "#e8eaf6" }}
                    title={`token ${i + 1}`}
                  >
                    {c === " " ? "·" : c}
                  </span>
                ))}
                {result.chipsTruncated && <span className="tok text-gray-500">… (+more)</span>}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Each chip is one token. On high-fertility scripts a single word fractures into many byte-level pieces
                (the <span className="text-gray-400">�</span> fragments are partial UTF-8 bytes) — that is the tax, visualised.
              </p>
            </Card>
          </section>

          {/* Context budget + risk */}
          <section>
            <SectionLabel>Context budget over a multi-turn chat</SectionLabel>
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-gray-300">Cumulative tokens if every turn is ~this long</span>
                  <select value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))} className="select">
                    {CONTEXT_WINDOWS.map((w) => (
                      <option key={w} value={w}>{windowLabel(w)} window</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={budget} margin={{ top: 6, right: 12, bottom: 0, left: 6 }}>
                    <CartesianGrid stroke="#1e2433" strokeDasharray="3 3" />
                    <XAxis dataKey="turn" stroke="#6b7280" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={11} tickLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} domain={[0, Math.max(windowSize * 1.05, tokensPerTurn * 12)]} />
                    <Tooltip contentStyle={{ background: "#0f1420", border: "1px solid #2a3142", borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${fmt(Number(value))} tok`, "cumulative"]} />
                    <ReferenceLine y={windowSize} stroke="#ef4444" strokeDasharray="5 4" label={{ value: `${windowLabel(windowSize)} window`, fill: "#ef4444", fontSize: 11, position: "insideTopRight" }} />
                    <Line type="monotone" dataKey="tokens" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 2.5, fill: "#818cf8" }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-300">
                  Multi-turn degradation risk <Estimated />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: risk.color }}>{risk.level}</span>
                  <span className="text-xs text-gray-500">at {windowLabel(windowSize)} window</span>
                </div>
                {/* glass-box score breakdown */}
                <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px]">
                  <ScoreRow
                    label="Budget pressure"
                    score={risk.budgetScore}
                    hint={`crosses 75% of the ${windowLabel(windowSize)} window at turn ${risk.turnsTo75}`}
                  />
                  <ScoreRow
                    label={`Fertility ${ratio.toFixed(1)}×`}
                    score={risk.fertilityScore}
                    hint={
                      risk.budgetScore === 0 && risk.fertilityRaw > 0
                        ? `would add +${risk.fertilityRaw}, but only counts under budget pressure`
                        : "amplifier — counts only under budget pressure"
                    }
                  />
                  <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-gray-300">
                    <span>Total</span>
                    <span className="font-mono">
                      score {risk.score}/4 → <b style={{ color: risk.color }}>{risk.level}</b>
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {CONTEXT_WINDOWS.map((w) => {
                    const r = multiTurnRisk(tokensPerTurn, w, costMultiplier(dPer.fertility, ENGLISH_BASELINE[display]));
                    return (
                      <div key={w} className="rounded-lg border border-white/10 bg-black/20 p-1.5 text-center">
                        <div className="text-[10px] text-gray-500">{windowLabel(w)}</div>
                        <div className="text-xs font-semibold" style={{ color: r.color }}>{r.level}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <Caveat>
                    Heuristic from token-budget math, <b>not</b> a measured accuracy drop. Budget pressure is the primary
                    driver; fertility only amplifies it <b>once the budget is under pressure</b>, so a roomy 128K window stays
                    Low. Per the research the true magnitude is unestablished and mainly bites near the window limit.
                  </Caveat>
                </div>
              </Card>
            </div>
          </section>

          {/* In-context capacity */}
          <section>
            <SectionLabel>In-context examples that fit (one example ≈ this text) <Deterministic /></SectionLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CONTEXT_WINDOWS.map((w) => (
                <Card key={w} className="p-4 text-center">
                  <div className="text-xs text-gray-500">{windowLabel(w)} window</div>
                  <div className="mt-1 text-2xl font-bold text-white tabular-nums">{fmt(inContextCapacity(tokensPerTurn, w))}</div>
                  <div className="text-[11px] text-gray-500">examples</div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}

      <style>{`.select{background:#0f1420;border:1px solid rgba(255,255,255,.12);border-radius:.6rem;color:#e5e7eb;font-size:.8rem;padding:.4rem .6rem;outline:none}.select:focus{border-color:rgba(129,140,248,.5)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function ScoreRow({ label, score, hint }: { label: string; score: number; hint: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-gray-300">
          {"●".repeat(score)}
          {"○".repeat(2 - score)} +{score}
        </span>
      </div>
      <div className="text-[10px] text-gray-500">{hint}</div>
    </div>
  );
}
