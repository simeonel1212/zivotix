"use client";

import { useState } from "react";

const TOPICS = [
  "Ticket or order",
  "Refund request",
  "Organizing an event",
  "Payouts",
  "Report a problem",
  "Press or partnership",
  "Something else",
];

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "",
    orderRef: "",
    message: "",
    website: "", // honeypot
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // The order reference field only makes sense for these two, and asking for
  // it on a press enquiry just adds a field to ignore.
  const showOrderRef = form.topic === "Ticket or order" || form.topic === "Refund request";

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="zv-card zv-pop-in p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-50">Message sent</h2>
        <p className="mt-2 text-sm text-neutral-400">
          We&apos;ve emailed you a confirmation. A real person reads every message and we usually reply
          within one business day.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setForm({ name: "", email: "", topic: "", orderRef: "", message: "", website: "" });
          }}
          className="zv-btn-secondary mt-6 text-sm"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="zv-card p-6 sm:p-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="zv-label" htmlFor="contact-name">
            Your name
          </label>
          <input
            id="contact-name"
            className="zv-input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="zv-label" htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            className="zv-input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className="zv-label" htmlFor="contact-topic">
          What&apos;s it about?
        </label>
        <select
          id="contact-topic"
          className="zv-input"
          value={form.topic}
          onChange={(e) => set("topic", e.target.value)}
          required
        >
          <option value="" disabled>
            Choose one
          </option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {showOrderRef && (
        <div className="zv-pop-in">
          <label className="zv-label" htmlFor="contact-order">
            Order reference <span className="font-normal text-neutral-500">(optional, speeds things up)</span>
          </label>
          <input
            id="contact-order"
            className="zv-input"
            placeholder="e.g. ZVX4A9C1"
            value={form.orderRef}
            onChange={(e) => set("orderRef", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-neutral-500">
            It&apos;s at the top of your ticket email, and on your ticket page.
          </p>
        </div>
      )}

      <div>
        <label className="zv-label" htmlFor="contact-message">
          Message
        </label>
        <textarea
          id="contact-message"
          className="zv-input min-h-[150px] resize-y"
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          required
          maxLength={4000}
          placeholder="Tell us what's going on. The more detail, the faster we can sort it."
        />
      </div>

      {/* Honeypot: hidden from people, irresistible to bots. Not display:none,
          which some bots skip — off-screen and out of the tab order instead. */}
      <div className="absolute left-[-9999px] top-0" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
        <button type="submit" disabled={loading} className="zv-btn-primary w-full sm:w-auto">
          {loading ? "Sending…" : "Send message"}
        </button>
        <p className="text-xs text-neutral-500">
          By sending this you agree to our{" "}
          <a href="/privacy" className="underline hover:text-neutral-300">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
