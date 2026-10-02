# Recipes

## Entity search over a large collection

Do not materialise thousands of commands. Contribute a factory, gate it on the
lane and a minimum query length, and cap the results — the palette shows at most
60 anyway, and a section of 20 is already more than anyone scans.

```tsx
const students = useStudentIndex();          // built once, not per keystroke
const router = useRouter();

const studentCommands = useCallback(
    (query: CommandQuery): Array<Command> => {
        if (query.kind !== "entity" || query.text.length < 2) return [];

        return students
            .search(query.text)
            .slice(0, 20)
            .map((student) => ({
                id: `student.${student.id}`,
                title: student.name,
                subtitle: student.className,
                kind: "entity" as const,
                group: "Students",
                icon: <PersonIcon />,
                run: () => router.push(`/students/${student.id}`),
            }));
    },
    [students, router],
);

useCommands(studentCommands);
```

The factory runs on every keystroke while the palette is open. Keep the index
outside it.

## Navigation commands from a route table

```tsx
const router = useRouter();

const navigation = useMemo(
    () =>
        ROUTES.map((route) => ({
            id: `goto.${route.path}`,
            title: route.label,
            subtitle: route.path,
            kind: "goto" as const,
            group: "Navigate",
            icon: route.icon,
            run: () => router.push(route.path),
        })),
    [router],
);

useCommands(navigation);
```

Contribute these from the layout, not from a page — navigation should be
available everywhere.

## A toggle that keeps the palette open

```tsx
const { mode, setMode } = useColorScheme();

const commands = useMemo(
    () => [
        {
            id: "appearance.theme.toggle",
            title: mode === "dark" ? "Switch to light theme" : "Switch to dark theme",
            group: "Appearance",
            icon: mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />,
            keepOpen: true,
            run: () => setMode(mode === "dark" ? "light" : "dark"),
        },
    ],
    [mode, setMode],
);
```

The title depends on `mode`, so the `useMemo` dependency array re-registers the
command when the theme flips — and the open palette re-renders with the new
label.

## A command that is sometimes unavailable

```tsx
{
    id: "gantt.syllabus.delete",
    title: "Delete syllabus",
    subtitle: selected ? selected.name : "Select a syllabus first",
    group: "Curriculum",
    enabled: Boolean(selected),
    run: () => deleteSyllabus(selected!.id),
}
```

Greyed out and unselectable, but still visible — which answers "where is the
delete command?" instead of leaving the user hunting.

## Async work with feedback

`run` is fired and forgotten; the palette closes immediately. Own the feedback:

```tsx
{
    id: "reports.export",
    title: "Export report",
    group: "Reports",
    run: async () => {
        const toastId = toast.loading("Exporting…");
        try {
            await exportReport();
            toast.success("Report exported", { id: toastId });
        } catch (error) {
            toast.error(describeError(error), { id: toastId });
        }
    },
}
```

An unhandled rejection inside `run` will not surface anywhere in the palette.

## Sharing a command with a toolbar button

Declare the command once, invoke it from both places:

```tsx
const { runCommand } = useCommandPalette();

<Button onClick={() => runCommand("schedule.event.new")}>New event</Button>;
```

No-op if the command is not currently contributed or is disabled — the button
should be hidden or disabled in that case anyway.

## Opening straight into a lane

```tsx
const { open } = useCommandPalette();

<MenuItem onClick={() => open("entity")}>Find a student…</MenuItem>
<MenuItem onClick={() => open("goto")}>Go to…</MenuItem>
```

## Page-local override of a global command

The **first** contributor of an id wins. Since the provider collects in
registration order and pages mount below the layout, a global command
contributed by the layout normally wins. To let a page take over, give the page
the id and the layout a different one — or, more simply, have the layout stop
contributing while the page is mounted (a context flag), rather than relying on
collection order.

## Headless use of the matcher

Rank an in-page search field the same way the palette ranks, including
highlighting:

```tsx
import { matchText } from "@system-b90/command-palette/core";
import { HighlightedText } from "@system-b90/command-palette";

const results = useMemo(
    () =>
        rooms
            .map((room) => ({ room, ...matchText(query, room.name) }))
            .filter((hit) => hit.score > 0)
            .sort((a, b) => b.score - a.score),
    [rooms, query],
);

return results.map(({ room, indices }) => (
    <li key={room.id}>
        <HighlightedText text={room.name} indices={indices} />
    </li>
));
```

`/core` pulls in no React and no MUI, so this is cheap even on a page that does
not mount the palette.

## Testing a host app's commands

The registry is a plain class with no React dependency, so command sets can be
tested directly:

```ts
import { CommandRegistry, rankCommands, RecentsStore } from "@system-b90/command-palette/core";

const registry = new CommandRegistry();
registry.register("schedule", buildScheduleCommands(deps));

const ranked = rankCommands(
    registry.collect({ text: "event", kind: null }),
    { text: "event", kind: null },
    { recents: new RecentsStore("test") },
);

expect(ranked[0].command.id).toBe("schedule.event.new");
```

For end-to-end coverage, drive the real thing: open with ++ctrl+k++, type, assert
on `role="option"` rows.
