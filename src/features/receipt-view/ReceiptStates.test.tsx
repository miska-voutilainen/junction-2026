import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidReceipt, NoReceipt } from "./ReceiptStates";

afterEach(cleanup);

describe("NoReceipt", () => {
  it("names the change, shows the sign command and links back to the review", () => {
    render(<NoReceipt changeId="mp-2234" signCommand="pnpm countersign sign mp-2234" />);
    expect(screen.getByRole("heading", { name: "No receipt for mp-2234 yet." })).toBeTruthy();
    expect(screen.getByText("pnpm countersign sign mp-2234")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the review" }).getAttribute("href")).toBe(
      "/changes/mp-2234",
    );
  });
});

describe("InvalidReceipt", () => {
  it("names the file and prints its validation error", () => {
    render(<InvalidReceipt changeId="mp-2283" error="owner: Required" />);
    expect(screen.getByText("data/receipts/mp-2283.json")).toBeTruthy();
    expect(screen.getByText("owner: Required")).toBeTruthy();
  });
});
