// Precompute tokenizer fertility for the bundled FLORES-200 corpus across every
// tokenizer x language. Output powers the Leaderboard + Cost Calculator instantly
// (no tokenizer needs to load at page time). Run: node scripts/precompute.mjs
import { getEncoding } from "js-tiktoken";
import llama3 from "llama3-tokenizer-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(readFileSync(join(ROOT, "data", "flores200-seed-parallel.json"), "utf8"));

const o200k = getEncoding("o200k_base");
const cl100k = getEncoding("cl100k_base");
const TOKENIZERS = [
  { id: "o200k", label: "GPT-4o", family: "OpenAI", enc: (s) => o200k.encode(s).length },
  { id: "cl100k", label: "GPT-4 / 3.5", family: "OpenAI", enc: (s) => cl100k.encode(s).length },
  { id: "llama3", label: "Llama-3.1 / SEA-LION v3", family: "Meta / AI Singapore", enc: (s) => llama3.encode(s, { bos: false, eos: false }).length },
];

function wordCount(s, loc) {
  try {
    const seg = new Intl.Segmenter(loc, { granularity: "word" });
    let n = 0;
    for (const x of seg.segment(s)) if (x.isWordLike) n++;
    return n;
  } catch {
    return s.split(/\s+/).filter(Boolean).length;
  }
}

const N = seed.sentences.length;
const langs = seed.languages;

const englishBaseline = {};
for (const t of TOKENIZERS) {
  let tok = 0, wrd = 0;
  for (let i = 0; i < N; i++) { const s = seed.sentences[i].eng_Latn; tok += t.enc(s); wrd += wordCount(s, "en"); }
  englishBaseline[t.id] = +(tok / wrd).toFixed(3);
}

const rows = langs.map((L) => {
  const byTokenizer = {};
  for (const t of TOKENIZERS) {
    let tok = 0, wrd = 0, chars = 0;
    for (let i = 0; i < N; i++) {
      const s = seed.sentences[i][L.code];
      tok += t.enc(s); wrd += wordCount(s, L.bcp47); chars += [...s].length;
    }
    const fertility = tok / wrd;
    byTokenizer[t.id] = {
      fertility: +fertility.toFixed(3),
      tokensPerSentence: +(tok / N).toFixed(1),
      charsPerToken: +(chars / tok).toFixed(2),
      ratioVsEng: +(fertility / englishBaseline[t.id]).toFixed(2),
    };
  }
  return { code: L.code, name: L.name, bcp47: L.bcp47, byTokenizer };
});

const out = {
  _meta: {
    corpus: `FLORES-200 dev split, ${N} parallel sentences`,
    license: "CC-BY-SA 4.0 (FLORES-200 / NLLB, Meta AI)",
    note: "Fertility = tokens / words. Words via Intl.Segmenter (granularity:word, isWordLike) so spaceless scripts count correctly. ratioVsEng = fertility / English fertility for the same tokenizer = relative cost multiplier for equivalent content.",
    sentence_count: N,
  },
  tokenizers: TOKENIZERS.map(({ id, label, family }) => ({ id, label, family })),
  englishBaseline,
  languages: langs,
  rows,
};

writeFileSync(join(ROOT, "data", "leaderboard.json"), JSON.stringify(out, null, 2));
console.log(`wrote data/leaderboard.json — ${rows.length} languages x ${TOKENIZERS.length} tokenizers`);
console.log("English baseline:", englishBaseline);
const ta = rows.find((r) => r.code === "tam_Taml");
console.log("Tamil:", JSON.stringify(ta.byTokenizer));
