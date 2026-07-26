import { NextResponse } from "next/server";
import { sendContactMessageEmail, sendContactAckEmail } from "@/lib/email";

// Topics must match the options rendered on /contact. Validated against this
// list rather than accepted as free text, so the subject line of the support
// email can't be set to anything the sender likes.
const TOPICS = [
  "Ticket or order",
  "Refund request",
  "Organizing an event",
  "Payouts",
  "Report a problem",
  "Press or partnership",
  "Something else",
] as const;

const MAX_MESSAGE = 4000;

// Best-effort in-memory throttle. Serverless instances are short-lived and
// there may be several of them, so this won't stop a determined attacker —
// it exists to stop one person hammering submit and to keep the honeypot
// company. Anything stronger belongs at the edge.
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (recent.size > 500) {
    for (const [k, v] of recent) {
      if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
    }
  }
  return false;
}

interface ContactBody {
  name?: string;
  email?: string;
  topic?: string;
  orderRef?: string;
  message?: string;
  // Hidden field. Real people leave it empty; most bots fill every input
  // they find.
  website?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ContactBody;

  // Silently accept and discard bot submissions. Returning an error would
  // tell the bot which field gave it away.
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const topic = (body.topic ?? "").trim();
  const orderRef = (body.orderRef ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Please tell us your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address, that's where our reply goes." },
      { status: 400 }
    );
  }
  if (!(TOPICS as readonly string[]).includes(topic)) {
    return NextResponse.json({ error: "Choose what your message is about." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Add a bit more detail so we can help." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Please keep it under ${MAX_MESSAGE.toLocaleString()} characters.` },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "That's a few messages in a short time. Give it a few minutes, or email us directly." },
      { status: 429 }
    );
  }

  try {
    await sendContactMessageEmail({
      fromName: name.slice(0, 120),
      fromEmail: email,
      topic,
      orderRef: orderRef ? orderRef.slice(0, 80) : null,
      message,
    });
  } catch (e) {
    console.error("Contact form send failed:", e);
    return NextResponse.json(
      { error: "We couldn't send that just now. Please email support@zivotix.site directly." },
      { status: 502 }
    );
  }

  // Acknowledgement is deliberately after the support email and never blocks
  // success — see sendContactAckEmail.
  await sendContactAckEmail({ to: email, name: name.slice(0, 120) });

  return NextResponse.json({ ok: true });
}
