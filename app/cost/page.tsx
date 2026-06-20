"use client";

import { useState } from "react";
import data from "@/data/leaderboard.json";
import { MODELS, type TokenizerId } from "@/lib/constants";
import { fmt, fmtUSD } from "@/lib/calc";
import { Card, SectionLabel, Deterministic } from "@/components/ui";

function fertility(code: string, tok: TokenizerId): number {
  const r = data.rows.find((x) => x.code === code);
  return r ? r.byTokenizer[tok].fertility : data.englishBaseline[tok];
}

export default function CostPage() {
  const [code, setCode] = useState("tam_Taml");
  const [volume, setVolume] = useState(100_000);
  const [inWords, setInWords] = useState(400);
  const [outWords, setOutWords] = useState(250);
  const [modelId, setModelId] = useState("gpt-4-turbo");
  const model = MODELS.find((m) => m.id === modelId)!;
  const [inPerM, setInPerM] = useState(model.inPerM);
  const [outPerM, setOutPerM] = useState(model.outPerM);

  function pickModel(id: string) {
    const m = MODELS.find((x) => x.id === id)!;
    setModelId(id);
    setInPerM(m.inPerM);
    setOutPerM(m.outPerM);
  }

  function monthly(tok: TokenizerId, inP: number, outP: number, useEnglish = false) {
    const f = useEnglish ? data.englishBaseline[tok] : fertility(code, tok);
    const inTok = inWords * f;
    const outTok = outWords * f;
    return ((inTok * inP + outTok * outP) / 1e6) * volume;
  }

  const cost = monthly(model.tokenizer, inPerM, outPerM);
  const costEng = monthly(model.tokenizer, inPerM, outPerM, true);
  const tax = cost - costEng;
  const mult = costEng > 0 ? cost / costEng : 1;
  const langName = data.rows.find((r) => r.code === code)?.name ?? "—";

  const comparison = MODELS.map((m) => ({ ...m, cost: monthly(m.tokenizer, m.inPerM, m.outPerM) })).sort((a, b) => a.cost - b.cost);
  const cheapest = comparison[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-white">Cost Calculator</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-gray-400">
        The same content costs more in high-fertility languages because it tokenizes into more tokens. See the real monthly
        bill — and the &ldquo;multilingual tax&rdquo; you pay vs. English. <Deterministic />
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* inputs */}
        <Card className="space-y-4 p-5 lg:col-span-2">
          <SectionLabel>Workload</SectionLabel>
          <Num label="Language" >
            <select value={code} onChange={(e) => setCode(e.target.value)} className="cinput">
              {data.rows.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </Num>
          <Num label="Requests / month">
            <input type="number" value={volume} min={0} onChange={(e) => setVolume(+e.target.value)} className="cinput" />
          </Num>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Input words / req">
              <input type="number" value={inWords} min={0} onChange={(e) => setInWords(+e.target.value)} className="cinput" />
            </Num>
            <Num label="Output words / req">
              <input type="number" value={outWords} min={0} onChange={(e) => setOutWords(+e.target.value)} className="cinput" />
            </Num>
          </div>
          <Num label="Model">
            <select value={modelId} onChange={(e) => pickModel(e.target.value)} className="cinput">
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Num>
          <div className="grid grid-cols-2 gap-3">
            <Num label="$ / 1M input">
              <input type="number" step="0.01" value={inPerM} min={0} onChange={(e) => setInPerM(+e.target.value)} className="cinput" />
            </Num>
            <Num label="$ / 1M output">
              <input type="number" step="0.01" value={outPerM} min={0} onChange={(e) => setOutPerM(+e.target.value)} className="cinput" />
            </Num>
          </div>
          <p className="text-[11px] text-gray-500">Prices are approximate (2026) and editable.</p>
        </Card>

        {/* outputs */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="p-5">
            <div className="text-sm text-gray-400">Estimated monthly cost — {langName} on {model.label}</div>
            <div className="mt-1 text-4xl font-bold text-white tabular-nums">{fmtUSD(cost)}</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <Mini label="English-equivalent" value={fmtUSD(costEng)} />
              <Mini label="Multilingual tax" value={fmtUSD(tax)} color="#f97316" />
              <Mini label="vs English" value={`${mult.toFixed(1)}×`} color="#f97316" />
            </div>
          </Card>

          <Card className="p-5">
            <SectionLabel>Same workload, every model — {langName}</SectionLabel>
            <div className="space-y-2">
              {comparison.map((m) => {
                const max = comparison[comparison.length - 1].cost || 1;
                const isCheapest = m.id === cheapest.id;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-sm text-gray-300">{m.label}</div>
                    <div className="h-6 flex-1 overflow-hidden rounded-md bg-white/5">
                      <div
                        className="flex h-full items-center rounded-md pl-2 text-[11px] font-medium text-white/90"
                        style={{ width: `${Math.max(6, (m.cost / max) * 100)}%`, background: isCheapest ? "#10b981" : "#6366f1" }}
                      >
                        {fmtUSD(m.cost)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Cheapest for {langName}: <b className="text-emerald-400">{cheapest.label}</b> at {fmtUSD(cheapest.cost)}/mo — largely
              because its tokenizer fragments {langName} less.
            </p>
          </Card>
        </div>
      </div>

      <style>{`.cinput{width:100%;background:#0f1420;border:1px solid rgba(255,255,255,.12);border-radius:.6rem;color:#e5e7eb;font-size:.85rem;padding:.5rem .6rem;outline:none}.cinput:focus{border-color:rgba(129,140,248,.5)}`}</style>
    </div>
  );
}

function Num({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums" style={color ? { color } : { color: "#e5e7eb" }}>{value}</div>
    </div>
  );
}
