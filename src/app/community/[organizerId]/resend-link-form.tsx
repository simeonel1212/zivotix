"use client";

import { useState } from "react";

export default function ResendLinkForm({ organizerId }: { organizerId: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await fetch("/api/community/resend-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, organizerId }),
    });
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-neutral-400">
        If that email has a ticket from this organizer, a fresh link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        required
        placeholder="The email you used at checkout"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="zv-input flex-1"
      />
      <button disabled={sending} className="zv-btn-primary shrink-0">
        {sending ? "Sending…" : "Resend my link"}
      </button>
    </form>
  );
}
