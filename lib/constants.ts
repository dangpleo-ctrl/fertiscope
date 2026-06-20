// Shared configuration for FertiScope.

export type TokenizerId = "o200k" | "cl100k" | "llama3";

export const TOKENIZERS: { id: TokenizerId; label: string; family: string; note: string }[] = [
  { id: "o200k", label: "GPT-4o", family: "OpenAI", note: "o200k_base — 200k vocab. Far more efficient on non-Latin scripts than the older GPT tokenizer." },
  { id: "cl100k", label: "GPT-4 / GPT-3.5", family: "OpenAI", note: "cl100k_base — 100k vocab. The legacy GPT tokenizer; falls back to bytes on most Asian scripts." },
  { id: "llama3", label: "Llama-3.1 / SEA-LION v3", family: "Meta / AI Singapore", note: "128k tiktoken-based BPE, shared by Llama-3.1 and the continue-trained SEA-LION v3 — the reference model in the research." },
];

// Measured English baselines (tokens/word) on the bundled FLORES corpus.
export const ENGLISH_BASELINE: Record<TokenizerId, number> = { o200k: 1.264, cl100k: 1.266, llama3: 1.266 };

// Cost-calculator models -> tokenizer + representative price ($ per 1M tokens). Approximate & editable.
export type Model = { id: string; label: string; tokenizer: TokenizerId; inPerM: number; outPerM: number };
export const MODELS: Model[] = [
  { id: "gpt-4o", label: "GPT-4o", tokenizer: "o200k", inPerM: 2.5, outPerM: 10 },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", tokenizer: "cl100k", inPerM: 10, outPerM: 30 },
  { id: "gpt-3.5", label: "GPT-3.5 Turbo", tokenizer: "cl100k", inPerM: 0.5, outPerM: 1.5 },
  { id: "llama-3.1-8b", label: "Llama-3.1-8B (hosted)", tokenizer: "llama3", inPerM: 0.2, outPerM: 0.2 },
];

export const CONTEXT_WINDOWS = [4096, 8192, 32768, 131072];

export type Tier = { key: string; label: string; max: number; color: string; blurb: string };
// Fertility tiers in tokens/word.
export const TIERS: Tier[] = [
  { key: "excellent", label: "Excellent", max: 1.6, color: "#10b981", blurb: "Near-English efficiency" },
  { key: "good", label: "Good", max: 3, color: "#84cc16", blurb: "Mild overhead" },
  { key: "moderate", label: "Moderate", max: 6, color: "#f59e0b", blurb: "Noticeable cost & budget penalty" },
  { key: "high", label: "High", max: 10, color: "#f97316", blurb: "Severe — 6–10× context burn" },
  { key: "severe", label: "Severe", max: Infinity, color: "#ef4444", blurb: "Extreme byte-level fragmentation" },
];
export function tierFor(fertility: number): Tier {
  return TIERS.find((t) => fertility < t.max) ?? TIERS[TIERS.length - 1];
}

export const LANGUAGES: { code: string; name: string; bcp47: string }[] = [
  { code: "eng_Latn", name: "English", bcp47: "en" },
  { code: "ind_Latn", name: "Indonesian", bcp47: "id" },
  { code: "zsm_Latn", name: "Malay", bcp47: "ms" },
  { code: "vie_Latn", name: "Vietnamese", bcp47: "vi" },
  { code: "tgl_Latn", name: "Filipino", bcp47: "fil" },
  { code: "tha_Thai", name: "Thai", bcp47: "th" },
  { code: "khm_Khmr", name: "Khmer", bcp47: "km" },
  { code: "lao_Laoo", name: "Lao", bcp47: "lo" },
  { code: "mya_Mymr", name: "Burmese", bcp47: "my" },
  { code: "tam_Taml", name: "Tamil", bcp47: "ta" },
  { code: "tel_Telu", name: "Telugu", bcp47: "te" },
  { code: "ben_Beng", name: "Bengali", bcp47: "bn" },
  { code: "hin_Deva", name: "Hindi", bcp47: "hi" },
  { code: "mal_Mlym", name: "Malayalam", bcp47: "ml" },
  { code: "kan_Knda", name: "Kannada", bcp47: "kn" },
  { code: "sin_Sinh", name: "Sinhala", bcp47: "si" },
];
