import type { Sentence, FeedbackItem, GPTPlan, HowItem } from "@/lib/type";
import { getOpenAICompletion } from "@/lib/utils";
import katex from "katex";

const FEEDBACK_TYPES = [
  "Claim",
  "Reasoning",
  "Evidence",
  "Rebuttal",
  "Others",
  "Organization",
  "Word Usage",
  "Orthography",
] as const;

const MIN_FEEDBACK_ITEMS = 28;
const MAX_FEEDBACK_ITEMS = 64;

type LLMFeedbackEntry = {
  content: string;
  type: string;
  sentenceId: number;
  sentenceText: string;
  why: string;
  how?: { title: string; strategy: string }[];
};

const FEEDBACK_TYPE_BY_KEY: Record<string, (typeof FEEDBACK_TYPES)[number]> = {
  claim: "Claim",
  reasoning: "Reasoning",
  evidence: "Evidence",
  rebuttal: "Rebuttal",
  others: "Others",
  organization: "Organization",
  "word usage": "Word Usage",
  "word-usage": "Word Usage",
  orthography: "Orthography",
};

function getTargetFeedbackCount(sentenceCount: number): number {
  return Math.max(
    MIN_FEEDBACK_ITEMS,
    Math.min(MAX_FEEDBACK_ITEMS, Math.round(sentenceCount * 2.2)),
  );
}

function canonicalizeType(type: string): (typeof FEEDBACK_TYPES)[number] {
  const key = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return FEEDBACK_TYPE_BY_KEY[key] ?? "Others";
}

function sentenceSnippet(sentence: string): string {
  const cleaned = sentence.replace(/\s+/g, " ").trim();
  if (!cleaned) return "this sentence";
  // Keep full sentence when LaTeX is present so math delimiters are not truncated.
  if (/\\\[|\\\]|\\\(|\\\)|\$\$|\$|\\[a-zA-Z]+\{/.test(cleaned)) {
    return cleaned;
  }
  return cleaned.length > 96 ? `${cleaned.slice(0, 93)}...` : cleaned;
}

function getKeyPhrases(sentence: string): string[] {
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 4);
  const stop = new Set([
    "this",
    "that",
    "with",
    "from",
    "into",
    "because",
    "therefore",
    "which",
    "their",
    "about",
    "should",
    "could",
    "would",
    "being",
    "where",
    "while",
    "when",
    "have",
    "has",
    "been",
    "were",
    "your",
    "more",
    "than",
  ]);
  const uniq: string[] = [];
  for (const word of words) {
    if (stop.has(word)) continue;
    if (uniq.includes(word)) continue;
    uniq.push(word);
    if (uniq.length >= 3) break;
  }
  return uniq;
}

function buildSpecificFeedbackForSentence(
  type: (typeof FEEDBACK_TYPES)[number],
  sentence: Sentence,
): Pick<LLMFeedbackEntry, "content" | "why" | "how"> {
  const snippet = sentenceSnippet(sentence.content);
  const phraseList = getKeyPhrases(sentence.content);
  const focus = phraseList.length > 0 ? ` (focus: ${phraseList.join(", ")})` : "";

  if (type === "Word Usage") {
    return {
      content: `In "${snippet}", replace broad wording with more precise terms and avoid stacked abstractions so the claim is easier to interpret.${focus}`,
      why: "Sentence-level wording precision improves clarity and prevents readers from guessing your intended meaning.",
      how: [
        {
          title: "Tighten wording",
          strategy:
            "Swap one vague phrase for a concrete term and keep one main idea per clause.",
        },
      ],
    };
  }
  if (type === "Orthography") {
    return {
      content: `This sentence has high punctuation complexity: "${snippet}". Simplify punctuation boundaries so each clause has an unambiguous subject-verb unit.${focus}`,
      why: "Cleaner punctuation and grammar reduce processing load and improve readability.",
      how: [
        {
          title: "Fix mechanics",
          strategy:
            "Split long clauses or re-punctuate to remove comma splices and ambiguous attachments.",
        },
      ],
    };
  }
  if (type === "Organization") {
    return {
      content: `The transition around "${snippet}" is weak. Add a linking phrase that states how this sentence extends or contrasts the previous point.${focus}`,
      why: "Explicit transitions improve paragraph flow and keep argument structure visible.",
      how: [
        {
          title: "Add transition logic",
          strategy:
            "Start the sentence with a connector that names its role: continuation, contrast, or consequence.",
        },
      ],
    };
  }
  if (type === "Evidence") {
    return {
      content: `The claim in "${snippet}" needs concrete support. Add one specific example, metric, or citation directly tied to the sentence claim.${focus}`,
      why: "Evidence anchored to the sentence strengthens credibility and reduces overgeneralization.",
      how: [
        {
          title: "Attach evidence",
          strategy:
            "Insert one verifiable fact and explicitly explain how it supports this sentence.",
        },
      ],
    };
  }
  if (type === "Claim") {
    return {
      content: `The stance in "${snippet}" is still implicit. Rewrite the sentence so the core claim and scope are explicit in one line.${focus}`,
      why: "A direct, bounded claim helps readers track your position across the paragraph.",
      how: [
        {
          title: "Make claim explicit",
          strategy:
            "Use one assertion verb and name exactly what is being argued and under what condition.",
        },
      ],
    };
  }
  if (type === "Rebuttal") {
    return {
      content: `For "${snippet}", include a stronger counterpoint or limitation before returning to your main position.${focus}`,
      why: "A developed rebuttal shows you can handle alternative interpretations instead of skipping them.",
      how: [
        {
          title: "Develop rebuttal",
          strategy:
            "State one plausible objection, then answer it with a reason or evidence.",
        },
      ],
    };
  }
  if (type === "Reasoning") {
    return {
      content: `The logical step in "${snippet}" is compressed. Add one explicit inferential link showing how the premise leads to the conclusion.${focus}`,
      why: "Explicit reasoning prevents hidden jumps and makes the argument testable.",
      how: [
        {
          title: "Expose logic",
          strategy:
            "Insert a because/therefore bridge that names the causal or deductive relation.",
        },
      ],
    };
  }
  return {
    content: `In "${snippet}", make the sentence purpose explicit and tie it to the paragraph goal.${focus}`,
    why: "Sentence-specific revision increases coherence and interpretability.",
    how: [
      {
        title: "Clarify intent",
        strategy:
          "Revise the sentence so its function and contribution are immediately visible.",
      },
    ],
  };
}

