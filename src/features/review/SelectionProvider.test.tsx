import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { SelectionProvider, useSelection } from "./SelectionProvider";

const citation = { file: "a.cs", side: "new" as const, startLine: 3, endLine: 4, quote: "x" };
const wrapper = ({ children }: { children: ReactNode }) => (
  <SelectionProvider>{children}</SelectionProvider>
);

describe("selection", () => {
  it("carries the focused citation with the selection", () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    act(() => result.current.setSelectedClaimId("c1", citation));
    expect(result.current.selectedClaimId).toBe("c1");
    expect(result.current.selection?.focus).toBe(citation);
  });

  it("selects a new object on every press, so the same citation scrolls again", () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    act(() => result.current.setSelectedClaimId("c1", citation));
    const first = result.current.selection;
    act(() => result.current.setSelectedClaimId("c1", citation));
    expect(result.current.selection).not.toBe(first);
  });

  it("holds one selection: a finding replaces a claim, and null clears", () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    act(() => result.current.setSelectedClaimId("c1"));
    act(() => result.current.setSelectedFindingId("f1"));
    expect([result.current.selectedClaimId, result.current.selectedFindingId]).toEqual([
      null,
      "f1",
    ]);
    act(() => result.current.setSelectedFindingId(null));
    expect(result.current.selection).toBeNull();
  });
});
