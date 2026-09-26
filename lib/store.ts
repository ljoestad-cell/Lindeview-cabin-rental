import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Prices } from "@/lib/pricing";
import type { AdminAccount, BlockedRange, Booking } from "@/lib/types";

export interface BookingStore {
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  createBooking(booking: Booking): Promise<Booking>;
  updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null>;
  deleteBooking(id: string): Promise<void>;

  listBlockedRanges(): Promise<BlockedRange[]>;
  createBlockedRange(range: BlockedRange): Promise<BlockedRange>;
  deleteBlockedRange(id: string): Promise<void>;

  /** Singleton – én eier, ingen flerbrukerstøtte. */
  getAdminAccount(): Promise<AdminAccount | null>;
  setAdminAccount(account: AdminAccount): Promise<AdminAccount>;

  /** Priser lagret fra /admin/priser – null til eieren har lagret noe (da gjelder DEFAULT_PRICES). */
  getPrices(): Promise<Partial<Prices> | null>;
  setPrices(prices: Prices): Promise<Prices>;
}

const REDIS_BOOKINGS_KEY = "lindeview:bookings";
const REDIS_BLOCKED_KEY = "lindeview:blocked";
const REDIS_ADMIN_ACCOUNT_KEY = "lindeview:admin-account";
const REDIS_PRICES_KEY = "lindeview:prices";

/**
 * Produksjonslager: Upstash Redis (Vercel KV). Alle bookinger/blokkeringer
 * ligger som JSON-felt i egne Redis-hasher – lite volum (én hytte, noen
 * titalls bookinger i året), så det er ikke behov for mer enn dette.
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
    const map = (await this.redis.hgetall<Record<string, Booking>>(REDIS_BOOKINGS_KEY)) ?? {};
    return Object.values(map);
  }

  async getBooking(id: string): Promise<Booking | null> {
    const booking = await this.redis.hget<Booking>(REDIS_BOOKINGS_KEY, id);
    return booking ?? null;
  }

  async createBooking(booking: Booking): Promise<Booking> {
    await this.redis.hset(REDIS_BOOKINGS_KEY, { [booking.id]: booking });
    return booking;
  }

  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null> {
    const existing = await this.getBooking(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await this.redis.hset(REDIS_BOOKINGS_KEY, { [id]: updated });
    return updated;
  }

  async deleteBooking(id: string): Promise<void> {
    await this.redis.hdel(REDIS_BOOKINGS_KEY, id);
  }

  async listBlockedRanges(): Promise<BlockedRange[]> {
    const map = (await this.redis.hgetall<Record<string, BlockedRange>>(REDIS_BLOCKED_KEY)) ?? {};
    return Object.values(map);
  }

  async createBlockedRange(range: BlockedRange): Promise<BlockedRange> {
    await this.redis.hset(REDIS_BLOCKED_KEY, { [range.id]: range });
    return range;
  }

  async deleteBlockedRange(id: string): Promise<void> {
    await this.redis.hdel(REDIS_BLOCKED_KEY, id);
  }

  async getAdminAccount(): Promise<AdminAccount | null> {
    return (await this.redis.get<AdminAccount>(REDIS_ADMIN_ACCOUNT_KEY)) ?? null;
  }

  async setAdminAccount(account: AdminAccount): Promise<AdminAccount> {
    await this.redis.set(REDIS_ADMIN_ACCOUNT_KEY, account);
    return account;
  }

  async getPrices(): Promise<Partial<Prices> | null> {
    return (await this.redis.get<Partial<Prices>>(REDIS_PRICES_KEY)) ?? null;
  }

  async setPrices(prices: Prices): Promise<Prices> {
    await this.redis.set(REDIS_PRICES_KEY, prices);
    return prices;
  }
}

/**
 * Utviklingslager: lokale JSON-filer. Overlever ikke en ny deploy i
 * produksjon (Vercel-serverless har ikke varig filsystem), men er nok til
 * `npm run dev`. Filene ligger i `.data/` som er gitignored.
 */
class FileStore implements BookingStore {
  private bookingsPath = path.join(process.cwd(), ".data", "bookings.json");
  private blockedPath = path.join(process.cwd(), ".data", "blocked.json");
  private adminAccountPath = path.join(process.cwd(), ".data", "admin-account.json");
  private pricesPath = path.join(process.cwd(), ".data", "prices.json");

  private async readAll<T>(filePath: string): Promise<Record<string, T>> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as Record<string, T>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll<T>(filePath: string, map: Record<string, T>): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(map, null, 2), "utf-8");
  }

  async listBookings(): Promise<Booking[]> {
    return Object.values(await this.readAll<Booking>(this.bookingsPath));
  }

  async getBooking(id: string): Promise<Booking | null> {
    const map = await this.readAll<Booking>(this.bookingsPath);
    return map[id] ?? null;
  }

  async createBooking(booking: Booking): Promise<Booking> {
    const map = await this.readAll<Booking>(this.bookingsPath);
    map[booking.id] = booking;
    await this.writeAll(this.bookingsPath, map);
    return booking;
  }

  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking | null> {
    const map = await this.readAll<Booking>(this.bookingsPath);
    const existing = map[id];
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    map[id] = updated;
    await this.writeAll(this.bookingsPath, map);
    return updated;
  }

  async deleteBooking(id: string): Promise<void> {
    const map = await this.readAll<Booking>(this.bookingsPath);
    delete map[id];
    await this.writeAll(this.bookingsPath, map);
  }

  async listBlockedRanges(): Promise<BlockedRange[]> {
    return Object.values(await this.readAll<BlockedRange>(this.blockedPath));
  }

  async createBlockedRange(range: BlockedRange): Promise<BlockedRange> {
    const map = await this.readAll<BlockedRange>(this.blockedPath);
    map[range.id] = range;
    await this.writeAll(this.blockedPath, map);
    return range;
  }

  async deleteBlockedRange(id: string): Promise<void> {
    const map = await this.readAll<BlockedRange>(this.blockedPath);
    delete map[id];
    await this.writeAll(this.blockedPath, map);
  }

  async getAdminAccount(): Promise<AdminAccount | null> {
    try {
      const raw = await fs.readFile(this.adminAccountPath, "utf-8");
      return JSON.parse(raw) as AdminAccount;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async setAdminAccount(account: AdminAccount): Promise<AdminAccount> {
    await fs.mkdir(path.dirname(this.adminAccountPath), { recursive: true });
    await fs.writeFile(this.adminAccountPath, JSON.stringify(account, null, 2), "utf-8");
    return account;
  }

  async getPrices(): Promise<Partial<Prices> | null> {
    try {
      const raw = await fs.readFile(this.pricesPath, "utf-8");
      return JSON.parse(raw) as Partial<Prices>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async setPrices(prices: Prices): Promise<Prices> {
    await fs.mkdir(path.dirname(this.pricesPath), { recursive: true });
    await fs.writeFile(this.pricesPath, JSON.stringify(prices, null, 2), "utf-8");
    return prices;
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
