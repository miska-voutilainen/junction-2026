/**
 * Area checklists: the questions A3 asks of each hunk in an area. They stand
 * in for Tieto's own review standards, which have not arrived (spec Q1), and
 * come from public .NET, Roslyn and OWASP deserialization guidance. Swap this
 * file's contents when Tieto's standards arrive. Spec section 5, Policy.
 */
import type { Area } from "../contracts";

/** Shown wherever a checklist is shown, so nobody takes it for Tieto's standard. */
export const checklistSource = "our checklist until Tieto's standards arrive";

/** Six to ten checks per area, each answerable from the diff and the files around it. */
export const areaChecklists: Record<Area, string[]> = {
  generator: [
    "Generated code compiles for every shape the generator accepts: nested types, generics, records, structs, and types in the global namespace.",
    "Member and type names in emitted code are fully qualified or escaped, so a user type named like a keyword or a BCL type cannot break the output.",
    "Symbol lookups handle null and metadata-only symbols: DeclaringSyntaxReferences can be empty, and Locations can be outside the compilation.",
    "The generator is incremental: pipeline steps compare by value, and no step holds a Compilation, ISymbol or SyntaxNode in its cached output.",
    "Output is deterministic: no dictionary or hash-set iteration order, timestamps or absolute paths in emitted source.",
    "The generator never throws on unusual input; a problem becomes a diagnostic with a location, not an unhandled exception.",
    "Each new behaviour has a test over generated output (snapshot or compile test), including the case that used to fail.",
    "Generated serialization stays compatible with the formatters and the wire format already shipped.",
  ],
  analyzer: [
    "Each diagnostic has a unique ID, a title, a message format and a default severity, and the ID is listed in AnalyzerReleases.Unshipped.md.",
    "The analyzer enables concurrent execution and skips generated code, as Roslyn analyzers are expected to.",
    "Diagnostic locations come from the symbol or syntax that is actually wrong, and the analyzer copes when no location exists in the compilation.",
    "Registered actions use the narrowest SyntaxKind or SymbolKind, so the analyzer stays cheap on large solutions.",
    "A diagnostic is reported once per problem, not once per reference, and not for types the compilation does not own.",
    "The diagnostic's help page under doc/analyzers/ exists and matches what the analyzer now reports.",
    "Tests cover a case that must report and a case that must stay silent, with expected locations.",
    "A code fix, if one exists, keeps the document compiling and changes nothing outside the reported span.",
  ],
  security: [
    "Untrusted input is bounded: lengths, element counts and nesting depth are checked before allocating or recursing (MessagePackSecurity limits).",
    "Deserialization never instantiates a type chosen by the payload unless it is on an allow-list (OWASP: deserialization of untrusted data).",
    "Hash-based collections built from payload keys use the collision-resistant comparer, so crafted keys cannot degrade them.",
    "Arithmetic on sizes and offsets is checked for overflow before it is used to index or allocate.",
    "Reads stay inside the buffer: no access past the end of a ReadOnlySequence or span, including across segment boundaries.",
    "Errors on malformed input throw the documented exception type and leave no half-built shared state behind.",
    "No reflection or dynamic code generation over type names taken from the payload.",
    "Changes to what the runtime accepts or emits keep old data readable, or are flagged as a wire-format change.",
    "Tests include a malformed or hostile payload for each new read path.",
  ],
  performance: [
    "Hot paths allocate nothing new per call: no LINQ, closures, boxing or string concatenation where a span or a cached value works.",
    "Buffers come from the writer or an array pool and are returned on every path, including exceptions.",
    "Reflection and delegate creation happen once, at resolver or formatter construction, not per call.",
    "Span, Memory and ref struct use follows lifetime rules; nothing escapes to the heap by accident.",
    "A claimed speed-up has a benchmark in the repository's benchmark project, or the change says it is unmeasured.",
    "Collections are sized up front where the count is known.",
    "Static caches are thread-safe and bounded; nothing grows with the number of distinct input types or payloads.",
    "The change keeps AOT and trimming working: no new unannotated reflection.",
  ],
};
