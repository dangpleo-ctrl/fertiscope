#!/usr/bin/env python3
"""
benchmark_runner.py — Benchmark 2: multilingual needle-in-haystack degradation.

For each (model, language, context-fill target, needle position) it builds a haystack
of FLORES-200 sentences in that language, sized to a token target using the leaderboard's
measured tokens/sentence, inserts ONE language-neutral needle line «SECRET-KEY = CODE» at
the requested depth, asks the model to recall the CODE, and records the recall rate over
N trials. Output is the exact CSV schema that make_figures.py Figure 4 reads.

It is a NEUTRAL test: nothing here biases toward a positive result. A weak or null effect
is a legitimate, publishable outcome (your research plan says so). Do not tune it to "win".

Key resolution (never printed): env OPENROUTER_API_KEY, else a local gitignored research/.env.

Examples:
    .venv/bin/python benchmark_runner.py --dry-run        # plan + sample prompt, no API calls
    .venv/bin/python benchmark_runner.py --yes            # run the default pilot (~360 calls)
    .venv/bin/python benchmark_runner.py \
        --models openai/gpt-4o-mini,openai/gpt-3.5-turbo,meta-llama/llama-3.1-8b-instruct \
        --languages English,Hindi,Tamil,Malayalam --trials 5 --yes
Then: .venv/bin/python make_figures.py --real
"""
import argparse, csv, json, os, random, re, sys, threading, time
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent  # research/ lives inside the repo; data is at fertiscope/data/
LEADERBOARD = REPO / "data" / "leaderboard.json"
FLORES = REPO / "data" / "flores200-seed-parallel.json"
OUT_CSV = HERE / "data" / "benchmark_results.csv"
LOG_JSONL = HERE / "data" / "benchmark_log.jsonl"
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

# OpenRouter model id -> tokenizer family used in the leaderboard.
MODEL_TOKENIZER = {
    "openai/gpt-4o": "o200k", "openai/gpt-4o-mini": "o200k",
    "openai/gpt-4-turbo": "cl100k", "openai/gpt-3.5-turbo": "cl100k",
    "meta-llama/llama-3.1-8b-instruct": "llama3",
    "meta-llama/llama-3.1-70b-instruct": "llama3",
}
CSV_HEADER = ["model", "language", "tokenizer", "context_target_pct",
              "context_window", "needle_position_pct", "trials", "recall_rate"]


def resolve_key():
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        return k.strip()
    envf = HERE / ".env"  # optional, gitignored — never commit your key
    try:
        for line in envf.read_text().splitlines():
            if line.strip().startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None


def tok_for(model):
    return MODEL_TOKENIZER.get(model, "cl100k")


def make_code(seed):
    r = random.Random(seed)
    L, D = "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789"
    return (r.choice(L)+r.choice(D)+r.choice(L) + "-" +
            r.choice(D)+r.choice(D)+r.choice(L)+r.choice(D))


def norm(s):
    return re.sub(r"[^A-Za-z0-9]", "", s or "").upper()


def build_prompt(sentences, code_field, n_sent, pos_pct, code):
    texts = [s[code_field] for s in sentences if s.get(code_field)]
    if not texts:
        return None
    hay = [texts[i % len(texts)] for i in range(max(1, n_sent))]
    idx = max(0, min(len(hay), round(pos_pct / 100 * len(hay))))
    needle = f"«SECRET-KEY = {code}»"
    hay = hay[:idx] + [needle] + hay[idx:]
    passage = "\n".join(hay)
    system = "You read a passage and answer the final question exactly, with no extra words."
    user = ("Read the following passage carefully.\n\n----- PASSAGE START -----\n"
            + passage +
            "\n----- PASSAGE END -----\n\nSomewhere in the passage there is exactly one line "
            "of the form «SECRET-KEY = VALUE». What is the exact VALUE? "
            "Reply with ONLY the value, nothing else.")
    return system, user


