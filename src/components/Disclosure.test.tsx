import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Disclosure } from "./Disclosure";

const motionState = vi.hoisted(() => ({ isReduced: false }));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motionState.isReduced,
}));

afterEach(() => {
  cleanup();
  motionState.isReduced = false;
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

  it("under reduced motion shows the content fully open, with no clip or fade, and hides it at once", async () => {
    motionState.isReduced = true;
    render(<Disclosure title="Details">content</Disclosure>);
    const button = screen.getByRole("button", { name: "Details" });

    fireEvent.click(button);
    const content = screen.getByText("content");
    expect(content.style.opacity).toBe("1");
    expect(content.style.clipPath).not.toContain("100%");

    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText("content")).toBeNull(), { timeout: 100 });
  });
});
