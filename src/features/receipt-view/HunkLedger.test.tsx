import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HunkLedger } from "./HunkLedger";

afterEach(cleanup);

const rows = [{ hunkId: "h1", file: "src/A.cs", coverage: "read" as const, readBy: "miska-voutilainen" }];

describe("HunkLedger", () => {
  it("says the signature covers the ledger when the receipt is signed", () => {
    render(<HunkLedger rows={rows} owner="miska-voutilainen" status="signed" />);
    expect(screen.getByText("Hunk ledger · signed")).toBeTruthy();
    expect(screen.getByText(/the signature covers which hunks miska-voutilainen read/)).toBeTruthy();
  });

  it("says the signature failed, and drops \"signed\", when verification failed", () => {
    render(<HunkLedger rows={rows} owner="miska-voutilainen" status="unverified" />);
    expect(screen.getByText("Hunk ledger")).toBeTruthy();
    expect(screen.getByText("The signature over this ledger failed verification.")).toBeTruthy();
  });
});
