# FertiScope — research & reproducibility

Scripts that produce the figures and the multilingual benchmark behind the FertiScope paper
(*Tokenizer Fertility and Multi-Turn Degradation for Low-Resource Asian Languages*).

Everything here is reproducible from the bundled FLORES-200 leaderboard
(`../data/leaderboard.json`) and a small, neutral benchmark you can re-run yourself.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The benchmark also needs an OpenRouter key — set it in your shell (never commit it):

```bash
export OPENROUTER_API_KEY=sk-or-...   # or put it in research/.env (gitignored)
```

## Figures (deterministic — no API needed)

```bash
.venv/bin/python make_figures.py            # Fig 4 = template until you run the benchmark
.venv/bin/python make_figures.py --real      # Fig 4 from measured benchmark data
```
Outputs PNG (300 dpi) + vector PDF to `figures/`. Figures 1–3 are exact token economics over
the leaderboard; Figure 4 is the multi-turn benchmark below.

## Benchmark 2 — multilingual needle-in-haystack (real Figure 4)

Measures how reliably a model recalls a planted `«SECRET-KEY = CODE»` line as the context
fills, by language. It is a **neutral** test — a weak or null result is a legitimate finding.

```bash
.venv/bin/python benchmark_runner.py --dry-run    # 1. see the plan, $0
.venv/bin/python benchmark_runner.py --yes        # 2. run it (cost printed up front)
.venv/bin/python make_figures.py --real           # 3. render measured Figure 4
```

Defaults: `gpt-4o-mini` + `gpt-3.5-turbo` + `llama-3.1-8b` × English/Hindi/Tamil/Malayalam ×
context-fill 50/100/150% × needle at 5/25/50/75/95% × 3 trials. Useful flags:

| flag | meaning |
|---|---|
| `--models` | comma list of OpenRouter ids |
| `--languages` | names or FLORES codes, e.g. `English,Vietnamese,Tamil,Telugu,Malayalam` |
| `--base-window` | nominal window in tokens; for overflow tests set to the model's real window |
| `--trials` / `--targets` / `--positions` | grid size |
| `--limit N` | hard cap on API calls |

Outputs `data/benchmark_results.csv` (committed — the data behind Figure 4) and a per-call log
`data/benchmark_log.jsonl` (gitignored; your raw evidence — every prompt's code, reply, cost).

## Honesty

The paper draws a hard line between **exact** token economics (Figures 1–3) and **measured**
recall (Figure 4). Do not tune the benchmark to manufacture a gap; report what you measure.
Never commit your API key — `benchmark_runner.py` only reads it from the environment / a
gitignored `.env`.
