import { describe, expect, it } from "vitest";
import { hashPassword, newSecret, sameUser, signSession, verifyPassword, verifySession } from "../auth-core";

describe("password hash", () => {
  it("verifies the right password only; the hash doesn't contain it", () => {
    const h = hashPassword("Test@pass1");
    expect(h).toMatch(/^scrypt:16384:8:1:/);
    expect(h).not.toContain("Test@pass1");
    expect(verifyPassword("Test@pass1", h)).toBe(true);
    expect(verifyPassword("test@pass1", h)).toBe(false);
    expect(verifyPassword("", h)).toBe(false);
  });

  it("salts each hash; rejects malformed hashes", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "bcrypt:abc")).toBe(false);
  });
});

describe("session token", () => {
  const secret = newSecret();
  const now = 1_800_000_000_000;

  it("round-trips the user until it expires", () => {
    const t = signSession("Shubham", secret, 1000, now);
    expect(verifySession(t, secret, now)).toBe("Shubham");
    expect(verifySession(t, secret, now + 999)).toBe("Shubham");
    expect(verifySession(t, secret, now + 1000)).toBeNull();
  });

  it("rejects tampering, another secret, and missing values", () => {
    const t = signSession("Shubham", secret, 60_000, now);
    const [u, exp, sig] = t.split(".");
    expect(verifySession(`${u}.${Number(exp) + 1e9}.${sig}`, secret, now)).toBeNull();
    expect(verifySession(`${Buffer.from("admin").toString("base64url")}.${exp}.${sig}`, secret, now)).toBeNull();
    expect(verifySession(t, newSecret(), now)).toBeNull();
    expect(verifySession(t, undefined, now)).toBeNull();
    expect(verifySession(undefined, secret, now)).toBeNull();
    expect(verifySession("garbage", secret, now)).toBeNull();
  });

  it("usernames ignore case and spaces", () => {
    expect(sameUser(" shubham ", "Shubham")).toBe(true);
    expect(sameUser("shubham2", "Shubham")).toBe(false);
  });
});
