import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Console } from "./Console";
import { CopyButton } from "./CopyButton";
import { Disclosure } from "./Disclosure";
import { SegmentedControl } from "./SegmentedControl";

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

  it("toggles wrap, renames the button and remembers the choice", () => {
    const { unmount } = render(<Console label="Diff" text="x" kind="diff" />);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.getByRole("button", { name: "Unwrap lines" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("cs-wrap-diff")).toBe("true");
    unmount();

    render(<Console label="Other diff" text="y" kind="diff" />);
    expect(screen.getByRole("button", { name: "Unwrap lines" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("makes the scroll region a focusable, labelled region", () => {
    render(<Console label="Diff" text="x" kind="diff" />);
    const region = screen.getByRole("region", { name: "Diff" });
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("still toggles wrap when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Console label="Diff" text="x" kind="diff" />);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.getByRole("button", { name: "Unwrap lines" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("CopyButton", () => {
  it("announces Copied after copying", async () => {
    render(<CopyButton text="abc" label="Copy command" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy command" })));
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it("announces a failure when the clipboard refuses", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyButton text="abc" label="Copy command" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy command" })));
    expect(screen.getByRole("status").textContent).toBe("Copy failed");
  });
});

describe("Disclosure", () => {
  it("wires aria-expanded and aria-controls to the content", () => {
    render(<Disclosure title="Details">content</Disclosure>);
    const button = screen.getByRole("button", { name: "Details" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(button.getAttribute("aria-controls") ?? "")).not.toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("content")).toBeDefined();
  });
});

describe("SegmentedControl", () => {
  it("marks the selected segment with aria-pressed and reports a change", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Filter by tier"
        value="all"
        onChange={onChange}
        segments={[
          { value: "all", label: "All", count: 4 },
          { value: "full", label: "Full", count: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /All/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Full/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Full/ }));
    expect(onChange).toHaveBeenCalledWith("full");
  });
});
