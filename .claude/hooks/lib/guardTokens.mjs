// Tokenising for the shell rows of the PreToolUse guard (docs/setup.md section 4.2): cutting a
// Bash or PowerShell line into commands and words. A seatbelt, not a shell parser.

/** Stands in for a skipped `$( ... )` or `( ... )` so later words keep their argument positions. */
export const SUBSTITUTION_PLACEHOLDER = "$SUBST";

const CLOSERS = { "(": ")", "{": "}" };

/**
 * Index of the bracket that closes the one just before `from`, skipping quoted text and escaped
 * characters, or `text.length` when it never closes. `esc` is the tool's escape character.
 */
function closingIndex(text, from, open, esc) {
  const close = CLOSERS[open];
  let depth = 1;
  let q = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (esc && c === esc && q !== "'") i++;
    else if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return text.length;
}

/**
 * The bracket that opens a nested command at `i`, or null: `$(`, `@(`, `<(`, `>(` (always),
 * a `(` or, in PowerShell, a `{` that follows other words (`-Value (Get-Date)`, `-Value {x}`).
 * A bracket at the start of a command is a group instead (`(git push)`, `{ git push }`).
 */
function nestedOpenAt(cmd, i, esc, atCommandStart) {
  const c = cmd[i];
  if ("$@<>".includes(c) && cmd[i + 1] === "(") return { open: "(", at: i + 1 };
  if (c === "(" && !atCommandStart) return { open: "(", at: i };
  if (c === "{" && esc === "`" && !atCommandStart) return { open: "{", at: i };
  return null;
}

/**
 * Splits a command on `&&`, `||`, `&`, `;`, `|`, newlines and the brackets of a group at the start
 * of a command (`(a)`, PowerShell `{ a }`), outside quotes. A `&` that belongs to a redirect
 * (`2>&1`, `&>`, `>&`) stays in the part.
 *
 * A nested command inside an argument (`$(...)`, `<(...)`, `(Get-Date)`) is not cut out of its
 * part: it leaves SUBSTITUTION_PLACEHOLDER behind, so `git push origin $(x) --force` keeps its
 * words, and its text comes back in `nested` to be checked as a command line of its own.
 *
 * `esc` is the tool's escape character (backslash for Bash, backtick for PowerShell);
 * outside single quotes it makes the next character literal, so it can't open or close a quote.
 *
 * Each part keeps its `source`: the original text, nested commands included, for rows that look
 * for a path anywhere in the command (a harness file inside `$(echo .claude/hooks/x)`). A part
 * inside a `( ... )` or PowerShell `{ ... }` group is marked `grouped`: a `cd` there stays there.
 * @returns {{parts: {text: string, source: string, grouped: boolean}[], nested: string[]}}
 */
export function splitCommand(cmd, esc = "\\") {
  const parts = [];
  const nested = [];
  let cur = "";
  let source = "";
  let q = null;
  let groupDepth = 0;
  const endPart = () => {
    parts.push({ text: cur.trim(), source: source.trim(), grouped: groupDepth > 0 });
    cur = "";
    source = "";
  };
  const keep = (text, original = text) => {
    cur += text;
    source += original;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    // In PowerShell `& {` calls a script block, so the call operator doesn't end the command start.
    const atCommandStart = cur.trim() === "" || (esc === "`" && cur.trim() === "&");
    const span = q ? null : nestedOpenAt(cmd, i, esc, atCommandStart);
    if (esc && c === esc && q !== "'") {
      keep(c + (cmd[i + 1] ?? ""));
      i++;
    } else if (q) {
      keep(c);
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      keep(c);
    } else if (span) {
      const end = closingIndex(cmd, span.at + 1, span.open, esc);
      nested.push(cmd.slice(span.at + 1, end));
      keep(SUBSTITUTION_PLACEHOLDER, cmd.slice(i, end + 1));
      i = end;
    } else if ((c === "&" || c === "|") && cmd[i + 1] === c) {
      endPart();
      i++;
    } else if (c === "&" && (cmd[i - 1] === ">" || cmd[i - 1] === "<" || cmd[i + 1] === ">")) {
      keep(c);
    } else if (c === "(" || (c === "{" && atCommandStart && (esc === "`" || /\s/.test(cmd[i + 1] ?? " ")))) {
      endPart();
      groupDepth++;
    } else if (c === ")" || (esc === "`" && c === "}")) {
      endPart();
      groupDepth = Math.max(0, groupDepth - 1);
    } else if (";|&\n".includes(c)) endPart();
    else keep(c);
  }
  endPart();
  return { parts: parts.filter((p) => p.text), nested };
}

/**
 * The text inside each `$( ... )` and, in Bash, each pair of backticks, including inside double
 * quotes where the shell still runs them. Single-quoted text is literal and skipped; a quote of
 * the other kind inside a quoted string doesn't change the mode (`"it's"` stays double-quoted).
 */
export function substitutions(line, esc) {
  const found = [];
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (esc && c === esc && !inSingle) i++;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (inSingle) continue;
    else if (c === "$" && line[i + 1] === "(") {
      const end = closingIndex(line, i + 2, "(", esc);
      found.push(line.slice(i + 2, end));
      i = end;
    } else if (c === "`" && esc !== "`") {
      const end = line.indexOf("`", i + 1);
      if (end < 0) break;
      found.push(line.slice(i + 1, end));
      i = end;
    }
  }
  return found;
}

/** Splits one part into words, honouring quotes and the escape character `esc` (null: no escapes). */
export function words(part, esc = "\\") {
  const out = [];
  let cur = "";
  let has = false;
  let q = null;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (esc && c === esc && q !== "'") {
      const n = part[i + 1];
      if (n === undefined || (q === '"' && esc === "\\" && !'"\$`'.includes(n))) cur += c;
      else {
        cur += n;
        has = true;
        i++;
      }
    } else if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      has = true;
    } else if (/\s/.test(c)) {
      if (has || cur) out.push(cur);
      cur = "";
      has = false;
    } else cur += c;
  }
  if (has || cur) out.push(cur);
  return out;
}

/** Values of an option in the forms `--long v`, `--long=v` and `-s v`. */
export function optValues(ws, long, short = []) {
  const vals = [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (long.includes(w) || short.includes(w)) {
      if (i + 1 < ws.length) vals.push(ws[++i]);
    } else if (w.startsWith("--") && w.includes("=") && long.includes(w.slice(0, w.indexOf("=")))) {
      vals.push(w.slice(w.indexOf("=") + 1));
    }
  }
  return vals;
}