function isGenericContent(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return true;
  const genericPatterns = [
    "consider tightening wording",
    "check punctuation, capitalization, and grammar",
    "strengthen the transition",
    "add more concrete support",
    "clarify the main claim",
    "explain the reasoning step more explicitly",
    "improve clarity, persuasiveness, and coherence",
  ];
  return genericPatterns.some((p) => normalized.includes(p));
}

function enforceSentenceSpecificity(
  entries: LLMFeedbackEntry[],
  sentences: Sentence[],
): LLMFeedbackEntry[] {
  const sentenceMap = new Map<number, Sentence>();
  for (const s of sentences) sentenceMap.set(s.id, s);

  const usedByType = new Map<string, Set<string>>();
  const out: LLMFeedbackEntry[] = [];

  for (const entry of entries) {
    const sentence = sentenceMap.get(entry.sentenceId);
    if (!sentence) continue;
    const type = canonicalizeType(entry.type);
    const contentNorm = entry.content.trim().toLowerCase();
    const typeKey = type.toLowerCase();
    if (!usedByType.has(typeKey)) usedByType.set(typeKey, new Set<string>());
    const used = usedByType.get(typeKey)!;

    const needRewrite = isGenericContent(entry.content) || used.has(contentNorm);
    if (needRewrite) {
      const specific = buildSpecificFeedbackForSentence(type, sentence);
      entry.content = specific.content;
      entry.why = specific.why;
      entry.how = specific.how;
    }

    entry.type = type;
    entry.sentenceText = sentence.content;
    used.add(entry.content.trim().toLowerCase());
    out.push(entry);
  }
  return out;
}

function buildSystemPrompt(targetCount: number): string {
  return `You are an expert writing tutor. Given an essay broken into numbered sentences, produce actionable feedback items.

For each feedback item return a JSON object with:
- content: the feedback text (1-2 sentences, clear and constructive)
- type: one of ${FEEDBACK_TYPES.join(", ")}
- sentenceId: the 1-based index of the sentence this feedback refers to (1, 2, 3, ...)
- sentenceText: the exact sentence text
- why: brief explanation of why this feedback matters
- how: optional array of 1-3 revision strategies, each with "title" and "strategy" strings

Return ONLY a valid JSON array of such objects, no other text.
Generate around ${targetCount} feedback items, and at least ${Math.max(10, Math.floor(targetCount * 0.75))}.
Cover as many different sentences as possible, and include both high-level structure issues and sentence-level writing issues.
Be concrete and specific; avoid generic comments.
Within the same type/category, feedback for different sentences must not repeat templated wording; tie each item to unique sentence details.`;
}

function buildUserPrompt(sentences: Sentence[]): string {
  const numbered = sentences
    .map((s) => `[${s.id}] ${s.content}`)
    .join("\n");
  return `Essay sentences (id in brackets):\n\n${numbered}`;
}

