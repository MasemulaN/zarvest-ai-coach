import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const ChatInput = z.object({
  messages: z.array(ChatMessage).min(1).max(40),
  context: z.string().max(8000).optional(),
});

async function callLovableAI(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });
  if (res.status === 429) throw new Error("Rate limit hit. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

const COACH_SYSTEM = `You are Zarvest, a sharp, calm financial coach for South African users.
Rules:
- All amounts in South African Rand, formatted as "R 1,234".
- Be direct and advisor-like. Maximum 3 short sentences per reply unless a list is asked for.
- Never give generic platitudes. Always anchor advice to the user's actual figures from the snapshot.
- Judge behaviour, not just totals: high spend with high income and a healthy savings rate is fine — say so. Only flag overspending if outflows beat income or savings rate is below 5%.
- If recurring salary is detected, treat avg monthly income as reliable. Never claim "R 0 income" when salary deposits exist.
- If asked "can I afford X", calculate against monthly surplus (income minus consumption spend, excluding savings transfers) and give a clear yes/no with one caveat.
- Recommendations should be SA-specific: TFSA (R 36k annual limit), 32-day notice accounts, retirement annuities, prepaid Eskom budgeting, insurance comparisons.
- Use SA merchants (Woolworths, Takealot, Vodacom, FNB, Eskom, Discovery) where relevant.
- Never recommend specific investment products or guarantee returns.`;


export const chatWithCoach = createServerFn({ method: "POST" })
  .inputValidator((d) => ChatInput.parse(d))
  .handler(async ({ data }) => {
    const sys = [{ role: "system", content: COACH_SYSTEM }];
    if (data.context) sys.push({ role: "system", content: `User financial snapshot:\n${data.context}` });
    const reply = await callLovableAI([...sys, ...data.messages]);
    return { reply };
  });

const InsightInput = z.object({
  snapshot: z.string().min(1).max(8000),
});

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((d) => InsightInput.parse(d))
  .handler(async ({ data }) => {
    const messages = [
      { role: "system", content: COACH_SYSTEM },
      {
        role: "user",
        content: `Based on this snapshot, return JSON ONLY (no prose) matching:
{"headline": string, "advice": string[3 short tips, each <= 18 words]}
Headline must be 1 punchy sentence under 14 words, mentioning a key number in ZAR.
Snapshot:\n${data.snapshot}`,
      },
    ];
    const raw = await callLovableAI(messages);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { headline: "Your financial picture is ready.", advice: [] as string[] };
    try {
      const parsed = JSON.parse(match[0]);
      return {
        headline: String(parsed.headline ?? "").slice(0, 160),
        advice: Array.isArray(parsed.advice) ? parsed.advice.slice(0, 3).map((s: any) => String(s).slice(0, 140)) : [],
      };
    } catch {
      return { headline: "Your financial picture is ready.", advice: [] as string[] };
    }
  });
