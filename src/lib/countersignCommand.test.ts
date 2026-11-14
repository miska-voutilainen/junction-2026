import { expect, it } from "vitest";
import { countersignCommand } from "./countersignCommand";

it("writes the receipt CLI command for a change", () => {
  expect(countersignCommand("sign", "mp-2283")).toBe("pnpm countersign sign mp-2283");
});
