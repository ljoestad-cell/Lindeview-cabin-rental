import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  currentStep,
  findRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "@/lib/totp";

// RFC 6238, vedlegg B: SHA-1-hemmeligheten "12345678901234567890" (ASCII).
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("koder RFC-hemmeligheten som forventet og tilbake", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
  });

  it("tåler mellomrom og små bokstaver (manuell inntasting)", () => {
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").toString()).toBe("12345678901234567890");
  });
});

describe("totpCode", () => {
  // Siste 6 sifre av RFC-ens 8-sifrede testverdier.
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("gir riktig kode ved T=%i", (seconds, expected) => {
    expect(totpCode(RFC_SECRET, currentStep(seconds * 1000))).toBe(expected);
  });
});

describe("verifyTotp", () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  const step = currentStep(now);

  it("godtar gjeldende kode og returnerer steget", () => {
    expect(verifyTotp(secret, totpCode(secret, step), null, now)).toBe(step);
  });

  it("godtar ett steg klokkeavvik, men ikke to", () => {
    expect(verifyTotp(secret, totpCode(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), null, now)).toBeNull();
  });

  it("avviser en kode som allerede er brukt", () => {
    const code = totpCode(secret, step);
    expect(verifyTotp(secret, code, step, now)).toBeNull();
  });

  it("tåler mellomrom og avviser feil format", () => {
    const code = totpCode(secret, step);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, now)).toBe(step);
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, now)).toBeNull();
  });
});

describe("otpauthUri", () => {
  it("har utsteder, konto og hemmelighet appen trenger", () => {
    const uri = otpauthUri("ABC234", "Lindeview", "eier@example.com");
    expect(uri.startsWith("otpauth://totp/Lindeview%3Aeier%40example.com?")).toBe(true);
    const params = new URL(uri).searchParams;
    expect(params.get("secret")).toBe("ABC234");
    expect(params.get("issuer")).toBe("Lindeview");
    expect(params.get("digits")).toBe("6");
  });
});

describe("reservekoder", () => {
  const codes = generateRecoveryCodes();
  const hashes = codes.map(hashRecoveryCode);

  it("lager 10 unike koder på formen abcd-efgh", () => {
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
  });

  it("finner koden uavhengig av store bokstaver, bindestrek og mellomrom", () => {
    const code = codes[3];
    expect(findRecoveryCode(code, hashes)).toBe(3);
    expect(findRecoveryCode(code.toUpperCase(), hashes)).toBe(3);
    expect(findRecoveryCode(code.replace("-", " "), hashes)).toBe(3);
  });

  it("avviser ukjente og tomme koder", () => {
    expect(findRecoveryCode("zzzz-zzzz", hashes)).toBe(-1);
    expect(findRecoveryCode("", hashes)).toBe(-1);
  });
});
