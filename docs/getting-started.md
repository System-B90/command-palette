# Getting Started

## 1. Install

```sh
npm install @system-b90/command-palette
```

!!! note "Peer dependencies"
    `react` (18 or 19), `@mui/material` 7 and `@mui/icons-material` 7 must
    already be in your app. They are peer dependencies precisely so the palette
    shares your app's single MUI instance and theme rather than bundling its
    own.

## 2. Mount the provider

`CommandPaletteProvider` owns the registry, the recents store and the open/query
state, and renders the palette dialog itself. Mount it **once**, high enough that
every component which might contribute a command is inside it — the root layout
is usually right.

```tsx title="app/layout.tsx"
import { CommandPaletteProvider } from "@system-b90/command-palette";
import { EN_LABELS } from "@system-b90/command-palette/en";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider theme={theme}>
            <CommandPaletteProvider labels={EN_LABELS} storageNamespace="my-app">
                {children}
            </CommandPaletteProvider>
        </ThemeProvider>
    );
}
```

It must be **inside** your MUI theme provider — the dialog reads `divider`,
`background.paper`, `primary.main` and friends from the ambient theme.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `labels` | `CommandPaletteLabels` | *required* | Every string the palette renders. See [Language & Localisation](localisation.md). |
| `storageNamespace` | `string` | `"default"` | Namespaces the persisted recents under `command-palette:recents:<namespace>`. Use one per app so two apps on the same origin do not share history. |
| `hotkeys` | `PaletteHotkeyOptions` | both enabled | `{ quickOpen?: boolean; commandMode?: boolean }` — turn off the ++ctrl+k++ and/or ++ctrl+shift+p++ bindings. |
| `width` | `number` | `640` | Width of the palette sheet in pixels. Capped at `100vw - 32px` on narrow screens. |

!!! warning "`labels` must be referentially stable"
    A fresh object every render re-renders the open palette. Use a module-level
    constant (as above) or `useMemo`.

## 3. Contribute commands

Register commands from the component that can actually perform the action — that
is what lets a palette mounted in the layout reach page-local state like a
dialog's `setOpen`.

```tsx title="app/schedule/page.tsx"
"use client";
import { useCommands } from "@system-b90/command-palette";
import AddIcon from "@mui/icons-material/Add";

export function SchedulePage() {
    const [dialogOpen, setDialogOpen] = useState(false);

    const commands = useMemo(
        () => [
            {
                id: "schedule.event.new",
                title: "New event",
                subtitle: "Add an event to the current week",
                keywords: ["create", "add", "meeting"],
                group: "Schedule",
                icon: <AddIcon />,
                shortcut: ["Ctrl", "E"],
                run: () => setDialogOpen(true),
            },
        ],
        [],
    );

    useCommands(commands);

    return /* … */;
}
```

The commands vanish from the palette when `SchedulePage` unmounts. No cleanup on
your side — `useCommands` handles registration and unregistration.

!!! danger "The source must be referentially stable"
    `useCommands(source)` re-registers whenever `source` changes identity. A
    literal array written inline re-registers on **every render**. Wrap it in
    `useMemo` (or `useCallback` for a factory) — a changed value is exactly the
    signal that tells an open palette to recompute, so it needs to mean
    something.

See [Contributing Commands](commands.md) for the full `Command` shape.

## 4. Add a mouse affordance (optional)

Not everyone knows the keyboard shortcut exists. `useCommandPalette` gives you
imperative control:

```tsx
import { useCommandPalette } from "@system-b90/command-palette";

function CommandPaletteButton() {
    const { open } = useCommandPalette();

    return (
        <Tooltip title="Search (Ctrl+K)">
            <IconButton onClick={() => open()} aria-label="Open command palette">
                <SearchIcon />
            </IconButton>
        </Tooltip>
    );
}
```

`open(kind)` can also pre-select a lane: `open("goto")` opens the palette already
filtered to navigation commands.

## 5. Verify

- ++ctrl+k++ (or ++cmd+k++) opens the palette with everything in play.
- ++ctrl+shift+p++ opens it pre-filtered to the command lane.
- Typing filters; ++up++ / ++down++ move; ++enter++ runs; ++esc++ closes.
- Run a command, reopen with an empty query — it now appears under **Recent**.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Command palette hooks must be used inside a <CommandPaletteProvider>.` | `useCommands` / `useCommandPalette` called from a component that is not a descendant of the provider. |
| Commands flicker or the list jumps while typing | The `source` passed to `useCommands` is not referentially stable, so it re-registers every render. |
| The palette opens unfocused | Something else in the app is stealing focus after the dialog transition. The palette already re-grabs focus in `onEntered`; look for a competing autofocus. |
| Nothing happens on ++ctrl+k++ | Either `hotkeys={{ quickOpen: false }}` is set, or another global handler is calling `preventDefault` first. |
| Recents are shared between two apps | Both are using the default `storageNamespace` on the same origin. Give each its own. |
| Styles look wrong / colours are off | The provider is outside your MUI `ThemeProvider`. |
