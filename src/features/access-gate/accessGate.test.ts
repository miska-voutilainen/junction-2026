// @vitest-environment node
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_COOKIE,
  accessCookieValue,
  accessGate,
  readAccessCode,
  safeNextPath,
} from "./accessGate";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function requestFor(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `${ACCESS_COOKIE}=${cookie}` } : {},
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("readAccessCode", () => {
  it("is null when the code is unset, empty or blank (gate off)", () => {
    expect(readAccessCode({})).toBeNull();
    expect(readAccessCode({ ACCESS_CODE: "" })).toBeNull();
    expect(readAccessCode({ ACCESS_CODE: "  " })).toBeNull();
  });

  it("returns the trimmed code otherwise", () => {
    expect(readAccessCode({ ACCESS_CODE: " 8888 " })).toBe("8888");
  });
});

describe("accessCookieValue", () => {
  it("is the sha256 hex of the code", async () => {
    expect(await accessCookieValue("8888")).toBe(sha256("8888"));
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/reviewer?x=1")).toBe("/reviewer?x=1");
  });

  it.each(["//evil.com", "/\\evil", "https://x", "/unlock", "/unlock?next=%2F", "", null, undefined])(
    "falls back to / for %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});

describe("accessGate", () => {
  it("passes every request through when the gate is off", async () => {
    vi.stubEnv("ACCESS_CODE", "");
    const response = await accessGate(requestFor("/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects to /unlock with the original path when there is no cookie", async () => {
    vi.stubEnv("ACCESS_CODE", "8888");
    const response = await accessGate(requestFor("/changes/mp-2283"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/unlock?next=%2Fchanges%2Fmp-2283",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("redirects when the cookie belongs to another code", async () => {
    vi.stubEnv("ACCESS_CODE", "8888");
    const response = await accessGate(requestFor("/", sha256("1234")));
    expect(response.status).toBe(307);
  });

  it("passes through with noindex when the cookie matches", async () => {
    vi.stubEnv("ACCESS_CODE", "8888");
    const response = await accessGate(requestFor("/", sha256("8888")));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });
});
