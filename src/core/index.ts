/**
 * The React-free half of the palette: the contribution registry, the matcher,
 * ranking, recents and prefix parsing. Importable on its own
 * (`@system-b90/command-palette/core`) by hosts that want the machinery
 * without the dialog — a headless surface, a server-side ranking pass, or an
 * in-page search field that should score results the same way.
 */

export { matchText } from "@/core/fuzzy.js";
export type { MatchResult } from "@/core/fuzzy.js";
export { matchesShortcut } from "@/core/hotkeys.js";
export { buildRawQuery, KIND_PREFIXES, parseQuery, PREFIX_BY_KIND } from "@/core/modes.js";
export { flattenGroups, groupRanked, rankCommands } from "@/core/rank.js";
export type { RankOptions } from "@/core/rank.js";
export { RecentsStore } from "@/core/recents.js";
export type { RecentsSnapshot } from "@/core/recents.js";
export { CommandRegistry } from "@/core/registry.js";
export type { Unsubscribe } from "@/core/registry.js";
export { isWordStart, normalizeChars, normalizeText } from "@/core/text.js";
