import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RolesLine } from "./RolesLine";

afterEach(cleanup);

const author = "Coding agent (Tieto sample)";

describe("RolesLine", () => {
  it("names the author, the reviewer version and the signer, with the idea 8 label", () => {
    const { container, getByRole } = render(
      <RolesLine
        authorAgent={author}
        reviewerVersion="rv1"
        signer={{ kind: "signed", owner: "miska-voutilainen" }}
      />,
    );
    expect(container.textContent).toContain(`Written by ${author}`);
    expect(container.textContent).toContain("Reviewed by rv1");
    expect(container.textContent).toContain("Signed by miska-voutilainen");
    expect(
      getByRole("link", { name: "Idea 8: Separation of duties, opens the idea page" }),
    ).toBeTruthy();
  });

  it.each([
    [{ kind: "unsigned" }, "Not signed yet"],
    [{ kind: "unreadable" }, "Receipt couldn't be read"],
    [{ kind: "unverified" }, "Signature failed verification"],
  ] as const)("never says Signed by when the signer is %j", (signer, words) => {
    const { container } = render(
      <RolesLine authorAgent={author} reviewerVersion="rv1" signer={signer} />,
    );
    expect(container.textContent).toContain(words);
    expect(container.textContent).not.toContain("Signed by");
  });

  it("leaves the reviewer out when no review is readable but keeps the author", () => {
    const { container } = render(
      <RolesLine authorAgent={author} reviewerVersion={null} signer={{ kind: "unsigned" }} />,
    );
    expect(container.textContent).toContain(`Written by ${author}`);
    expect(container.textContent).not.toContain("Reviewed by");
  });
});
