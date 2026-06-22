#!/usr/bin/env python3
"""
FertiScope — submission figure generator.

Figures 1-3 are REAL: they are deterministic functions of the bundled
FLORES-200 leaderboard (fertiscope/data/leaderboard.json) and the exact
token-economics math in fertiscope/lib/calc.ts. They can go in the paper as-is.

Figure 4 is a TEMPLATE for the in-progress multi-turn needle/degradation
benchmark. It renders from data/benchmark_results.csv. Until you replace that
file with measured runs, it is stamped "ILLUSTRATIVE — SYNTHETIC PLACEHOLDER".
Pass --real once your CSV holds measured data to drop the watermark.

Usage:
    .venv/bin/python make_figures.py          # all figures (Fig 4 = template)
    .venv/bin/python make_figures.py --real    # Fig 4 from measured CSV, no watermark
Outputs PNG (300 dpi) + PDF (vector, for LaTeX/arXiv) into ./figures/.
"""
import csv
import json
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

# ---- paths -----------------------------------------------------------------
HERE = Path(__file__).resolve().parent
REPO = HERE.parent  # research/ lives inside the repo
LEADERBOARD = REPO / "data" / "leaderboard.json"
OUT = HERE / "figures"
DATA = HERE / "data"
OUT.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)
BENCH_CSV = DATA / "benchmark_results.csv"

REAL = "--real" in sys.argv

# ---- shared assumptions (stated in captions) -------------------------------
WORDS_PER_TURN = 100          # combined user+assistant words per conversation turn
TOK_FOR_BUDGET = "cl100k"     # GPT-4/3.5 tokenizer for the budget/exhaustion figures
WINDOW = 4096                 # primary context window for the exhaustion figure
CAP_WINDOW = 8192             # window for the in-context-capacity figure
RESERVE = 512                 # reply reserve, matches calc.ts inContextCapacity()

# ---- palette ---------------------------------------------------------------
C = {
    "o200k":  "#10b981",   # GPT-4o  (emerald)
    "cl100k": "#ef4444",   # GPT-4/3.5 (red)
    "llama3": "#6366f1",   # Llama-3.1 / SEA-LION (indigo)
}
TOK_LABEL = {
    "o200k":  "GPT-4o (o200k)",
    "cl100k": "GPT-4 / 3.5 (cl100k)",
    "llama3": "Llama-3.1 / SEA-LION (llama3)",
}

INK, MUTED, GRIDC, AXC = "#1f2937", "#6b7280", "#eef1f5", "#d7dce3"
plt.rcParams.update({
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "font.family": "DejaVu Sans", "font.size": 11.5,
    "text.color": INK, "axes.labelcolor": INK, "axes.edgecolor": AXC,
    "xtick.color": MUTED, "ytick.color": MUTED,
    "xtick.labelcolor": INK, "ytick.labelcolor": INK,
    "axes.titlesize": 14, "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.titlepad": 12,
    "axes.labelsize": 11.5, "axes.linewidth": 1.0,
    "axes.spines.top": False, "axes.spines.right": False,
    "legend.fontsize": 10, "legend.frameon": False,
    "grid.color": GRIDC, "grid.linewidth": 1.0,
    "figure.dpi": 120, "savefig.dpi": 300,
    "xtick.major.size": 0, "ytick.major.size": 0,
})


def load():
    with open(LEADERBOARD) as f:
        d = json.load(f)
    rows = {r["code"]: r for r in d["rows"]}
    return d, rows


def fert(rows, code, tok):
    return rows[code]["byTokenizer"][tok]["fertility"]


def ratio(rows, code, tok):
    return rows[code]["byTokenizer"][tok]["ratioVsEng"]


def cost_ratio(rows, code, tok):
    """Same-content cost: tokens to encode the parallel FLORES sentence, ÷ English.
    This is the correct 'identical content' cost multiplier (NOT the per-word fertility ratio)."""
    eng = rows["eng_Latn"]["byTokenizer"][tok]["tokensPerSentence"]
    return rows[code]["byTokenizer"][tok]["tokensPerSentence"] / eng


def save(fig, name):
    for ext in ("png", "pdf"):
        fig.savefig(OUT / f"{name}.{ext}", bbox_inches="tight",
                    dpi=300 if ext == "png" else None)
    plt.close(fig)
    print(f"  wrote figures/{name}.png + .pdf")


