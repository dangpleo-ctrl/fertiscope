// Server-side tokenization (Node runtime). Computes fertility for a pasted text across
// every tokenizer family, plus per-token "chips" for the selected tokenizer so the UI can
// visualise how a word shatters into byte fragments.
import { getEncoding } from "js-tiktoken";
import llama3 from "llama3-tokenizer-js";

export const runtime = "nodejs";

type TID = "o200k" | "cl100k" | "llama3";

const o200k = getEncoding("o200k_base");
const cl100k = getEncoding("cl100k_base");

const ENC: Record<TID, { ids: (s: string) => number[]; decode: (id: number) => string }> = {
  o200k: { ids: (s) => o200k.encode(s), decode: (id) => safe(() => o200k.decode([id])) },
  cl100k: { ids: (s) => cl100k.encode(s), decode: (id) => safe(() => cl100k.decode([id])) },
  llama3: { ids: (s) => llama3.encode(s, { bos: false, eos: false }), decode: (id) => safe(() => llama3.decode([id])) },
};

function safe(fn: () => string): string {
  try {
    return fn();
  } catch {
    return "�";
  }
}

function wordCount(s: string, loc: string): number {
  try {
    const seg = new Intl.Segmenter(loc, { granularity: "word" });
    let n = 0;
    for (const part of seg.segment(s)) if ((part as { isWordLike?: boolean }).isWordLike) n++;
    return n;
  } catch {
    return s.split(/\s+/).filter(Boolean).length;
  }
}

export async function POST(req: Request) {
  let body: { text?: string; bcp47?: string; display?: TID };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").slice(0, 20000);
  const bcp47 = body.bcp47 ?? "en";
  const display: TID = (["o200k", "cl100k", "llama3"] as TID[]).includes(body.display as TID) ? (body.display as TID) : "llama3";

  if (!text.trim()) return Response.json({ error: "empty text" }, { status: 400 });

  const words = wordCount(text, bcp47);
  const chars = [...text].length;

  const perTokenizer: Record<TID, { tokens: number; fertility: number }> = {} as never;
  for (const id of ["o200k", "cl100k", "llama3"] as TID[]) {
    const tokens = ENC[id].ids(text).length;
    perTokenizer[id] = { tokens, fertility: words ? tokens / words : tokens };
  }

  const CHIP_CAP = 240;
  const dIds = ENC[display].ids(text);
  const chips = dIds.slice(0, CHIP_CAP).map((id) => ENC[display].decode(id));

  return Response.json({
    words,
    chars,
    display,
    perTokenizer,
    chips,
    chipsTruncated: dIds.length > CHIP_CAP,
  });
}
