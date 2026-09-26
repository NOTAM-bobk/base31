import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

const MAX_BODY = 48_000;
const MAX_CONTEXT = 24_000;
const MAX_QUESTION = 2_000;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;

// Groq retires models over time, so the route discovers what the key can
// actually use instead of trusting a hard-coded name. `GROQ_MODEL` overrides.
const PREFERRED_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "qwen/qwen3.8-27b",
  "minimaxai/minimax-m2.7",
];

type TaskId = "readme" | "docs" | "roadmap" | "explain" | "ask";

const TASKS: Record<TaskId, { system: string }> = {
  readme: {
    system:
      "You are a senior open-source maintainer. Write one complete, ready-to-commit README.md in valid Markdown for the repository described by the user. " +
      "Start with an H1 title, then a one-paragraph description, a Features list, Getting started (install and run), Usage with code fences, " +
      "a short Project structure section, and a License line. Use only facts from the provided context plus widely known conventions; " +
      "never invent exact commands or versions you cannot infer — if something is unknown, add a short TODO note instead. Output Markdown only, no commentary.",
  },
  docs: {
    system:
      "You are a technical writer. Produce clear developer documentation in Markdown for the repository described by the user. " +
      "Cover purpose, architecture overview, the key files and modules visible in the tree, setup, configuration and environment variables, and common tasks. " +
      "Use headings, lists and code fences. Output Markdown only.",
  },
  roadmap: {
    system:
      "You are a product-minded maintainer reviewing the repository described by the user. Suggest what to add or improve next. " +
      "Be specific to this project, prioritised and justified, grouped into Now / Next / Later, and cover tests, developer experience, documentation, " +
      "performance and security where they apply. Avoid generic advice. Output Markdown only.",
  },
  explain: {
    system:
      "You are a patient senior engineer. Explain the provided file or code to a developer who is new to this repository. " +
      "Describe what it does, how it fits the wider project, its key parts, and anything surprising or risky. " +
      "Use short paragraphs and a bullet list. Output Markdown only.",
  },
  ask: {
    system:
      "You are a helpful assistant answering questions about the GitHub repository described by the user. " +
      "Answer from the provided context; when the context is missing something, say what is missing rather than guessing. " +
      "Be concise and concrete. Output Markdown only.",
  },
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const recentRequests = new Map<string, number[]>();

const allowRequest = (address: string): boolean => {
  const now = Date.now();
  const recent = (recentRequests.get(address) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    recentRequests.set(address, recent);
    return false;
  }
  recent.push(now);
  recentRequests.set(address, recent);

  // Best-effort per-instance throttle; provider-side limits are the backstop.
  if (recentRequests.size > 1000) {
    for (const [key, timestamps] of recentRequests) {
      if (timestamps.every((time) => now - time >= WINDOW_MS)) recentRequests.delete(key);
    }
  }
  return true;
};

let cachedModel: string | null = null;

async function resolveModel(apiKey: string): Promise<string> {
  const override = process.env.GROQ_MODEL?.trim();
  if (override) return override;
  if (cachedModel) return cachedModel;

  try {
    const response = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
      const ids = (payload.data ?? [])
        .map((entry) => entry?.id)
        .filter((id): id is string => typeof id === "string");
      const preferred = PREFERRED_MODELS.find((model) => ids.includes(model));
      const fallback = ids.find((id) => !/whisper|tts|orpheus|guard|safeguard/i.test(id));
      cachedModel = preferred ?? fallback ?? PREFERRED_MODELS[0];
      return cachedModel;
    }
  } catch {
    // Fall through to the default below.
  }

  cachedModel = PREFERRED_MODELS[0];
  return cachedModel;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ error: "This request could not be verified." }, 403);
      }
    } catch {
      return json({ error: "This request could not be verified." }, 403);
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(
      { error: "AI features are not switched on yet.", code: "no-key" },
      503,
    );
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return json({ error: "That request is too large." }, 413);

  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "That request is too large." }, 413);
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const task = typeof payload.task === "string" ? payload.task : "";
  const spec = (TASKS as Record<string, { system: string } | undefined>)[task];
  if (!spec) return json({ error: "Unknown task." }, 400);

  const context = typeof payload.context === "string" ? payload.context.slice(0, MAX_CONTEXT) : "";
  const question = typeof payload.question === "string" ? payload.question.trim().slice(0, MAX_QUESTION) : "";

  if (task === "ask" && question.length < 3) {
    return json({ error: "Please ask a longer question." }, 400);
  }
  if (task !== "ask" && context.length < 20) {
    return json({ error: "There was not enough repository context to work with." }, 400);
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim();
  if (address && !allowRequest(address)) {
    return json({ error: "Too many AI requests from this connection. Please wait a few minutes." }, 429);
  }

  const userContent =
    [
      context ? `Repository context:\n\n${context}` : "",
      question ? `Question: ${question}` : "",
    ]
      .filter(Boolean)
      .join("\n\n") || "(no context provided)";

  const model = await resolveModel(apiKey);

  const callGroq = (useModel: string) =>
    fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: "system", content: spec.system },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 2048,
      }),
    });

  try {
    let response = await callGroq(model);
    if (!response.ok && (response.status === 400 || response.status === 404)) {
      // The cached model may have been retired — re-discover once and retry.
      cachedModel = null;
      const retryModel = await resolveModel(apiKey);
      if (retryModel !== model) response = await callGroq(retryModel);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return json({ error: "The AI service is rate-limiting right now. Please try again shortly." }, 429);
      }
      return json({ error: "The AI service could not complete that request. Please try again." }, 502);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return json({ error: "The AI service returned an empty answer. Please try again." }, 502);
    }
    return json({ text });
  } catch {
    return json({ error: "The AI service could not be reached right now." }, 502);
  }
}
