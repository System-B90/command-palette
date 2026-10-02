"use client";
import { ReactNode, useCallback, useMemo, useState } from "react";

import {
    CommandPaletteContext,
    CommandPaletteContextValue,
} from "@/CommandPaletteContext.js";
import { CommandPaletteDialog } from "@/CommandPaletteDialog.js";
import { buildRawQuery } from "@/core/modes.js";
import { RecentsStore } from "@/core/recents.js";
import { CommandRegistry } from "@/core/registry.js";
import type { CommandKind, CommandPaletteLabels } from "@/types.js";
import { useCommandHotkeys } from "@/use-command-hotkeys.js";
import {
    PaletteHotkeyOptions,
    useOpenPaletteHotkeys,
} from "@/use-open-palette-hotkeys.js";

export type CommandPaletteProviderProps = {
    children: ReactNode;
    /**
     * Every string the palette renders. Required, and with no default, so that
     * the package itself references no copy in any language — that is what
     * keeps the language a host does *not* import out of its bundle.
     *
     * Import one of the shipped tables and pass it:
     *
     * ```tsx
     * import { HE_LABELS } from "@system-b90/command-palette/he";
     *
     * <CommandPaletteProvider labels={HE_LABELS}>
     * ```
     *
     * Use `withLabelOverrides` to re-word individual strings. Must be
     * referentially stable (module constant or `useMemo`) — a fresh object
     * every render re-renders the open palette.
     */
    labels: CommandPaletteLabels;
    /** Namespaces the persisted recents. Use one per host app. */
    storageNamespace?: string;
    hotkeys?: PaletteHotkeyOptions;
    /** Width of the palette sheet. Defaults to `640`. */
    width?: number;
};

/**
 * Owns the registry, the recents store and the open/query state, and renders
 * the palette itself. Mount it once, high enough that every command
 * contributor is inside it.
 */
export function CommandPaletteProvider({
    children,
    labels,
    storageNamespace = "default",
    hotkeys,
    width,
}: CommandPaletteProviderProps) {
    const registry = useMemo(() => new CommandRegistry(), []);
    const recents = useMemo(
        () => new RecentsStore(storageNamespace),
        [storageNamespace],
    );

    const [isOpen, setIsOpen] = useState(false);
    const [rawQuery, setRawQuery] = useState("");

    const open = useCallback((kind: CommandKind | null = null) => {
        setRawQuery(buildRawQuery(kind));
        setIsOpen(true);
    }, []);

    const close = useCallback(() => setIsOpen(false), []);

    const toggle = useCallback(
        (kind: CommandKind | null = null) => {
            setIsOpen((wasOpen) => {
                if (!wasOpen) setRawQuery(buildRawQuery(kind));
                return !wasOpen;
            });
        },
        [],
    );

    useOpenPaletteHotkeys(open, hotkeys);
    useCommandHotkeys(registry);

    const value = useMemo<CommandPaletteContextValue>(
        () => ({
            registry,
            recents,
            labels,
            isOpen,
            rawQuery,
            setRawQuery,
            open,
            close,
            toggle,
        }),
        [registry, recents, labels, isOpen, rawQuery, open, close, toggle],
    );

    return (
        <CommandPaletteContext.Provider value={value}>
            {children}
            <CommandPaletteDialog width={width} />
        </CommandPaletteContext.Provider>
    );
}
