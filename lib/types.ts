import type { Quote } from "@/lib/pricing";

export type BookingStatus = "pending" | "confirmed" | "declined";

/** Betaling kobles på senere – feltet finnes allerede så modellen er klar. */
export type PaymentStatus = "not_configured" | "pending" | "paid";

export type Booking = {
  id: string;
  createdAt: string; // ISO timestamp
  status: BookingStatus;
  checkIn: string; // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD"
  nights: number;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  pricing: Quote;
  paymentStatus: PaymentStatus;
  /** Id på hendelsen i Google Calendar, når kalenderkobling er satt opp. */
  calendarEventId: string | null;
};

/** Felter en gjest sender inn – resten fylles/regnes på serveren. */
export type BookingRequestInput = {
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
};
