export type UserRole = "admin" | "organizer" | "door_staff" | "buyer";
/**
 * ISO 3166-1 alpha-2. Was a union of "NG" | "TH" while the database column was
 * an enum of those two; organizers can now sign up from anywhere, with payouts
 * by Paystack transfer or international wire depending on the country. Validated
 * against lib/countries.ts rather than by the type system, since the real list
 * is ~250 entries and changes over time.
 */
export type OrgCountry = string;
export type EventStatus = "draft" | "published" | "cancelled";
export type OrderStatus = "pending" | "paid" | "failed" | "refunded" | "expired";
export type TicketStatus = "valid" | "used" | "void";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
}

// NG: verified via Paystack (bank_code + recipient_code enable automatic transfer).
// TH: manual wire — swift/account entered as-is, no automated payout possible.
export interface BankAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code?: string; // NG only
  recipient_code?: string; // NG only — cached after first successful Paystack transfer recipient creation
  swift?: string; // TH only
}

export interface Organizer {
  id: string;
  profile_id: string;
  business_name: string;
  country: OrgCountry;
  payout_currency: string;
  commission_rate: number;
  is_platform_own: boolean;
  is_verified: boolean;
  bank_account: BankAccount | null;
  created_at: string;
}

// Custom link an organizer attaches to their event page, e.g.
// { label: "Chat on WhatsApp", url: "https://wa.me/..." }
export interface EventLink {
  label: string;
  url: string;
}

export interface EventRow {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: OrgCountry;
  currency: string;
  cover_image_url: string | null;
  logo_image_url: string | null;
  gallery_image_urls: string[];
  links: EventLink[];
  category: string;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  is_unlisted: boolean;
  /** When true, the service fee comes out of the ticket price rather than being added on top. */
  absorb_service_fee: boolean;
  /** When false, membership passes aren't valid here and holders must buy a ticket. */
  members_included: boolean;
  created_at: string;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price: number;
  quantity_total: number;
  quantity_sold: number;
  max_per_order: number;
  sales_start: string | null;
  sales_end: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  event_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_country: string | null;
  base_currency: string;
  /** What the organizer is owed, in base_currency. Payouts sum this. */
  base_amount: number;
  /** Zivotix's 5% service fee, in base_currency. Platform revenue. */
  service_fee: number;
  charge_currency: string;
  charge_amount: number;
  fx_rate_used: number | null;
  paystack_reference: string | null;
  status: OrderStatus;
  created_at: string;
  payment_provider: "paystack" | "flutterwave";
  provider_charge_id: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_type_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Ticket {
  id: string;
  order_item_id: string;
  event_id: string;
  ticket_type_id: string;
  qr_token: string;
  attendee_name: string | null;
  status: TicketStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
}

export interface OrganizerPost {
  id: string;
  organizer_id: string;
  body: string;
  image_urls: string[];
  created_at: string;
}

export type ReactionType = "like" | "dislike";

export interface PostReaction {
  id: string;
  post_id: string;
  profile_id: string;
  reaction: ReactionType;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
}

export interface Payout {
  id: string;
  organizer_id: string;
  event_id: string | null;
  period_start: string;
  period_end: string;
  gross_sales: number;
  platform_fee: number;
  net_payable: number;
  processor_fee_estimate: number | null;
  currency: string;
  fx_rate_used: number | null;
  status: PayoutStatus;
  reference: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- memberships
// A pass sells N event credits up front. The holder spends one credit per
// event, at any event that organizer runs while the pass is valid.

export interface MembershipTier {
  id: string;
  organizer_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  /** How many events the pass admits. 1–12. */
  event_credits: number;
  /** How long the credits stay usable, from purchase. */
  validity_days: number;
  is_active: boolean;
  created_at: string;
}

export type MembershipStatus = "active" | "expired" | "cancelled" | "refunded";

export interface Membership {
  id: string;
  tier_id: string;
  organizer_id: string;
  member_name: string;
  member_email: string;
  qr_token: string;
  credits_total: number;
  credits_used: number;
  starts_at: string;
  expires_at: string;
  status: MembershipStatus;
  reference: string | null;
  base_currency: string;
  base_amount: number;
  service_fee: number;
  charge_currency: string;
  charge_amount: number;
  fx_rate_used: number | null;
  paid_at: string | null;
  /** Set once this membership's revenue has been included in a payout. */
  payout_id: string | null;
  created_at: string;
}

export interface MembershipCheckIn {
  id: string;
  membership_id: string;
  event_id: string;
  checked_in_at: string;
  checked_in_by: string | null;
}
