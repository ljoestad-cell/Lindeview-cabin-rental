import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Booking } from "@/lib/types";

export interface BookingStore {
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  createBooking(booking: Booking): Promise<Booking>;
  updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null>;
  deleteBooking(id: string): Promise<void>;
}

const REDIS_KEY = "lindeview:bookings";

/**
 * Produksjonslager: Upstash Redis (Vercel KV). Alle bookinger ligger som ett
 * JSON-felt i en Redis-hash – lite volum (én hytte, noen titalls bookinger i
 * året), så det er ikke behov for mer enn dette.
 */
class RedisStore implements BookingStore {
  private redis: Redis;

  constructor() {
    // Vercel KV og Upstash bruker ulike variabelnavn avhengig av hvordan
    // integrasjonen ble satt opp – støtt begge i stedet for å anta ett sett.
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("RedisStore krever KV_REST_API_URL/TOKEN eller UPSTASH_REDIS_REST_URL/TOKEN.");
    }
    this.redis = new Redis({ url, token });
  }

  async listBookings(): Promise<Booking[]> {
    const map = (await this.redis.hgetall<Record<string, Booking>>(REDIS_KEY)) ?? {};
    return Object.values(map);
  }

  async getBooking(id: string): Promise<Booking | null> {
    const booking = await this.redis.hget<Booking>(REDIS_KEY, id);
    return booking ?? null;
  }

  async createBooking(booking: Booking): Promise<Booking> {
    await this.redis.hset(REDIS_KEY, { [booking.id]: booking });
    return booking;
  }

  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null> {
    const existing = await this.getBooking(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await this.redis.hset(REDIS_KEY, { [id]: updated });
    return updated;
  }

  async deleteBooking(id: string): Promise<void> {
    await this.redis.hdel(REDIS_KEY, id);
  }
}

/**
 * Utviklingslager: lokal JSON-fil. Overlever ikke en ny deploy i produksjon
 * (Vercel-serverless har ikke varig filsystem), men er nok til `npm run dev`.
 * Filen ligger i `.data/` som er gitignored.
 */
class FileStore implements BookingStore {
  private filePath = path.join(process.cwd(), ".data", "bookings.json");

  private async readAll(): Promise<Record<string, Booking>> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as Record<string, Booking>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll(map: Record<string, Booking>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(map, null, 2), "utf-8");
  }

  async listBookings(): Promise<Booking[]> {
    return Object.values(await this.readAll());
  }

  async getBooking(id: string): Promise<Booking | null> {
    const map = await this.readAll();
    return map[id] ?? null;
  }

  async createBooking(booking: Booking): Promise<Booking> {
    const map = await this.readAll();
    map[booking.id] = booking;
    await this.writeAll(map);
    return booking;
  }

  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null> {
    const map = await this.readAll();
    const existing = map[id];
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    map[id] = updated;
    await this.writeAll(map);
    return updated;
  }

  async deleteBooking(id: string): Promise<void> {
    const map = await this.readAll();
    delete map[id];
    await this.writeAll(map);
  }
}

function hasRedisEnv(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

let store: BookingStore | null = null;

/** Velger backend første gang den trengs, og gjenbruker den etterpå. */
export function getStore(): BookingStore {
  if (store) return store;
  if (hasRedisEnv()) {
    console.info("[booking-store] Bruker Upstash Redis.");
    store = new RedisStore();
  } else {
    console.info(
      "[booking-store] Ingen KV_REST_API_URL/KV_REST_API_TOKEN funnet – bruker lokal fil (.data/bookings.json). Sett opp Vercel KV før du går i produksjon.",
    );
    store = new FileStore();
  }
  return store;
}
