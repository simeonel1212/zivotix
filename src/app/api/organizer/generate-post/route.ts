import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface GenerateBody {
  topic: string;
}

// Same Gemini setup as /api/organizer/generate-description, but for
// community posts: the organizer jots a rough idea in the composer (a
// lineup drop, a reminder, behind-the-scenes news) and this turns it into a
// short, punchy caption for the feed — there's no structured event data to
// draw on here, just whatever they've typed so far.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: organizer } = await supabase.from("organizers").select("id").eq("profile_id", user.id).single();
  if (!organizer) return NextResponse.json({ error: "No organizer account found" }, { status: 403 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI generation isn't configured yet. Add GEMINI_API_KEY in Vercel." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as GenerateBody;
  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Type a quick idea first so there's something to write about." }, { status: 400 });
  }

  const prompt = `Write a short, punchy social post caption (2-4 sentences, roughly 25-60 words, no headers, no markdown, no hashtags, no emoji) for a ticketing platform's community feed, based on this rough idea from the event organizer:\n\n${body.topic.trim()}\n\nKeep the casual, excited, direct tone of someone posting straight to their fans. Don't invent specific details that weren't given (like names, prices, or exact numbers) beyond what's in the idea above. Never use em dashes or hyphens as sentence breaks, use commas and periods instead so the writing reads naturally. Output only the caption text, nothing else.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Gemini API error:", JSON.stringify(err));
      throw new Error(err?.error?.message ?? "AI request failed");
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const caption = candidate?.content?.parts?.[0]?.text?.trim();
    if (!caption) {
      const reason = candidate?.finishReason;
      throw new Error(reason ? `AI returned no text (${reason})` : "AI returned an empty response");
    }

    return NextResponse.json({ body: caption });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 502 });
  }
}
