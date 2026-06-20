"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import data from "@/data/leaderboard.json";
import { tierFor, type TokenizerId } from "@/lib/constants";
import { Card, SectionLabel } from "@/components/ui";

const TOK = data.tokenizers as { id: TokenizerId; label: string; family: string }[];
type SortKey = "fertility" | "ratioVsEng" | "charsPerToken";

export default function LeaderboardPage() {
  const [tok, setTok] = useState<TokenizerId>("llama3");
  const [sortKey, setSortKey] = useState<SortKey>("fertility");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    return [...data.rows].sort((a, b) => {
      const d = a.byTokenizer[tok][sortKey] - b.byTokenizer[tok][sortKey];
      return asc ? d : -d;
    });
  }, [tok, sortKey, asc]);

  const chartData = useMemo(
    () =>
      [...data.rows]
        .sort((a, b) => b.byTokenizer[tok].fertility - a.byTokenizer[tok].fertility)
        .map((r) => ({ name: r.name, fertility: r.byTokenizer[tok].fertility, color: tierFor(r.byTokenizer[tok].fertility).color })),
    [tok]
  );

  // headline insight: worst language under the current tokenizer, vs GPT-4o
  const worst = chartData[0];
  const worstRow = data.rows.find((r) => r.name === worst.name)!;

  function clickSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-white">Fertility Leaderboard</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-gray-400">
        Tokens per word for 16 languages on identical FLORES-200 sentences — apples-to-apples. Higher = more expensive,
        fewer in-context examples, faster context-budget burn.
      </p>

      {/* tokenizer segmented control */}
      <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {TOK.map((t) => (
          <button
            key={t.id}
            onClick={() => setTok(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${tok === t.id ? "bg-indigo-500 text-white shadow" : "text-gray-400 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* insight */}
      <Card className="mt-4 p-4">
        <p className="text-sm text-gray-300">
          On <b className="text-white">{TOK.find((t) => t.id === tok)?.label}</b>, the heaviest language is{" "}
          <b className="text-white">{worst.name}</b> at{" "}
          <b style={{ color: tierFor(worst.fertility).color }}>{worst.fertility.toFixed(2)} tok/word</b> —{" "}
          <b style={{ color: tierFor(worst.fertility).color }}>{worstRow.byTokenizer[tok].ratioVsEng.toFixed(1)}×</b> English. The same
          text on <b className="text-white">GPT-4o</b> is just{" "}
          <b className="text-emerald-400">{worstRow.byTokenizer.o200k.fertility.toFixed(2)}</b> tok/word — a{" "}
          <b className="text-emerald-400">{(worstRow.byTokenizer[tok].fertility / worstRow.byTokenizer.o200k.fertility).toFixed(1)}× saving</b> just from the tokenizer.
        </p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* chart */}
        <Card className="p-4 lg:col-span-3">
          <SectionLabel>Fertility (tok / word)</SectionLabel>
          <ResponsiveContainer width="100%" height={470}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e2433" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} width={78} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#0f1420", border: "1px solid #2a3142", borderRadius: 12, fontSize: 12 }}
                formatter={(value) => [`${Number(value).toFixed(2)} tok/word`, "fertility"]}
              />
              <Bar dataKey="fertility" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* table */}
        <Card className="overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Language</th>
                <Th onClick={() => clickSort("fertility")} active={sortKey === "fertility"} asc={asc}>Fert.</Th>
                <Th onClick={() => clickSort("ratioVsEng")} active={sortKey === "ratioVsEng"} asc={asc}>×Eng</Th>
                <Th onClick={() => clickSort("charsPerToken")} active={sortKey === "charsPerToken"} asc={asc}>c/tok</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = r.byTokenizer[tok];
                const t = tierFor(b.fertility);
                return (
                  <tr key={r.code} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-gray-200">{r.name}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={{ color: t.color }}>{b.fertility.toFixed(2)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-gray-300">{b.ratioVsEng.toFixed(1)}×</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{b.charsPerToken.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Corpus: {data._meta.corpus}. {data._meta.license}. Words counted via Intl.Segmenter so spaceless scripts (Thai, Khmer,
        Burmese, Lao) are handled correctly. <b className="text-gray-400">c/tok</b> = characters per token (lower = more fragmented).
      </p>
    </div>
  );
}

function Th({ children, onClick, active, asc }: { children: React.ReactNode; onClick: () => void; active: boolean; asc: boolean }) {
  return (
    <th className="cursor-pointer select-none px-2 py-3 text-right hover:text-gray-300" onClick={onClick}>
      {children}
      <span className="ml-0.5 text-gray-600">{active ? (asc ? "▲" : "▼") : ""}</span>
    </th>
  );
}