# ===========================================================================
# Figure 1 — the multilingual token tax (REAL)
# ===========================================================================
def fig1_token_tax(d, rows):
    order = [r["code"] for r in sorted(
        d["rows"], key=lambda r: r["byTokenizer"]["cl100k"]["tokensPerSentence"])]
    names = [rows[c]["name"] for c in order]
    toks = ["o200k", "cl100k", "llama3"]
    n = len(order)
    h = 0.26
    ys = list(range(n))
    fig, ax = plt.subplots(figsize=(10.5, 11))
    for k in range(n):
        if k % 2 == 0:
            ax.axhspan(k - 0.5, k + 0.5, color="#f6f7f9", zorder=0)
    for i, tok in enumerate(toks):
        offs = (i - 1) * h
        vals = [cost_ratio(rows, c, tok) for c in order]
        bars = ax.barh([y + offs for y in ys], vals, height=h,
                       color=C[tok], label=TOK_LABEL[tok], zorder=3)
        for y, v in zip(ys, vals):
            ax.text(v + 0.15, y + offs, f"{v:.1f}×", va="center",
                    ha="left", fontsize=9, color=C[tok])
    ax.axvline(1.0, color="#374151", lw=1.1, ls="--", zorder=2)
    ax.set_yticks(ys)
    ax.set_yticklabels(names, fontsize=12)
    ax.set_xlabel("Cost vs. English for the same content  (× as many tokens, same tokenizer)", fontsize=12)
    ax.set_xlim(0, 13)
    ax.xaxis.set_major_locator(MultipleLocator(2))
    ax.tick_params(axis="x", labelsize=11)
    ax.grid(axis="x", color="#e5e7eb", zorder=0)
    ax.legend(loc="lower right", frameon=True, framealpha=0.9, fontsize=11.5)
    save(fig, "fig1_token_tax")


# ===========================================================================
# Figure 2 — context-window exhaustion rate (REAL, deterministic)
# ===========================================================================
def fig2_exhaustion(d, rows):
    langs = ["eng_Latn", "vie_Latn", "tha_Thai", "hin_Deva", "tam_Taml", "mal_Mlym"]
    colors = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f97316", "#ef4444"]
    turns = list(range(1, 41))
    fig, ax = plt.subplots(figsize=(9, 5.6))
    ax.axhspan(WINDOW, 11000, color="#fef2f2", zorder=0)  # over-budget zone above the 4096 window
    for code, col in zip(langs, colors):
        tpt = WORDS_PER_TURN * fert(rows, code, TOK_FOR_BUDGET)
        cum = [tpt * t for t in turns]
        ax.plot(turns, cum, color=col, lw=2.4, label=rows[code]["name"], zorder=3,
                solid_capstyle="round")
        # mark the turn where it crosses the window
        cross = WINDOW / tpt
        if cross <= turns[-1]:
            ax.plot(cross, WINDOW, "o", color=col, ms=7, zorder=4,
                    markeredgecolor="white", markeredgewidth=1.3)
    ax.axhline(WINDOW, color="#374151", lw=1.2, ls="--", zorder=2)
    ax.text(turns[-1], WINDOW, f"  4096-token window", va="bottom", ha="right",
            fontsize=9, color="#374151")
    ax.axhline(CAP_WINDOW, color="#9ca3af", lw=1, ls=":", zorder=2)
    ax.text(turns[-1], CAP_WINDOW, f"  8192-token window", va="bottom", ha="right",
            fontsize=8.5, color="#9ca3af")
    ax.set_xlabel("Conversation turn", fontsize=12)
    ax.set_ylabel("Cumulative context consumed (tokens)", fontsize=12)
    ax.set_ylim(0, 11000)
    ax.set_xlim(1, 40)
    ax.tick_params(labelsize=11)
    ax.grid(color="#eef0f2", zorder=0)
    ax.legend(loc="upper left", frameon=True, framealpha=0.9, ncol=2, fontsize=11.5)
    save(fig, "fig2_exhaustion")


