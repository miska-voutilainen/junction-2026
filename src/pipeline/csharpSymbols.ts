/**
 * Reads C# hunks for the names a change declares and the calls it adds: the
 * text rules behind the legacy guard's reach-in detector (a change outside a
 * legacy zone that declares what the zone uses, or calls what the zone declares).
 * Text rules, not a parser: they miss properties and fields on purpose.
 * Spec section 5, Policy.
 */
import type { Review } from "../contracts";
import { commentLine, ignoredSymbolNames } from "../policy/legacyTouch";

type Hunk = Review["hunks"][number];

/**
 * Types and methods declared on the hunk's added or removed lines. A changed
 * signature shows as both, so it counts once.
 * @example a hunk adding "public void Flush()" gives ["Flush"]
 */
export function changedDeclarations(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind !== "context")
    .flatMap((line) => declaredName(line.text) ?? [])
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}

/**
 * Names the hunk's added lines call. Declaration lines and comments are skipped:
 * `public void Write(` declares Write, it doesn't call it.
 * @example a hunk adding "writer.WriteNil();" gives ["WriteNil"]
 */
export function addedCalls(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind === "add")
    .filter((line) => !declarationPattern.test(line.text) && !commentLine.test(line.text))
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

/**
 * A C# type or method declaration with an access modifier, capturing its name:
 * group 1 for a type (`class Baz`), group 2 for a method (`Foo<T> Bar<T>(`).
 * Fields and properties are left out: a call can't name them, and a field called
 * `writer` would make every `writer(...)` delegate call look like a reach in.
 * @example "public static Foo<T, U>? Bar<T>(" captures "Bar"; "internal sealed class Baz" captures "Baz"
 */
const declarationPattern =
  /\b(?:public|internal|protected|private)\s+(?:(?:static|virtual|override|abstract|sealed|async|partial|readonly|unsafe|new)\s+)*(?:(?:class|struct|interface|enum|record)\s+(\w+)|[\w.]+(?:<[^>]*>)?(?:\[\])*\??\s+(\w+)\s*(?:<[^>]*>)?\s*\()/;

/**
 * A call: a name followed by "(", not an object creation and not a call on
 * `this.`, which is the type's own method and not a reach into another type.
 * @example "writer.Write(x)" yields "Write"; "this.Write(x)" and "new Foo()" yield nothing.
 */
const callPattern = /(?<!this\.)(?<!new\s)\b([A-Za-z_]\w*)\s*\(/g;
