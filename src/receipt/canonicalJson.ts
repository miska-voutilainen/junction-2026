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
 * @example canonicalJson({ b: 1, a: [2] }) // '{\n  "a": [\n    2\n  ],\n  "b": 1\n}\n'
 */
export function canonicalJson(value: unknown): string {
  return `${write(value, "")}\n`;
}

function write(value: unknown, indent: string): string {
  if (Array.isArray(value)) return writeArray(value, indent);
  if (value !== null && typeof value === "object")
    return writeObject(value as Record<string, unknown>, indent);
  return JSON.stringify(value);
}

function writeArray(items: unknown[], indent: string): string {
  if (items.length === 0) return "[]";
  const inner = `${indent}  `;
  const lines = items.map((item) => `${inner}${write(item, inner)}`);
  return `[\n${lines.join(",\n")}\n${indent}]`;
}

function writeObject(object: Record<string, unknown>, indent: string): string {
  const keys = Object.keys(object).sort();
  if (keys.length === 0) return "{}";
  const inner = `${indent}  `;
  const lines = keys.map((key) => `${inner}${JSON.stringify(key)}: ${write(object[key], inner)}`);
  return `{\n${lines.join(",\n")}\n${indent}}`;
}
