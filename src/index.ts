/**
 * Command palette — a VSCode-style quick-open surface for MUI apps.
 *
 * Depends only on `react`, `@mui/material` and `@mui/icons-material`, all of
 * which are peer dependencies: the package holds no knowledge of any host app's
 * domain, routing or locale.
 */

export { CommandPaletteProvider } from "@/CommandPaletteProvider.js";
export type { CommandPaletteProviderProps } from "@/CommandPaletteProvider.js";
export { KeyChip, ShortcutKeys } from "@/KeyChip.js";
export { HighlightedText } from "@/HighlightedText.js";
export type { HighlightedTextProps } from "@/HighlightedText.js";
export { useCommandPalette } from "@/use-command-palette.js";
export type { UseCommandPaletteResult } from "@/use-command-palette.js";
export { useCommands } from "@/use-commands.js";
export type { PaletteHotkeyOptions } from "@/use-open-palette-hotkeys.js";

// Locale plumbing only — the tables themselves live behind the `/en` and `/he`
// subpaths so that only the language a host imports reaches its bundle.
export { withLabelOverrides } from "@/labels/index.js";
export type { PartialCommandPaletteLabels } from "@/labels/index.js";

export type {
    Command,
    CommandFactory,
    CommandId,
    CommandKind,
    CommandPaletteLabels,
    CommandQuery,
    CommandSource,
    RankedCommand,
    RankedGroup,
} from "@/types.js";

// Escape hatches for hosts that want to reuse the palette's own machinery —
// an in-page search field that should rank the same way, say, or a headless
// surface built on the same contribution registry.
export { matchText } from "@/core/fuzzy.js";
export type { MatchResult } from "@/core/fuzzy.js";
export { normalizeText } from "@/core/text.js";
export { KIND_PREFIXES, PREFIX_BY_KIND } from "@/core/modes.js";
export { CommandRegistry } from "@/core/registry.js";
export type { Unsubscribe } from "@/core/registry.js";
export { RecentsStore } from "@/core/recents.js";
export { flattenGroups, groupRanked, rankCommands } from "@/core/rank.js";
export type { RankOptions } from "@/core/rank.js";
export { matchesShortcut } from "@/core/hotkeys.js";
