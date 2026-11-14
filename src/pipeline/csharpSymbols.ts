/**
 * Reads C# hunks for the names a change declares and the calls it adds: the
 * text rules behind the legacy guard's reach-in detector (a change outside a
 * legacy zone that declares what the zone uses, or calls what the zone declares).
 * Text rules, not a parser: they miss properties and fields on purpose.
 * Spec section 5, Policy.
 */
import type { Review } from "../contracts";
import { ignoredSymbolNames } from "../policy/legacyTouch";

type Hunk = Review["hunks"][number];


/**
 * A C# type or method declaration with an access modifier, capturing its name.
 * Fields and properties are left out: a call can't name them, and a field called
 * `writer` would make every `writer(...)` delegate call look like a reach in.
 * @example "public static Foo<T, U>? Bar<T>(" captures "Bar"; "internal sealed class Baz" captures "Baz"
 */
const declarationPattern =
  /\b(?:public|internal|protected|private)\s+(?:(?:static|virtual|override|abstract|sealed|async|partial|readonly|unsafe|new)\s+)*(?:(?:class|struct|interface|enum|record)\s+(\w+)|[\w.]+(?:<[^>]*>)?(?:\[\])*\??\s+(\w+)\s*(?:<[^>]*>)?\s*\()/;

/** Symbols declared on the hunk's added or removed lines (a changed signature shows as both). */
export function changedDeclarations(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind !== "context")
    .flatMap((line) => declaredName(line.text) ?? [])
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}

/**
 * A call: a name followed by "(", not an object creation and not a call on
 * `this.`, which is the type's own method and not a reach into another type.
 * @example "writer.Write(x)" yields "Write"; "this.Write(x)" and "new Foo()" yield nothing.
 */
const callPattern = /(?<!this\.)(?<!new\s)\b([A-Za-z_]\w*)\s*\(/g;

/** Symbols the hunk's added lines call, declarations and comments excluded. */
export function addedCalls(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind === "add" && !declarationPattern.test(line.text))
    .filter((line) => !line.text.trimStart().startsWith("//"))
    .flatMap((line) => [...line.text.matchAll(callPattern)].map((match) => match[1]))
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}


/**
 * The type or method name a line of C# declares, or null.
 * @example declaredName("internal sealed class Baz") // "Baz"
 */
export function declaredName(text: string): string | null {
  const match = declarationPattern.exec(text);
  return match ? (match[1] ?? match[2]) : null;
}
