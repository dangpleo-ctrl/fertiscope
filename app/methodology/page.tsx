import { Card, SectionLabel, Deterministic, Estimated, Caveat } from "@/components/ui";

export const metadata = { title: "FertiScope — Methodology & Honesty" };

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-white">Methodology &amp; Honesty</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-400">
        FertiScope draws a hard line between numbers that are <b className="text-emerald-300">exact</b> (deterministic token
        math) and the one that is an <b className="text-amber-300">estimate</b> (multi-turn accuracy risk). The estimate is
        labelled everywhere it appears. This split is the whole point — a tool that confidently predicted accuracy loss would
        be selling a claim the underlying research could not support.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">Exact <Deterministic /></div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li><b>Fertility</b> = tokens ÷ words, from real tokenizers.</li>
            <li><b>Cost multiplier</b> = fertility ÷ English fertility (same tokenizer). Within one API, $/token is constant, so the token ratio <i>is</i> the cost ratio for equivalent content.</li>
            <li><b>In-context capacity</b> = ⌊(window − reply reserve) ÷ tokens-per-example⌋.</li>
            <li><b>Context budget</b> = cumulative tokens across turns vs. the window.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">Estimate <Estimated /></div>
          <p className="text-sm text-gray-300">
            <b>Multi-turn degradation risk</b> is a transparent 0–4 score. <b>Budget pressure</b> — how fast cumulative tokens
            cross 75% of the window — scores 0–2 and is the primary driver. <b>Fertility</b> scores 0–2 but only counts as an{" "}
            <b>amplifier once the budget is under pressure</b>, so a roomy window stays Low regardless of fertility. Totals map
            0–1 → Low, 2 → Medium, ≥3 → High. It is <b>not</b> a measured accuracy drop.
          </p>
          <div className="mt-3">
            <Caveat>
              The deep-research report found the accuracy-loss magnitude is <b>unestablished and regime-dependent</b> — it mainly
              bites as you approach the context window. On a 128K window a short 10-turn chat barely dents the budget, so the
              risk stays Low. That is why FertiScope shows risk per-window, not a single scary number.
            </Caveat>
          </div>
        </Card>
      </div>

      <SectionLabel>How words are counted</SectionLabel>
      <Card className="p-5 text-sm leading-relaxed text-gray-300">
        Word counts use the browser/Node <code className="rounded bg-white/10 px-1 py-0.5 text-xs">Intl.Segmenter</code> with{" "}
        <code className="rounded bg-white/10 px-1 py-0.5 text-xs">granularity:&quot;word&quot;</code>, counting only word-like
        segments. This handles spaceless scripts — Thai, Khmer, Burmese, Lao — correctly, where naïve whitespace splitting would
        count one giant &ldquo;word&rdquo; and badly distort fertility.
      </Card>

      <SectionLabel>Tokenizers &amp; data</SectionLabel>
      <Card className="space-y-3 p-5 text-sm leading-relaxed text-gray-300">
        <p>
          Three real tokenizer families run in-app: <b className="text-white">GPT-4o</b> (o200k_base) and{" "}
          <b className="text-white">GPT-4 / GPT-3.5</b> (cl100k_base) via <code className="rounded bg-white/10 px-1 text-xs">js-tiktoken</code>,
          and <b className="text-white">Llama-3.1 / SEA-LION v3</b> via <code className="rounded bg-white/10 px-1 text-xs">llama3-tokenizer-js</code>.
          Llama-3.1 and the continue-trained SEA-LION v3 share one tokenizer, so a single encoder covers both — and reproduces
          the research&rsquo;s reference numbers (Tamil ≈ 11–12 tokens/word).
        </p>
        <p>
          The leaderboard is computed on <b className="text-white">{`50`}</b> parallel sentences from{" "}
          <b className="text-white">FLORES-200</b> (NLLB, Meta AI — CC-BY-SA 4.0). Because every language expresses the same
          meaning, fertility ratios are genuinely apples-to-apples.
        </p>
      </Card>

      <SectionLabel>Known limitations</SectionLabel>
      <Card className="p-5 text-sm leading-relaxed text-gray-300">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Fertility varies by domain; the leaderboard reflects FLORES news/wiki text, not your exact corpus — use the Analyzer on your own text.</li>
          <li>The cost multiplier assumes word count is comparable across languages for equivalent content (true for FLORES, approximate for free text).</li>
          <li>SEA-LION / SeaLLMs are approximated by the Llama-3.1 tokenizer they are built on; a custom-extended vocab could differ slightly.</li>
          <li>Multi-turn risk is heuristic by design — see above.</li>
        </ul>
      </Card>

      <p className="mt-6 text-xs text-gray-500">
        Grounded in the deep-research report <i>&ldquo;Tokenizer Fertility and Multi-Turn Degradation&rdquo;</i> (2026), which
        confirmed the fertility tax is real and structural while flagging the multi-turn accuracy magnitude as an open question.
      </p>
    </div>
  );
}
