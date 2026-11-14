/**
 * Canonical JSON: the one byte sequence a receipt is signed and verified as.
 * Keys are sorted by UTF-16 code unit at every depth, indent is 2 spaces, lines
 * end in LF and the text ends in exactly one newline. Two machines that hold the
 * same receipt therefore sign and verify the same bytes. Spec 9.1, payload format.
 */

/**
 * Serialises `value` as canonical JSON.
 *
 * Written by hand instead of `JSON.stringify` on a sorted copy: the engine
 * orders integer-like keys ("2" before "10" before "a") ahead of insertion
 * order, which would silently undo the sort.
 *
 * @throws Error naming the path (for example `$.owner`) when a value is undefined or otherwise
 * has no JSON form, so a signed payload never contains the text "undefined".
 * @example canonicalJson({ b: 1, a: [2] }) // '{\n  "a": [\n    2\n  ],\n  "b": 1\n}\n'
 */
export function canonicalJson(value: unknown): string {
  return `${write(value, "", "$")}\n`;
}

function write(value: unknown, indent: string, path: string): string {
  if (Array.isArray(value)) return writeArray(value, indent, path);
  if (value !== null && typeof value === "object")
    return writeObject(value as Record<string, unknown>, indent, path);
  const text = JSON.stringify(value);
  // JSON.stringify returns the value undefined, not text, for undefined, functions and
  // symbols; template-joining it would sign the word "undefined".
  if (text === undefined)
    throw new Error(
      `Cannot sign ${path}: its value is ${String(value)}, which JSON cannot hold. Remove the key or give it a value.`,
    );
  return text;
}

function writeArray(items: unknown[], indent: string, path: string): string {
  if (items.length === 0) return "[]";
  const inner = `${indent}  `;
  const lines = items.map((item, index) => `${inner}${write(item, inner, `${path}[${index}]`)}`);
  return `[\n${lines.join(",\n")}\n${indent}]`;
}

function writeObject(object: Record<string, unknown>, indent: string, path: string): string {
  const keys = Object.keys(object).sort();
  if (keys.length === 0) return "{}";
  const inner = `${indent}  `;
  const lines = keys.map(
    (key) => `${inner}${JSON.stringify(key)}: ${write(object[key], inner, `${path}.${key}`)}`,
  );
  return `{\n${lines.join(",\n")}\n${indent}}`;
}
