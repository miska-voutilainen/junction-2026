import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageKey = "countersign.escapes.v1";

// The store keeps module-level state, so each test imports a fresh copy.
async function freshUseEscapes() {
  vi.resetModules();
  return (await import("./escapes")).useEscapes;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useEscapes", () => {
  it("starts empty", async () => {
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    expect(result.current.escapes).toEqual({});
    expect(result.current.total).toBe(0);
  });

  it("records escapes per area and sums them", async () => {
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.record("generator"));
    act(() => result.current.record("generator"));
    act(() => result.current.record("security"));
    expect(result.current.escapes).toEqual({ generator: 2, security: 1 });
    expect(result.current.total).toBe(3);
  });

  it("undoes one escape in an area and removes the area at zero", async () => {
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.record("security"));
    act(() => result.current.record("security"));
    act(() => result.current.record("analyzer"));
    act(() => result.current.undo("security"));
    expect(result.current.escapes).toEqual({ security: 1, analyzer: 1 });
    act(() => result.current.undo("security"));
    expect(result.current.escapes).toEqual({ analyzer: 1 });
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "null")).toEqual({ analyzer: 1 });
  });

  it("ignores an undo in an area with no escape", async () => {
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.undo("generator"));
    expect(result.current.total).toBe(0);
  });

  it("shares one state between components and clears it on reset", async () => {
    const useEscapes = await freshUseEscapes();
    const first = renderHook(() => useEscapes());
    const second = renderHook(() => useEscapes());
    act(() => first.result.current.record("analyzer"));
    expect(second.result.current.escapes).toEqual({ analyzer: 1 });
    act(() => second.result.current.reset());
    expect(first.result.current.total).toBe(0);
  });

  it("persists to localStorage and restores after a reload", async () => {
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.record("analyzer"));
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "null")).toEqual({ analyzer: 1 });

    const reloaded = await freshUseEscapes();
    const { result: afterReload } = renderHook(() => reloaded());
    expect(afterReload.current.escapes).toEqual({ analyzer: 1 });
  });

  it("starts empty when the stored value is corrupt", async () => {
    window.localStorage.setItem(storageKey, "{ not json");
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    expect(result.current.escapes).toEqual({});
  });

  it("starts empty when the stored value has the wrong shape", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ generator: -3, nonsense: 1 }));
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    expect(result.current.escapes).toEqual({});
  });

  it("still works for the page view when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const useEscapes = await freshUseEscapes();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.record("security"));
    expect(result.current.escapes).toEqual({ security: 1 });
  });
});

describe("re-routed changes for the inbox highlight", () => {
  async function freshStore() {
    vi.resetModules();
    return import("./escapes");
  }

  it("adds up across escapes and is handed over once", async () => {
    const { markRerouted, takeRerouted } = await freshStore();
    markRerouted(["mp-2283"]);
    markRerouted(["mp-2283", "mp-2129"]);
    expect(takeRerouted()).toEqual(["mp-2283", "mp-2129"]);
    expect(takeRerouted()).toEqual([]);
  });

  it("is dropped by undo and by reset", async () => {
    const { markRerouted, takeRerouted, useEscapes } = await freshStore();
    const { result } = renderHook(() => useEscapes());
    act(() => result.current.record("generator"));
    markRerouted(["mp-2283"]);
    act(() => result.current.undo("generator"));
    expect(takeRerouted()).toEqual([]);

    markRerouted(["mp-2283"]);
    act(() => result.current.reset());
    expect(takeRerouted()).toEqual([]);
  });
});
