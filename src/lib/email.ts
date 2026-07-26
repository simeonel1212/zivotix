import { Resend } from "resend";
import { generateQrBuffer } from "./qrcode";
import { appUrl } from "./app-url";
import { escapeHtml } from "./html";

const resend = new Resend(process.env.RESEND_API_KEY);

// Every one of these emails is assembled as a raw HTML string, and several of
// the values interpolated into them are user-controlled. Anything
// interpolated into an html string below goes through this first — see
// src/lib/html.ts for why, and src/lib/__tests__ for the coverage.
const esc = escapeHtml;

interface TicketEmailArgs {
  to: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  tickets: { ticketTypeName: string; qrToken: string }[];
  // Optional: sign-in link into the organizer's community feed (see
  // src/lib/fulfillment.ts). Omitted from the email entirely when null —
  // e.g. if link generation failed, or the organizer has no posts yet.
  organizerName?: string | null;
  communityUrl?: string | null;
}

export async function sendTicketEmail(args: TicketEmailArgs) {
  const base = appUrl();

  const attachments = await Promise.all(
    args.tickets.map(async (t, i) => ({
      filename: `ticket-${i + 1}.png`,
      content: (await generateQrBuffer(t.qrToken)).toString("base64"),
    }))
  );

  // Each ticket rendered as a designed mini-ticket card (email-safe table
  // HTML) with a link out to the full web ticket at /t/{token}, which shows
  // the branded ticket + QR. QR PNGs stay attached as an offline fallback.
  const ticketCards = args.tickets
    .map(
      (t, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:separate;border:1px solid #e5e5ea;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:14px 20px;">
            <span style="color:#ffffff;font-weight:700;font-size:14px;">Ticket ${i + 1} · ${esc(t.ticketTypeName)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;background:#ffffff;">
            <p style="margin:0 0 12px;font-size:13px;color:#6e6e73;">
              Ref <span style="font-family:monospace;color:#1d1d1f;font-weight:600;">${t.qrToken.slice(0, 8).toUpperCase()}</span>
              &nbsp;·&nbsp; QR attached as ticket-${i + 1}.png
            </p>
            <a href="${base}/t/${t.qrToken}"
               style="display:inline-block;background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:999px;">
              View your ticket
            </a>
          </td>
        </tr>
      </table>`
    )
    .join("");

  const communitySection = args.communityUrl
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:separate;border:1px solid #e5e5ea;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;background:#ffffff;">
            <p style="margin:0 0 10px;font-size:13px;color:#1d1d1f;">
              Stay in the loop with ${esc(args.organizerName ?? "the organizer")}: updates, announcements, and more.
            </p>
            <a href="${esc(args.communityUrl)}"
               style="display:inline-block;background:#1d1d1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:999px;">
              See updates from ${esc(args.organizerName ?? "the organizer")}
            </a>
            <p style="margin:10px 0 0;font-size:11px;color:#a1a1a6;">No account or password needed, this link signs you in automatically.</p>
          </td>
        </tr>
      </table>`
    : "";

  // Resend's SDK does NOT throw on a rejected send — it resolves with
  // { data: null, error: {...} }. Checking `error` explicitly here is what
  // actually surfaces failures (e.g. sandbox mode rejecting an unverified
  // recipient) instead of silently pretending the email went out.
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: args.to,
    subject: `Your tickets for ${args.eventTitle}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:8px;background:#f5f5f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:28px 24px;">
              <p style="margin:0;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.04em;">ZIVOTIX</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">You're going to<br/>${esc(args.eventTitle)}</h1>
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.92);font-size:14px;">
                ${esc(args.eventDate)}<br/>${esc(args.venue)}
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px;font-size:14px;color:#1d1d1f;">Hi ${esc(args.buyerName)}, your order is confirmed. Here are your tickets.</p>

        ${ticketCards}

        ${communitySection}

        <p style="margin:16px 0 24px;font-size:12px;color:#6e6e73;">
          Show your QR code at the door. One scan per ticket. Keep this email, or open your ticket
          link on your phone.
        </p>
      </div>
    `,
    attachments,
  });

  if (error) {
    throw new Error(`Resend rejected the ticket email: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}

interface ContactMessageArgs {
  fromName: string;
  fromEmail: string;
  topic: string;
  orderRef?: string | null;
  message: string;
}

// Sent to the support inbox when someone submits /contact.
//
// `replyTo` is set to the sender so support can just hit reply — the `from`
// stays on our own verified domain, because Resend will reject (or worse,
// silently degrade the deliverability of) mail claiming to come from an
// address we don't control.
export async function sendContactMessageEmail(args: ContactMessageArgs) {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6e6e73;width:110px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:6px 0;font-size:13px;color:#1d1d1f;">${esc(value)}</td>
    </tr>`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: process.env.SUPPORT_EMAIL || "support@zivotix.site",
    replyTo: args.fromEmail,
    subject: `[${args.topic}] ${args.fromName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:8px;background:#f5f5f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:22px 24px;">
              <p style="margin:0;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.04em;">ZIVOTIX</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;line-height:1.3;">New contact form message</h1>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px;padding:16px 20px;margin:0 0 16px;">
          ${row("From", args.fromName)}
          ${row("Email", args.fromEmail)}
          ${row("Topic", args.topic)}
          ${args.orderRef ? row("Order ref", args.orderRef) : ""}
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px;padding:16px 20px;">
          <tr>
            <td style="font-size:14px;color:#1d1d1f;white-space:pre-wrap;">${esc(args.message)}</td>
          </tr>
        </table>

        <p style="margin:16px 0 24px;font-size:12px;color:#6e6e73;">Reply to this email to answer them directly.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend rejected the contact message: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}

interface ContactAckArgs {
  to: string;
  name: string;
}

// Confirmation to the person who wrote in, so they know it landed.
export async function sendContactAckEmail(args: ContactAckArgs) {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: args.to,
    subject: "We got your message",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:8px;background:#f5f5f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:26px 24px;">
              <p style="margin:0;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.04em;">ZIVOTIX</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Message received</h1>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 12px;font-size:14px;color:#1d1d1f;">
          Hi ${esc(args.name)}, thanks for writing in. A real person reads every message and we usually
          reply within one business day.
        </p>
        <p style="margin:0 0 24px;font-size:12px;color:#6e6e73;">
          If your event is happening in the next 24 hours, reply to this email with URGENT in the subject
          line and we'll push it to the front of the queue.
        </p>
      </div>
    `,
  });

  // A failed acknowledgement should never fail the request — the message that
  // matters already reached support. Log and move on.
  if (error) {
    console.error("Contact acknowledgement email failed:", error);
  }
}

interface DoorStaffInviteArgs {
  to: string;
  organizerName: string;
  eventTitle?: string | null;
  scanUrl: string;
}

// Sent whenever an organizer adds someone as door staff (for one event, or
// all of their events). scanUrl is a Supabase magic link that logs them
// straight into /scan on click — no password, no separate signup step.
export async function sendDoorStaffInviteEmail(args: DoorStaffInviteArgs) {
  // Plain-text version for the subject line, escaped version for the HTML body.
  const scope = args.eventTitle ? `for ${args.eventTitle}` : `for ${args.organizerName}'s events`;
  const scopeHtml = args.eventTitle
    ? `for ${esc(args.eventTitle)}`
    : `for ${esc(args.organizerName)}'s events`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: args.to,
    subject: `You've been added as door staff ${scope}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:8px;background:#f5f5f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:28px 24px;">
              <p style="margin:0;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.04em;">ZIVOTIX</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">You're on the door</h1>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 12px;font-size:14px;color:#1d1d1f;">
          ${esc(args.organizerName)} added you as door staff ${scopeHtml}. Use the link below to open the
          ticket scanner, scan each guest's QR code, and check them in at the entrance.
        </p>

        <a href="${esc(args.scanUrl)}"
           style="display:inline-block;margin:8px 0 20px;background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:999px;">
          Open ticket scanner
        </a>

        <p style="margin:0 0 24px;font-size:12px;color:#6e6e73;">
          No account or password needed, this link signs you in automatically. Just allow camera
          access once it opens, and you're ready to scan.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend rejected the door staff invite email: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}

interface CommunityAccessArgs {
  to: string;
  organizerName: string;
  communityUrl: string;
}

// Sent when a buyer's original magic link (from their ticket email) has
// expired and they ask for a fresh one via the "resend my link" form on the
// community page.
export async function sendCommunityAccessEmail(args: CommunityAccessArgs) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: args.to,
    subject: `Your link to ${args.organizerName}'s community`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:8px;background:#f5f5f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;padding:28px 24px;">
              <p style="margin:0;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.04em;">ZIVOTIX</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Here's your link back in</h1>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 12px;font-size:14px;color:#1d1d1f;">
          Use the button below to open ${esc(args.organizerName)}'s community updates.
        </p>

        <a href="${esc(args.communityUrl)}"
           style="display:inline-block;margin:8px 0 20px;background:linear-gradient(135deg,#facc15,#ca8a04);background-color:#eab308;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:999px;">
          See updates
        </a>

        <p style="margin:0 0 24px;font-size:12px;color:#6e6e73;">
          No account or password needed, this link signs you in automatically.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend rejected the community access email: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}
