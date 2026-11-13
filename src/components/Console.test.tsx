import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Console } from "./Console";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Console", () => {
  it("copies the raw text, not the rendered content", async () => {
    render(
      <Console label="Diff" text="+ int x = 1;" kind="diff">
        <mark>highlighted</mark>
      </Console>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy Diff" })));
    expect(writeText).toHaveBeenCalledWith("+ int x = 1;");
  });

  it("keeps the Wrap button's name, toggles aria-pressed and remembers the choice", () => {
    const { unmount } = render(<Console label="Diff" text="x" kind="diff" />);
    const wrap = screen.getByRole("button", { name: "Wrap lines" });
    expect(wrap.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(wrap);
    expect(screen.getByRole("button", { name: "Wrap lines" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("cs-wrap-diff")).toBe("true");
    unmount();

    render(<Console label="Other diff" text="y" kind="diff" />);
    expect(screen.getByRole("button", { name: "Wrap lines" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is a focusable, labelled region only while it scrolls sideways", () => {
    render(<Console label="Diff" text="x" kind="diff" />);
    expect(screen.getByRole("region", { name: "Diff" }).getAttribute("tabindex")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("toggles wrap and keeps the choice when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Console label="Diff" text="x" kind="diff" />);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.getByRole("button", { name: "Wrap lines" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("prefers the unsaved choice over a stale stored one when the write fails", () => {
    window.localStorage.setItem("cs-wrap-log", "false");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(<Console label="Log" text="x" kind="log" />);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.getByRole("button", { name: "Wrap lines" }).getAttribute("aria-pressed")).toBe("true");
  });
});