function parseLLMResponse(text: string | null | undefined): LLMFeedbackEntry[] {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  // Handle markdown code block if present
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseFirstJsonArray(text: string | null | undefined): LLMFeedbackEntry[] {
  if (!text || typeof text !== "string") return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEntries(
  entries: LLMFeedbackEntry[],
  sentences: Sentence[],
): LLMFeedbackEntry[] {
  const sentenceMap = new Map<number, Sentence>();
  for (const s of sentences) {
    sentenceMap.set(s.id, s);
  }

  return entries.filter((entry) => {
    const sentenceId = Number(entry?.sentenceId);
    const sentenceText = typeof entry?.sentenceText === "string" && entry.sentenceText.trim();
    const content = typeof entry?.content === "string" && entry.content.trim();
    const why = typeof entry?.why === "string" && entry.why.trim();
    if (!Number.isInteger(sentenceId)) return false;
    const sentence = sentenceMap.get(sentenceId);
    if (!sentence) return false;
    if (!content || !why) return false;

    entry.type = canonicalizeType(entry.type);
    entry.sentenceText = sentence.content;

    return (
      sentenceId >= 1 &&
      sentenceId <= sentences.length &&
      Boolean(sentenceText || sentence.content.trim())
    );
  });
}

function dedupeEntries(entries: LLMFeedbackEntry[]): LLMFeedbackEntry[] {
  const seen = new Set<string>();
  const out: LLMFeedbackEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.sentenceId}|${entry.type}|${entry.content.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function extractMathExpressions(text: string): string[] {
  const matches = text.match(
    /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$/g,
  );
  return matches ?? [];
}

function unwrapMathDelimiters(expr: string): string {
  if (expr.startsWith("\\[") && expr.endsWith("\\]")) {
    return expr.slice(2, -2).trim();
  }
  if (expr.startsWith("\\(") && expr.endsWith("\\)")) {
    return expr.slice(2, -2).trim();
  }
  if (expr.startsWith("$$") && expr.endsWith("$$")) {
    return expr.slice(2, -2).trim();
  }
  if (expr.startsWith("$") && expr.endsWith("$")) {
    return expr.slice(1, -1).trim();
  }
  return expr.trim();
}

function buildFormulaSyntaxFeedback(sentences: Sentence[]): LLMFeedbackEntry[] {
  const out: LLMFeedbackEntry[] = [];
  for (const s of sentences) {
    const formulas = extractMathExpressions(s.content);
    for (const raw of formulas) {
      const math = unwrapMathDelimiters(raw);
      if (!math) continue;
      try {
        katex.renderToString(math, { throwOnError: true, displayMode: false });
      } catch (error) {
        const err =
          error instanceof Error ? error.message : "LaTeX syntax may be invalid.";
        out.push({
          content:
            "This formula appears to have LaTeX syntax issues. Consider correcting command names, braces, or delimiters.",
          type: "Others",
          sentenceId: s.id,
          sentenceText: s.content,
          why: `Invalid formula syntax can break rendering and reduce readability. Parser hint: ${err}`,
          how: [
            {
              title: "Validate LaTeX syntax",
              strategy:
                "Check unmatched braces, command spelling, and proper use of subscripts/superscripts.",
            },
          ],
        });
      }
    }
  }
  return out;
}

function buildFormulaPrompt(formulaSentences: Sentence[]): string {
  const numbered = formulaSentences.map((s) => `[${s.id}] ${s.content}`).join("\n");
  return `You are reviewing mathematical writing in an essay.
For each sentence below that contains formulas, produce concrete checks on mathematical correctness and notation consistency.
Look for issues such as inconsistent symbols, undefined variables, impossible equalities, dimensional mismatch, and ambiguous notation.
Return ONLY a JSON array using the same schema:
content, type, sentenceId, sentenceText, why, how.
Use type as "Reasoning" or "Others".

Formula-related sentences:
${numbered}`;
}

function buildAdditionalPrompt(
  sentences: Sentence[],
  existing: LLMFeedbackEntry[],
  targetCount: number,
): string {
  const numbered = sentences
    .map((s) => `[${s.id}] ${s.content}`)
    .join("\n");
  const existingDigest = existing
    .slice(0, 60)
    .map((e) => `(${e.sentenceId}) ${e.type}: ${e.content}`)
    .join("\n");

  return `Essay sentences (id in brackets):\n\n${numbered}\n\nExisting feedback items (do not repeat these ideas):\n${existingDigest}\n\nGenerate additional distinct feedback to reach around ${targetCount} total items.`;
}

function buildFallbackEntries(
  sentences: Sentence[],
  existing: LLMFeedbackEntry[],
  needed: number,
): LLMFeedbackEntry[] {
  const coverage = new Map<number, number>();
  for (const e of existing) {
    coverage.set(e.sentenceId, (coverage.get(e.sentenceId) ?? 0) + 1);
  }
  const sorted = [...sentences].sort(
    (a, b) => (coverage.get(a.id) ?? 0) - (coverage.get(b.id) ?? 0),
  );
  const types = [
    "Reasoning",
    "Evidence",
    "Organization",
    "Word Usage",
    "Orthography",
    "Claim",
  ];
  const out: LLMFeedbackEntry[] = [];
  let idx = 0;
  while (out.length < needed && sorted.length > 0) {
    const s = sorted[idx % sorted.length];
    const type = canonicalizeType(types[idx % types.length]);
    const sentenceText = s.content;
    const specific = buildSpecificFeedbackForSentence(type, s);
    out.push({
      sentenceId: s.id,
      sentenceText,
      type,
      content: specific.content,
      why: specific.why,
      how: specific.how,
    });
    idx++;
  }
  return out;
}

function toFeedbackItem(entry: LLMFeedbackEntry, id: number): FeedbackItem {
  const how: HowItem[] = Array.isArray(entry.how)
    ? entry.how.map((h) => ({
        title: typeof h.title === "string" ? h.title : "Improve",
        strategy: typeof h.strategy === "string" ? h.strategy : "",
      }))
    : [];

  const plan: GPTPlan[] = [
    {
      sentence: entry.sentenceText || "",
      what: [entry.sentenceId],
      why: entry.why || "",
      how,
    },
  ];

  return {
    id,
    content: entry.content || "",
    type: canonicalizeType(entry.type),
    actionability: 0.8,
    justification: 0.6,
    sentiment: 0.5,
    specificity: 0.6,
    engagement: 2.5,
    source: 1,
    file: "LLM",
    plan,
    addressed: false,
  };
}

export async function generateFeedbackForEssay(
  sentences: Sentence[],
): Promise<FeedbackItem[]> {
  if (sentences.length === 0) return [];

  const targetCount = getTargetFeedbackCount(sentences.length);
  const minimumCount = Math.max(10, Math.floor(targetCount * 0.75));
  const systemPrompt = buildSystemPrompt(targetCount);

  const firstRaw = await getOpenAICompletion(
    systemPrompt,
    buildUserPrompt(sentences),
    0.5,
    4096,
  );
  let entries = dedupeEntries(
    normalizeEntries(
      [...parseLLMResponse(firstRaw), ...parseFirstJsonArray(firstRaw)],
      sentences,
    ),
  );

  if (entries.length < minimumCount) {
    const secondRaw = await getOpenAICompletion(
      systemPrompt,
      buildAdditionalPrompt(sentences, entries, targetCount),
      0.6,
      4096,
    );
    const extra = dedupeEntries(
      normalizeEntries(
        [...parseLLMResponse(secondRaw), ...parseFirstJsonArray(secondRaw)],
        sentences,
      ),
    );
    entries = dedupeEntries([...entries, ...extra]);
  }

  const formulaSentences = sentences.filter(
    (s) => extractMathExpressions(s.content).length > 0,
  );
  if (formulaSentences.length > 0) {
    const formulaRaw = await getOpenAICompletion(
      buildSystemPrompt(Math.min(18, formulaSentences.length * 2)),
      buildFormulaPrompt(formulaSentences),
      0.3,
      4096,
    );
    const formulaEntries = dedupeEntries(
      normalizeEntries(
        [...parseLLMResponse(formulaRaw), ...parseFirstJsonArray(formulaRaw)],
        sentences,
      ),
    );
    const localFormulaEntries = buildFormulaSyntaxFeedback(sentences);
    entries = dedupeEntries([...entries, ...formulaEntries, ...localFormulaEntries]);
  }

  if (entries.length < minimumCount) {
    const fallback = buildFallbackEntries(
      sentences,
      entries,
      minimumCount - entries.length,
    );
    entries = dedupeEntries([...entries, ...fallback]);
  }

  entries = enforceSentenceSpecificity(entries, sentences);
  entries = dedupeEntries(entries);

  return entries
    .slice(0, MAX_FEEDBACK_ITEMS)
    .map((e, i) => toFeedbackItem(e, i + 1));
}

export function buildFeedbackSummary(feedback: FeedbackItem[]): string {
  const byType: Record<string, number> = {};
  const sentencesTouched = new Set<number>();
  feedback.forEach((item) => {
    byType[item.type] = (byType[item.type] || 0) + 1;
    item.plan?.forEach((p) => p.what?.forEach((w) => sentencesTouched.add(w)));
  });
  const parts = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}: ${count} comments`);
  return `Feedback highlights: ${parts.join("; ")}. ${sentencesTouched.size} sentences addressed.`;
}
