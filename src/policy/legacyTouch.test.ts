/**
 * Adversarial inputs for the old-platform directive: spellings of `#if` that
 * must still be read as old-only code (a miss lets old-target code skip its
 * owner) and directives that must not be (a false touch costs one read).
 */
import { describe, expect, it } from "vitest";
import { oldPlatformDirective } from "./legacyTouch";

describe("oldPlatformDirective", () => {
  it.each([
    ["#elif !NET6_0_OR_GREATER"],
    ["#  if NETFRAMEWORK"],
    ["    #if NETFRAMEWORK"],
    ["#if NETFRAMEWORK // .NET Framework only"],
    ["#if (NETFRAMEWORK)"],
    ["#if NETSTANDARD2_0 || NET472"],
    ["#if DEBUG && NETFRAMEWORK"],
    ["#if NETFRAMEWORK\r"],
    ["#if UNITY_2021_3_OR_NEWER"],
    ["#if !NETCOREAPP3_1_OR_GREATER"],
  ])("reads %j as old-platform code", (line) => {
    expect(oldPlatformDirective.test(line)).toBe(true);
  });

  it.each([
    ["#if NET8_0_OR_GREATER"],
    ["#if NETCOREAPP3_1_OR_GREATER"],
    ["#if NET6_0_OR_GREATER && !DEBUG"],
    ["#if DEBUG"],
    ['var directive = "#if NETFRAMEWORK";'],
    ["// #if NETFRAMEWORK"],
    ["/// #if NETFRAMEWORK"],
    ["#region NETFRAMEWORK helpers"],
    ["#endif // NETFRAMEWORK"],
    ["#else // NETFRAMEWORK"],
  ])("does not read %j as old-platform code", (line) => {
    expect(oldPlatformDirective.test(line)).toBe(false);
  });
});
