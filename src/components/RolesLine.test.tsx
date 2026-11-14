import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RolesLine } from "./RolesLine";

afterEach(cleanup);

describe("RolesLine", () => {
  it("names the author, the reviewer version and the signer, with the idea 8 label", () => {
    const { container, getByRole } = render(<RolesLine authorAgent="Coding agent (Tieto sample)" reviewerVersion="rv1" owner="miska-voutilainen" />);
    expect(container.textContent).toContain("Written by Coding agent (Tieto sample) · Reviewed by rv1 · Signed by miska-voutilainen");
    expect(getByRole("link", { name: /^Idea 8 · / })).toBeTruthy();
  });

  it("says Not signed yet while there is no receipt", () => {
    const { container } = render(<RolesLine authorAgent="Coding agent (Tieto sample)" reviewerVersion="rv1" owner={undefined} />);
    expect(container.textContent).toContain("Reviewed by rv1 · Not signed yet");
    expect(container.textContent).not.toContain("Signed by");
  });
});