# ===========================================================================
# Figure 3 — in-context example capacity (REAL)
# ===========================================================================
def fig3_capacity(d, rows):
    order = [r["code"] for r in sorted(
        d["rows"], key=lambda r: r["byTokenizer"][TOK_FOR_BUDGET]["ratioVsEng"],
        reverse=True)]
    names = [rows[c]["name"] for c in order]

    def cap(code):
        tpe = WORDS_PER_TURN * fert(rows, code, TOK_FOR_BUDGET)
        return max(0, int((CAP_WINDOW - RESERVE) // max(1, tpe)))

    vals = [cap(c) for c in order]
    fig, ax = plt.subplots(figsize=(9, 7.5))
    for k in range(len(order)):
        if k % 2 == 0:
            ax.axhspan(k - 0.5, k + 0.5, color="#f6f7f9", zorder=0)
    ys = list(range(len(order)))
    cols = ["#ef4444" if v < 10 else "#f59e0b" if v < 25 else "#10b981" for v in vals]
    ax.barh(ys, vals, color=cols, zorder=3)
    for y, v in zip(ys, vals):
        ax.text(v + 0.6, y, str(v), va="center", fontsize=10, fontweight="medium")
    ax.set_yticks(ys)
    ax.set_yticklabels(names, fontsize=12)
    ax.invert_yaxis()
    ax.set_xlabel(f"# of {WORDS_PER_TURN}-word in-context examples that fit in an 8192-token window", fontsize=12)
    ax.tick_params(axis="x", labelsize=11)
    ax.grid(axis="x", color="#eef0f2", zorder=0)
    save(fig, "fig3_incontext_capacity")


# ===========================================================================
# Figure 4 — multi-turn needle recall / degradation (TEMPLATE)
# ===========================================================================
SCHEMA_HEADER = ["model", "language", "tokenizer", "context_target_pct",
                 "context_window", "needle_position_pct", "trials", "recall_rate"]


def write_template_csv():
    """Write a documented CSV of SYNTHETIC placeholder data the user replaces."""
    import math
    rng_langs = [("English", 0.0), ("Hindi", 0.35), ("Tamil", 0.7), ("Malayalam", 0.85)]
    targets = [50, 100, 150]
    positions = [5, 25, 50, 75, 95]
    rows = []
    for lang, severity in rng_langs:
        for tgt in targets:
            for pos in positions:
                # SYNTHETIC shape: mild U-curve, worse with severity and larger target.
                mid = abs(pos - 50) / 50.0          # 0 at middle, 1 at edges (U-curve)
                base = 0.97 - 0.45 * severity        # high-fertility langs start lower
                target_pen = 0.12 * (tgt - 50) / 100 # 0/0.06/0.12 across 50/100/150
                u = 0.18 * (1 - mid) * severity      # lost-in-the-middle, amplified by severity
                recall = max(0.02, min(0.99, base - target_pen - u))
                rows.append([
                    "gpt-3.5", lang, "cl100k", tgt, 4096, pos, 50, round(recall, 3)])
    with open(BENCH_CSV, "w", newline="") as f:
        f.write("# SYNTHETIC PLACEHOLDER DATA — replace every recall_rate with a measured value.\n")
        f.write("# Benchmark 2 (needle-in-haystack degradation). One row per "
                "(model, language, tokenizer, context_target_pct, needle_position_pct).\n")
        f.write("# recall_rate in [0,1] = fraction of trials the needle phrase was correctly recalled.\n")
        w = csv.writer(f)
        w.writerow(SCHEMA_HEADER)
        w.writerows(rows)
    print(f"  wrote template data/{BENCH_CSV.name} (SYNTHETIC)")


def read_bench():
    rows = []
    with open(BENCH_CSV) as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            rows.append(line)
    reader = csv.DictReader(rows)
    out = []
    for r in reader:
        rr = (r.get("recall_rate") or "").strip()
        if rr == "":
            continue  # cell had no valid (non-errored) trials
        try:
            recall = float(rr)
        except ValueError:
            continue
        out.append({
            "model": r["model"], "language": r["language"], "tokenizer": r["tokenizer"],
            "target": int(r["context_target_pct"]), "pos": int(r["needle_position_pct"]),
            "recall": recall,
        })
    return out


def _fig4_heatmap(rows, data):
    """Real-data Figure 4: a recall heatmap (honest view of a near-ceiling / null result)."""
    name_fert = {r["name"]: r["byTokenizer"]["cl100k"]["fertility"] for r in rows.values()}
    models = sorted({r["model"] for r in data})
    langs = sorted({r["language"] for r in data}, key=lambda L: name_fert.get(L, 0))
    targets = sorted({r["target"] for r in data})
    agg, cnt = {}, {}
    for r in data:
        k = (r["model"], r["language"], r["target"])
        agg[k] = agg.get(k, 0) + r["recall"]
        cnt[k] = cnt.get(k, 0) + 1

    def mean(m, L, t):
        k = (m, L, t)
        return agg[k] / cnt[k] if k in cnt else float("nan")

    clean = {"openai/gpt-4o-mini": "GPT-4o-mini", "openai/gpt-3.5-turbo": "GPT-3.5-Turbo",
             "meta-llama/llama-3.1-8b-instruct": "Llama-3.1-8B"}
    fig, axes = plt.subplots(1, len(models), figsize=(4.1 * len(models), 3.7),
                             squeeze=False, sharey=True)
    axes = list(axes[0])
    im = None
    for idx, (ax, m) in enumerate(zip(axes, models)):
        M = [[mean(m, L, t) for t in targets] for L in langs]
        im = ax.imshow(M, cmap="RdYlGn", vmin=0.8, vmax=1.0, aspect="auto")
        ax.set_xticks(range(len(targets))); ax.set_xticklabels([f"{t}%" for t in targets], fontsize=11)
        ax.set_yticks(range(len(langs)))
        if idx == 0:
            ax.set_yticklabels(langs, fontsize=12)
        else:
            ax.tick_params(labelleft=False)
        ax.set_title(clean.get(m, m.split("/")[-1]), fontsize=13, fontweight="bold")
        ax.set_xlabel("context fill", fontsize=11.5)
        ax.set_xticks([x - 0.5 for x in range(1, len(targets))], minor=True)
        ax.set_yticks([y - 0.5 for y in range(1, len(langs))], minor=True)
        ax.grid(which="minor", color="white", linewidth=2.5)
        ax.tick_params(which="minor", length=0)
        for i in range(len(langs)):
            for j in range(len(targets)):
                ax.text(j, i, f"{M[i][j]:.2f}", ha="center", va="center", fontsize=11,
                        color="#0f172a", fontweight="bold")
    axes[0].set_ylabel("language  (low → high cost)", fontsize=12)
    fig.colorbar(im, ax=axes, shrink=0.75, label="recall rate")
    save(fig, "fig4_multiturn_degradation")


def fig4_degradation(rows):
    if not BENCH_CSV.exists():
        write_template_csv()
    data = read_bench()
    if not data:
        print("  (no benchmark data; skipping fig4)")
        return
    if REAL:
        _fig4_heatmap(rows, data)
        return
    from collections import Counter
    model = Counter(r["model"] for r in data).most_common(1)[0][0]
    data = [r for r in data if r["model"] == model]
    name_fert = {r["name"]: r["byTokenizer"]["cl100k"]["fertility"] for r in rows.values()}
    langs = sorted({r["language"] for r in data}, key=lambda L: name_fert.get(L, 0))
    targets = sorted({r["target"] for r in data})
    cmap = plt.get_cmap("RdYlGn_r")
    n = max(1, len(langs) - 1)
    lang_col = {L: cmap(i / n) for i, L in enumerate(langs)}
    fig, axes = plt.subplots(1, len(targets), figsize=(4.3 * max(1, len(targets)), 4.6), sharey=True)
    if len(targets) == 1:
        axes = [axes]
    for ax, tgt in zip(axes, targets):
        for L in langs:
            pts = sorted([r for r in data if r["language"] == L and r["target"] == tgt],
                         key=lambda r: r["pos"])
            if not pts:
                continue
            ax.plot([p["pos"] for p in pts], [p["recall"] for p in pts],
                    marker="o", ms=4, lw=1.8,
                    color=lang_col[L], label=L)
        ax.set_title(f"context filled to {tgt}%")
        ax.set_xlabel("needle position (% of context)")
        ax.set_ylim(0, 1.02)
        ax.set_xticks([5, 25, 50, 75, 95])
        ax.grid(color="#eef0f2")
    axes[0].set_ylabel("needle recall rate")
    axes[-1].legend(loc="lower left", frameon=False, title="language (low→high fertility)")
    fig.suptitle(f"Figure 4.  Multi-turn needle recall vs. context position  (model: {model})",
                 fontweight="bold", fontsize=13, y=1.02)
    if not REAL:
        for ax in axes:
            ax.text(50, 0.5, "ILLUSTRATIVE\nSYNTHETIC\nPLACEHOLDER", fontsize=18,
                    color="#ef4444", alpha=0.18, ha="center", va="center",
                    rotation=24, fontweight="bold", zorder=10)
        fig.text(0.5, -0.04,
                 "TEMPLATE — data/benchmark_results.csv currently holds synthetic placeholders. "
                 "Replace recall_rate with measured runs and re-run with --real.",
                 ha="center", fontsize=9, color="#ef4444")
    else:
        fig.text(0.5, -0.04,
                 "Measured needle recall vs. context-fill position, by language (ordered low→high fertility).",
                 ha="center", fontsize=8.5, color="#6b7280")
    save(fig, "fig4_multiturn_degradation")


def main():
    if not LEADERBOARD.exists():
        sys.exit(f"leaderboard not found at {LEADERBOARD}")
    d, rows = load()
    print("Generating figures ->", OUT)
    fig1_token_tax(d, rows)
    fig2_exhaustion(d, rows)
    fig3_capacity(d, rows)
    fig4_degradation(rows)
    print("Done.")


if __name__ == "__main__":
    main()
