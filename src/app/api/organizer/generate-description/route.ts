import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface GenerateBody {
  title: string;
  venue?: string;
  city?: string;
  startsAt?: string;
  currency?: string;
  ticketTypes?: { name: string; price: number }[];
}

// Generates a short, punchy event description from whatever fields the
// organizer has already filled in on the "New event" form. Requires a
// GEMINI_API_KEY env var (Google's Gemini API) — see setup note in the
// Vercel dashboard if this route 500s with a config error.
//
// Using gemini-2.5-flash rather than the newer 3.x models: Google's own docs
// say to keep using the legacy generateContent endpoint (not the newer
// Interactions API) for stable production use, and 2.5-flash is the
// best-established model on that endpoint — newer 3.x models returned
// "invalid argument" errors against generateContent in testing.
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
      { error: "AI description generation isn't configured yet. Add GEMINI_API_KEY in Vercel." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as GenerateBody;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Add a title first so there's something to write about." }, { status: 400 });
  }

  const details = [
    `Event title: ${body.title}`,
    body.venue ? `Venue: ${body.venue}` : null,
    body.city ? `City: ${body.city}` : null,
    body.startsAt ? `Date/time: ${new Date(body.startsAt).toLocaleString()}` : null,
    body.ticketTypes?.length
      ? `Ticket types: ${body.ticketTypes
          .filter((tt) => tt.name)
          .map((tt) => `${tt.name}${tt.price ? ` (${tt.price} ${body.currency ?? ""})` : ""}`)
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Write a rich, energetic event description (5-8 sentences, roughly 120-180 words, no headers, no markdown, no emoji) for a ticketing page, based on these details:\n\n${details}\n\nCover the vibe, who it's for, and why someone should grab a ticket. Don't invent specific details that weren't given (like guest lists or exact activities); write generally exciting copy that fits what's provided. Never use em dashes or hyphens as sentence breaks, use commas and periods instead so the writing reads naturally. Output only the description text, nothing else.`;

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
            maxOutputTokens: 2048,
            // gemini-2.5-flash thinks by default, which eats into
            // maxOutputTokens before it writes the visible answer — for a
            // short copywriting task that just risks truncating the real
            // output. Disabling it via the (2.5-series) thinkingBudget field
            // sends the full token budget to the actual description text.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Log the full Gemini error (status + details) to Vercel's function
      // logs so we can see exactly which field it's rejecting, not just the
      // generic top-level message.
      console.error("Gemini API error:", JSON.stringify(err));
      throw new Error(err?.error?.message ?? "AI request failed");
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const description = candidate?.content?.parts?.[0]?.text?.trim();
    if (!description) {
      const reason = candidate?.finishReason;
      throw new Error(reason ? `AI returned no text (${reason})` : "AI returned an empty response");
    }

    return NextResponse.json({ description });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 502 });
  }
}
