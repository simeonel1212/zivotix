import crypto from "node:crypto";
import QRCode from "qrcode";
import { appUrl } from "./app-url";

// Each ticket gets a random, unguessable token — this is what's encoded into
// the QR code and stored in tickets.qr_token. Door staff scan it and we look
// it up server-side; nothing about the ticket is decodable from the code
// itself, which avoids leaking event/ticket IDs.
export function generateTicketToken() {
  return crypto.randomBytes(24).toString("base64url");
}

// The QR encodes a URL the scan page's camera reader can parse directly:
// https://yourapp.com/api/scan?token=xxxx  (scan page extracts `token`)
export async function generateQrDataUrl(token: string) {
  const payload = `${appUrl()}/t/${token}`;
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 400 });
}

export async function generateQrBuffer(token: string) {
  const payload = `${appUrl()}/t/${token}`;
  return QRCode.toBuffer(payload, { errorCorrectionLevel: "M", margin: 1, width: 400 });
}
