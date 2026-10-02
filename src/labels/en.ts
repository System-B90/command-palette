import type { CommandPaletteLabels } from "@/types.js";

/**
 * English copy.
 *
 * Its own module, reachable only through the `@system-b90/command-palette/en`
 * subpath, so an app that imports the Hebrew table never pulls these strings
 * into its bundle — see `src/labels/index.ts`.
 */
export const EN_LABELS: CommandPaletteLabels = {
    placeholder: "Type a command or search…",
    empty: "No matching results",
    recents: "Recent",
    kinds: {
        command: "Commands",
        entity: "Entities",
        goto: "Go to",
    },
    hints: {
        navigate: "navigate",
        run: "run",
        close: "close",
    },
};
