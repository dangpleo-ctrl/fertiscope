# FertiScope 🌏

**The hidden multilingual tax in your tokenizer — measured before you deploy.**

🔗 Live demo: **https://fertiscope.vercel.app**

Built for the **Global South AI Safety Hackathon**. FertiScope shows, for any (especially lower-resource Asian) language, how much more a model's tokenizer fragments it — and what that costs you in dollars, in-context capacity, and multi-turn context budget.

## Why it matters

A model can score 90% on MMLU and still tokenize **Tamil at ~11–12 tokens/word** vs **~1.3 for English** — so encoding the **same content** in Tamil costs **~7× the tokens** (and up to **~11× for Burmese**). That means higher API bills, fewer in-context examples, and faster context-budget burn for exactly the languages already under-served. FertiScope makes that tax visible and actionable.

## What it does

- **Analyzer** — paste text in any language → fertility (tokens/word), cost multiplier vs. English, and a token-fragmentation visualization across three real tokenizer families (**GPT-4o** · **GPT-4 / 3.5** · **Llama-3.1 / SEA-LION v3**), plus a glass-box multi-turn risk score.
- **Leaderboard** — 16 languages ranked by fertility on identical **FLORES-200** sentences (apples-to-apples).
- **Cost Calculator** — your monthly workload → the bill, the "multilingual tax" vs. English, and which model is cheapest for a given language.
- **Methodology** — the honest line between what's *exact* and what's an *estimate*.

## Honesty principle

Token economics (fertility, cost multiplier, in-context capacity, context budget) are **deterministic and exact**. The one estimate — **multi-turn degradation risk** — is **clearly labelled everywhere** and shown as a transparent 0–4 score, because the underlying research found its true magnitude is unestablished and regime-dependent. A tool that confidently predicted accuracy loss would be selling a claim the evidence can't support.

## Related work & what's different

FertiScope builds on a well-studied problem. Here's the landscape and our delta.

**Prior art**
- **Tokenization Fairness** — Petrov et al., NeurIPS 2023 ([demo](https://aleksandarpetrov.github.io/tokenization-fairness/), [paper](https://arxiv.org/abs/2305.15425)). The closest precedent: compares tokenization length across languages × 17 tokenizers on **FLORES-200**. Shows token-count disparity only — no dollar cost, no ranked leaderboard, no custom-text analyzer, no multi-turn dimension.
- **Tokenizer playgrounds** — [Tiktokenizer](https://tiktokenizer.vercel.app/) and the [HF Tokenizer Playground](https://huggingface.co/spaces/Xenova/the-tokenizer-playground): token counting + visualization, English-first, single-prompt.
- **"Token tax" benchmarks & calculators** — [`llm-language-token-tax`](https://github.com/vfalbor/llm-language-token-tax) (benchmark), [The Token Tax (arXiv 2509.05486)](https://arxiv.org/abs/2509.05486), [TokenCost](https://pypi.org/project/tokencost/), and Omar Kamali's essay [*Tokenization is Killing our Multilingual LLM Dream*](https://huggingface.co/blog/omarkamali/tokenization). They quantify the same problem as scripts, papers, or generic $-calculators — not an interactive multilingual product.

**What's different about FertiScope**
1. **One decision-oriented product**, not a viz — fertility **+** dollar cost **+** in-context capacity **+** model-swap savings, deployed and shareable.
2. **Multi-turn context-budget risk** — to our knowledge the first *tool* to surface conversation-degradation risk by language/tokenizer (prior work on multi-turn decay is research-only).
3. **Global-South / SEA-language focus** — Tamil, Burmese, Khmer, Lao, and peers: the languages most penalized.
4. **Intellectual honesty** — an explicit exact-vs-estimate split, rare among tooling.

*Metric note:* FertiScope reports fertility (tokens/word); a 2025 critique, [*Beyond Fertility* (arXiv 2510.09947)](https://arxiv.org/abs/2510.09947), argues fertility alone is incomplete — **STRR** support is on the roadmap.

## Tech

Next.js 16 · React 19 · Tailwind v4 · Recharts. Pure-JS tokenizers (`js-tiktoken`, `llama3-tokenizer-js`) — no native deps, runs on any serverless host. Word counts via `Intl.Segmenter` (handles spaceless scripts like Thai/Khmer/Burmese/Lao). Leaderboard precomputed on 50 FLORES-200 sentences (`npm run … scripts/precompute.mjs`).

## Run & deploy

```bash
npm install
npm run dev      # http://localhost:3000
```
Full deployment options (Vercel, tunnels, etc.) in **[DEPLOY.md](./DEPLOY.md)**.

## Data & attribution

Bundled corpus: **FLORES-200** (No Language Left Behind, Meta AI) — **CC-BY-SA 4.0**. Grounded in the deep-research report *"Tokenizer Fertility and Multi-Turn Degradation"* (2026).

## License

- **Code** (this repository): **MIT** — see [LICENSE](./LICENSE). © 2026 Leo Dang.
- **Bundled data**: the FLORES-200 corpus (`data/flores200-seed-parallel.json`) and the leaderboard derived from it (`data/leaderboard.json`) are **CC-BY-SA 4.0** (NLLB / Meta AI), *not* MIT — attribute the source and share derivatives alike.
- **Dependencies** keep their own licenses (`js-tiktoken`, `llama3-tokenizer-js`, Next.js, etc., mostly MIT / Apache-2.0).
