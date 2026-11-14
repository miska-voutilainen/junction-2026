/**
 * Share of the key sentence's distinct words that also appear in the statement.
 * Lowercased and split on anything not a letter or digit, so
 * "The cache is cleared, on every write." gives {the, cache, is, cleared, on,
 * every, write}. Returns 0 when the key has no words.
 */
export function tokenOverlap(keySentence: string, statement: string): number {
  const keyTokens = tokenSet(keySentence);
  if (keyTokens.size === 0) return 0;
  const statementTokens = tokenSet(statement);
  let shared = 0;
  for (const token of keyTokens) {
    if (statementTokens.has(token)) shared += 1;
  }
  return shared / keyTokens.size;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0),
  );
}
