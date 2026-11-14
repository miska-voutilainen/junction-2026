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
 * Names the hunk's added lines call. Declaration lines, comments and strings are
 * skipped: `public void Write(` declares Write, it doesn't call it.
 * @example a hunk adding "writer.WriteNil();" gives ["WriteNil"]
 */
export function addedCalls(hunk: Hunk): string[] {
  const names = hunk.lines
    .filter((line) => line.kind === "add")
    .map((line) => codeOf(line.text))
    .filter((code) => !declarationPattern.test(code))
    .flatMap((code) => [...code.matchAll(callPattern)].map((match) => match[1]))
    .filter((name) => !ignoredSymbolNames.has(name));
  return [...new Set(names)];
}

/**
 * The type or method name a line of C# declares, or null. A declaration in a
 * comment or a string is none: "// public void Serialize(" declares nothing.
 * @example declaredName("internal sealed class Baz") // "Baz"
 */
export function declaredName(text: string): string | null {
  const match = declarationPattern.exec(codeOf(text));
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * The code on one line with string literals and comments removed, so text
 * about a call is not read as one. T4 templates write their output as strings
 * (`this.Write("writer.WriteArrayHeader(")`), and comments name methods.
 * A line that starts with `*` is taken as inside a block comment: one line
 * can't see where a comment opened, and the only C# that starts with `*` is an
 * unsafe pointer write (`*ptr = x;`), which calls nothing we look for.
 * Interpolation holes (`$"{Foo()}"`) go with their string, a miss we accept.
 * @example codeOf('Log("WriteNil() failed"); // calls Old()') // 'Log(""); '
 */
export function codeOf(text: string): string {
  if (text.trimStart().startsWith("*")) return "";
  return text
    .replace(literalPattern, '""')
    .replace(/\/\*.*?\*\//g, " ") // an inline block comment: "/* old */ Kept(1)" keeps "Kept(1)"
    .replace(/\/[/*].*$/, ""); // a line comment, or a block comment that runs past the line
}

/** A string or char literal: verbatim (`@"a""b"`), regular with escapes (`"a\"b("`), or a char (`'('`). */
const literalPattern = /@"(?:[^"]|"")*"|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)'/g;

/**
 * Type arguments, nested up to three levels, written only with characters a
 * type can have, so a comparison like `a < b && c > (d)` is not read as one.
 * @example matches "<T>", "<global::Bar>", "<string, int>", "<Dictionary<string, List<int>>>" and "<(int, int)>"
 */
const typeChar = String.raw`(?:[\w\s,.?\[\]()]|::)`; // "::" for global::Bar; a lone ":" would let ternaries in
const typeArguments = String.raw`<(?:${typeChar}|<(?:${typeChar}|<${typeChar}*>)*>)*>`;

/**
 * A return type: a name with optional type arguments, or a tuple.
 * @example matches "Task<Dictionary<string, int>>", "int[]?" and "(int Start, int End)"
 */
const returnType = String.raw`(?:[\w.]+(?:${typeArguments})?|\((?:[^()]|\([^()]*\))*\))(?:\[\])*\??`;

/**
 * A C# type or method declaration with an access modifier, capturing its name:
 * group 1 for a type (`class Baz`), group 2 for a method (`Foo<T> Bar<T>(`).
 * Fields and properties are left out: a call can't name them, and a field called
 * `writer` would make every `writer(...)` delegate call look like a reach in.
 * @example "public static Foo<T, U>? Bar<T>(" captures "Bar"; "public (int Start, int End) Bounds(" captures "Bounds"; "internal sealed class Baz" captures "Baz"
 */
const declarationPattern = new RegExp(
  String.raw`\b(?:public|internal|protected|private)\s+(?:(?:static|virtual|override|abstract|sealed|async|partial|readonly|unsafe|new)\s+)*` +
    String.raw`(?:(?:class|struct|interface|enum|record)\s+(\w+)|${returnType}\s+(\w+)\s*(?:${typeArguments}\s*)?\()`,
);

/**
 * A call: a name, optional type arguments, then "(", not an object creation
 * and not a call on `this.`, which is the type's own method and not a reach
 * into another type.
 * @example "writer.Write(x)" and "writer.WriteExt<T>(x)" yield "Write" and "WriteExt"; "this.Write(x)" and "new Foo()" yield nothing.
 */
const callPattern = new RegExp(
  String.raw`(?<!this\.)(?<!new\s)\b([A-Za-z_]\w*)\s*(?:${typeArguments}\s*)?\(`,
  "g",
);
