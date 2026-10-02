"use client";
import { createContext, useContext } from "react";

import type { RecentsStore } from "@/core/recents.js";
import type { CommandRegistry } from "@/core/registry.js";
import type { CommandKind, CommandPaletteLabels } from "@/types.js";

export type CommandPaletteContextValue = {
    registry: CommandRegistry;
    recents: RecentsStore;
    labels: CommandPaletteLabels;
    isOpen: boolean;
    /** Raw input value, prefix included. */
    rawQuery: string;
    setRawQuery: (value: string) => void;
    /** Open the palette, optionally pre-selecting a lane. */
    open: (kind?: CommandKind | null) => void;
    close: () => void;
    toggle: (kind?: CommandKind | null) => void;
};

export const CommandPaletteContext =
    createContext<CommandPaletteContextValue | null>(null);

export function useCommandPaletteContext(): CommandPaletteContextValue {
    const context = useContext(CommandPaletteContext);
    if (!context) {
        throw new Error(
            "Command palette hooks must be used inside a <CommandPaletteProvider>.",
        );
    }
    return context;
}
