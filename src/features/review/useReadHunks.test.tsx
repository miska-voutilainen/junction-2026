import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReadHunks } from "./useReadHunks";

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("useReadHunks", () => {
  it("marks and unmarks a hunk, and keeps the marks per change in sessionStorage", () => {
    const { result } = renderHook(() => useReadHunks("mp-2283"));
    expect(result.current.readIds.size).toBe(0);

    act(() => result.current.toggle("h3"));
    expect([...result.current.readIds]).toEqual(["h3"]);
    expect(window.sessionStorage.getItem("cs-read-hunks-mp-2283")).toBe('["h3"]');

    const other = renderHook(() => useReadHunks("mp-2129"));
    expect(other.result.current.readIds.size).toBe(0);

    act(() => result.current.toggle("h3"));
    expect(result.current.readIds.size).toBe(0);
  });

  it("starts empty when the stored value is not a list of ids", () => {
    window.sessionStorage.setItem("cs-read-hunks-mp-2283", "{broken");
    const { result } = renderHook(() => useReadHunks("mp-2283"));
    expect(result.current.readIds.size).toBe(0);
  });
});
