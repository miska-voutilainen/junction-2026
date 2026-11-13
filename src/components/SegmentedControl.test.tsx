import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

afterEach(cleanup);

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
