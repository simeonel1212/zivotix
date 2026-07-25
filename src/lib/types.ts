export type UserRole = "admin" | "organizer" | "door_staff" | "buyer";
export type OrgCountry = "NG" | "TH";
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
  base_amount: number;
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
