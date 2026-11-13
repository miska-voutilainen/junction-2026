import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(cleanup);

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

  it("shows a visible alert icon, not only an announcement, when copying fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { container } = render(<CopyButton text="abc" label="Copy command" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy command" })));
    expect(container.querySelector("svg.lucide-circle-alert")).not.toBeNull();
  });
});