def call_api(model, system, user, key, timeout=90, retries=4):
    body = json.dumps({
        "model": model, "temperature": 0, "max_tokens": 40,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
        "usage": {"include": True},
    }).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "HTTP-Referer": "https://fertiscope.vercel.app", "X-Title": "FertiScope Benchmark"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.loads(r.read())
            msg = (d.get("choices") or [{}])[0].get("message", {}).get("content", "")
            u = d.get("usage", {}) or {}
            return {"content": msg, "cost": u.get("cost"), "prompt_tokens": u.get("prompt_tokens"), "error": None}
        except urllib.error.HTTPError as e:
            detail = e.read()[:200].decode("utf-8", "ignore")
            if e.code in (429, 500, 502, 503, 520, 524) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1)); continue
            return {"content": "", "cost": None, "prompt_tokens": None, "error": f"HTTP {e.code}: {detail}"}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1)); continue
            return {"content": "", "cost": None, "prompt_tokens": None, "error": str(e)[:200]}


def main():
    ap = argparse.ArgumentParser(description="Multilingual needle-in-haystack benchmark (Benchmark 2).")
    ap.add_argument("--models", default="openai/gpt-3.5-turbo,meta-llama/llama-3.1-8b-instruct")
    ap.add_argument("--languages", default="English,Hindi,Tamil,Malayalam",
                    help="display names or FLORES codes")
    ap.add_argument("--targets", default="50,100,150", help="context-fill %% of --base-window")
    ap.add_argument("--positions", default="5,25,50,75,95", help="needle depth %%")
    ap.add_argument("--trials", type=int, default=3)
    ap.add_argument("--base-window", type=int, default=4096)
    ap.add_argument("--max-workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=0, help="hard cap on API calls (0 = no cap)")
    ap.add_argument("--out", default=str(OUT_CSV))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--yes", action="store_true", help="skip the cost confirmation prompt")
    args = ap.parse_args()

    lb = json.loads(LEADERBOARD.read_text())
    flores = json.loads(FLORES.read_text())
    sentences = flores["sentences"]
    name_to_code = {r["name"]: r["code"] for r in lb["rows"]}
    code_set = {r["code"] for r in lb["rows"]}
    tps = {r["code"]: r["byTokenizer"] for r in lb["rows"]}        # tokensPerSentence source
    avail = {k for k in sentences[0].keys() if k in code_set}

    # resolve requested languages -> (display name, flores code)
    langs = []
    for L in [x.strip() for x in args.languages.split(",") if x.strip()]:
        code = name_to_code.get(L, L if L in code_set else None)
        if not code:
            print(f"  ! unknown language '{L}', skipping"); continue
        if code not in avail:
            print(f"  ! '{L}' not in FLORES seed file, skipping"); continue
        name = next((r["name"] for r in lb["rows"] if r["code"] == code), L)
        langs.append((name, code))

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    targets = [int(x) for x in args.targets.split(",")]
    positions = [int(x) for x in args.positions.split(",")]

    # build the cell list
    cells = []
    for model in models:
        tk = tok_for(model)
        for name, code in langs:
            per_sent = tps[code][tk]["tokensPerSentence"] or 1
            for tgt in targets:
                target_tokens = args.base_window * tgt / 100
                n_sent = max(1, round(target_tokens / per_sent))
                for pos in positions:
                    cells.append(dict(model=model, tk=tk, name=name, code=code,
                                      tgt=tgt, pos=pos, n_sent=n_sent,
                                      target_tokens=int(target_tokens)))
    total_calls = len(cells) * args.trials
    est_tokens = sum(c["target_tokens"] for c in cells) * args.trials

    print(f"Plan: {len(models)} models × {len(langs)} langs × {len(targets)} targets × "
          f"{len(positions)} positions = {len(cells)} cells × {args.trials} trials "
          f"= {total_calls} API calls")
    print(f"      base window {args.base_window} tok; ~{est_tokens:,} input tokens total (approx)")
    print(f"      languages: {', '.join(n for n, _ in langs)}")
    print(f"      models: {', '.join(models)}")

    if args.dry_run:
        c = cells[len(cells) // 2]
        sample = build_prompt(sentences, c["code"], c["n_sent"], c["pos"], make_code("sample"))
        prev = HERE / "data" / "sample_prompt.txt"
        prev.parent.mkdir(exist_ok=True)
        prev.write_text(f"# sample cell: {c['name']} {c['model']} target={c['tgt']}% "
                        f"pos={c['pos']}% n_sent={c['n_sent']}\n\n[SYSTEM]\n{sample[0]}\n\n[USER]\n{sample[1]}")
        print(f"\nDRY RUN — no API calls. Sample prompt written to {prev}")
        print(f"  sample cell: {c['name']} on {c['model']}, fill {c['tgt']}%, needle at {c['pos']}%, "
              f"{c['n_sent']} sentences (~{c['target_tokens']} tok)")
        return

    if args.limit and total_calls > args.limit:
        sys.exit(f"Refusing: {total_calls} calls exceeds --limit {args.limit}.")

    key = resolve_key()
    if not key:
        sys.exit("No OpenRouter key found. Set OPENROUTER_API_KEY, or put it in research/.env (gitignored).")
    if not args.yes:
        ans = input(f"\nRun {total_calls} paid API calls? [y/N] ").strip().lower()
        if ans != "y":
            sys.exit("Aborted.")

    LOG_JSONL.parent.mkdir(exist_ok=True)
    log_lock = threading.Lock()
    open(LOG_JSONL, "w").close()  # truncate log

    def run_trial(c, trial):
        seed = f"{c['model']}|{c['code']}|{c['tgt']}|{c['pos']}|{trial}"
        code = make_code(seed)
        sys_u = build_prompt(sentences, c["code"], c["n_sent"], c["pos"], code)
        res = call_api(c["model"], sys_u[0], sys_u[1], key)
        ok = bool(res["error"] is None and norm(code) in norm(res["content"]))
        rec = dict(cell=f"{c['model']}|{c['name']}|{c['tgt']}|{c['pos']}", trial=trial,
                   model=c["model"], language=c["name"], target=c["tgt"], position=c["pos"],
                   code=code, response=(res["content"] or "")[:120], hit=ok,
                   error=res["error"], cost=res["cost"], prompt_tokens=res["prompt_tokens"])
        with log_lock:
            with open(LOG_JSONL, "a") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec

    tasks = [(c, t) for c in cells for t in range(args.trials)]
    results, done, t0 = [], 0, time.time()
    with ThreadPoolExecutor(max_workers=args.max_workers) as ex:
        futs = {ex.submit(run_trial, c, t): (c, t) for c, t in tasks}
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 10 == 0 or done == len(tasks):
                hits = sum(1 for r in results if r["hit"])
                errs = sum(1 for r in results if r["error"])
                print(f"  {done}/{len(tasks)} calls | hits {hits} | errors {errs} | "
                      f"{time.time()-t0:.0f}s", flush=True)

    # aggregate per cell -> recall_rate
    agg = {}
    for r in results:
        agg.setdefault(r["cell"], []).append(r)
    rows = []
    for c in cells:
        key_c = f"{c['model']}|{c['name']}|{c['tgt']}|{c['pos']}"
        trials = agg.get(key_c, [])
        valid = [t for t in trials if t["error"] is None]
        recall = (sum(1 for t in valid if t["hit"]) / len(valid)) if valid else ""
        rows.append([c["model"], c["name"], c["tk"], c["tgt"], args.base_window,
                     c["pos"], len(valid), round(recall, 3) if recall != "" else ""])

    out = Path(args.out)
    with open(out, "w", newline="") as f:
        f.write("# MEASURED multilingual needle-in-haystack recall (Benchmark 2). "
                "Generated by benchmark_runner.py.\n")
        w = csv.writer(f); w.writerow(CSV_HEADER); w.writerows(rows)

    total_cost = sum((r["cost"] or 0) for r in results)
    n_err = sum(1 for r in results if r["error"])
    print(f"\nDone. Wrote {out}")
    print(f"  {len(results)} calls, {n_err} errors, reported cost ${total_cost:.4f}")
    print(f"  per-trial log: {LOG_JSONL}")
    if n_err:
        print("  NOTE: some calls errored (see log). Those trials were excluded from recall_rate.")
    print("\nNext:  .venv/bin/python make_figures.py --real")


if __name__ == "__main__":
    main()
