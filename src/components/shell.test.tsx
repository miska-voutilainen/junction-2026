import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "./AppNav";
import { CommandMenu, CommandMenuProvider } from "./CommandMenu";
import type { ShellChange } from "./ShellChange";
import { TopBar } from "./TopBar";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

const changes: ShellChange[] = [
  { id: "mp-2283", title: "Reject oversized extension payloads", requirementId: "REQ-12", tierLabel: "Focused", statusLabel: "needs review", needsReview: true },
  { id: "mp-2301", title: "Cache the resolver lookup", requirementId: "REQ-14", tierLabel: "Light", statusLabel: "signed", needsReview: false },
];

beforeEach(() => {
  navigation.pathname = "/";
  navigation.push.mockReset();
  // cmdk measures and scrolls rows; jsdom has neither.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function renderShell() {
  return render(
    <CommandMenuProvider>
      <TopBar repo="owner/repo" needsReviewCount={1} />
      <CommandMenu changes={changes} />
      <input aria-label="Notes" />
    </CommandMenuProvider>,
  );
}

describe("AppNav", () => {
  it("marks only the current page", () => {
    navigation.pathname = "/changes/mp-2283";
    render(<AppNav needsReviewCount={2} />);
    expect(screen.getByRole("link", { name: /Inbox/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("shows the number of changes that need review on Inbox", () => {
    render(<AppNav needsReviewCount={3} />);
    expect(screen.getByLabelText("3 need review").textContent).toBe("3");
  });
});

describe("CommandMenu", () => {
  it("opens on Ctrl+K and returns focus to the search button on Esc", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole("button", { name: "Search and quick actions" });
    trigger.focus();

    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog")).toBeTruthy();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("says what to try when nothing matches", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Search and quick actions" }));
    await user.type(await screen.findByRole("combobox"), "zzzz");
    expect(await screen.findByText(/No match for “zzzz”\. Try a change id, a requirement or a page\./)).toBeTruthy();
  });

  it("copies the raw sign command for the next change and announces it", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard; watch that one.
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderShell();
    await user.click(screen.getByRole("button", { name: "Search and quick actions" }));
    await user.click(await screen.findByText("Copy sign command"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith("pnpm countersign sign mp-2283");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
  });

  it("opens the next change that needs review", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Search and quick actions" }));
    await user.click(await screen.findByText("Review next change"));
    expect(navigation.push).toHaveBeenCalledWith("/changes/mp-2283");
  });
});

describe("shortcuts", () => {
  it("N opens the next change, and g then i goes to the inbox", () => {
    renderShell();
    fireEvent.keyDown(window, { key: "n" });
    expect(navigation.push).toHaveBeenCalledWith("/changes/mp-2283");
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "i" });
    expect(navigation.push).toHaveBeenCalledWith("/");
  });

  it("ignores letters typed into a field", () => {
    renderShell();
    const field = screen.getByLabelText("Notes");
    act(() => field.focus());
    fireEvent.keyDown(field, { key: "n" });
    fireEvent.keyDown(field, { key: "g" });
    fireEvent.keyDown(field, { key: "i" });
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
