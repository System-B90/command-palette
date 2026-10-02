import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

// Imports the built package (the same entry point real consumers resolve).
import { flattenGroups, groupRanked, rankCommands } from "../dist/core/rank.js";
import { RecentsStore } from "../dist/core/recents.js";

const noop = () => {};

/** Degrades to an empty history without a `window`, which is the default here. */
const recents = new RecentsStore("rank-test");

type Partial = Record<string, unknown>;
const command = (id: string, extra: Partial = {}) => ({
    id,
    title: id,
    run: noop,
    ...extra,
});

const rank = (
    commands: Array<unknown>,
    text: string,
    options: Partial = {},
     
) => rankCommands(commands as any, { text, kind: null }, { recents, ...options } as any);

const ids = (ranked: Array<{ command: { id: string } }>) =>
    ranked.map((r) => r.command.id);

/** Installs a fake `window` so a RecentsStore can actually record. */
function recentsWith(...recorded: Array<string>): RecentsStore {
    const data = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
        localStorage: {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => data.set(k, v),
            removeItem: (k: string) => data.delete(k),
        },
    };
    const store = new RecentsStore(`rank-${Math.random()}`);
    for (const id of recorded) store.record(id);
    return store;
}

afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
});

describe("field weighting hierarchy", () => {
    test("title beats keyword beats subtitle for the same text", () => {
        // The weights are tuned product decisions the architecture doc commits
        // to: KEYWORD 0.85 > SUBTITLE 0.6 > GROUP 0.4. Equal base scores, so
        // only the field discount can separate these three.
        const ranked = rank(
            [
                command("subtitle-hit", { title: "zzz", subtitle: "deploy" }),
                command("title-hit", { title: "deploy" }),
                command("keyword-hit", { title: "zzz", keywords: ["deploy"] }),
            ],
            "deploy",
        );

        assert.deepEqual(ids(ranked), ["title-hit", "keyword-hit", "subtitle-hit"]);
    });

    test("a group-only hit still matches, below every other field", () => {
        const ranked = rank(
            [
                command("group-hit", { title: "zzz", group: "deploy" }),
                command("subtitle-hit", { title: "zzz", subtitle: "deploy" }),
            ],
            "deploy",
        );

        assert.deepEqual(ids(ranked), ["subtitle-hit", "group-hit"]);
    });

    test("a group-only hit is a match rather than a miss", () => {
        const ranked = rank(
            [command("group-only", { title: "zzz", group: "Scheduling" })],
            "sched",
        );

        assert.equal(ranked.length, 1);
        assert.ok(ranked[0].score > 0);
    });

    test("a command matching nothing is dropped", () => {
        assert.deepEqual(rank([command("nope", { title: "zzz" })], "deploy"), []);
    });

    test("titleMatches is empty when only a non-title field matched", () => {
        // The UI highlights title characters; a keyword-only hit has none.
        const ranked = rank(
            [command("kw", { title: "zzz", keywords: ["deploy"] })],
            "deploy",
        );

        assert.deepEqual(ranked[0].titleMatches, []);
    });
});

describe("priority and recency", () => {
    test("priority reorders two otherwise identical matches", () => {
        const ranked = rank(
            [
                command("plain", { title: "deploy alpha" }),
                command("boosted", { title: "deploy bravo", priority: 1 }),
            ],
            "deploy",
        );

        assert.deepEqual(ids(ranked), ["boosted", "plain"]);
    });

    test("a recorded command outranks an identical unrecorded one", () => {
        const store = recentsWith("recent");
        const ranked = rankCommands(
            [
                command("cold", { title: "deploy alpha" }),
                command("recent", { title: "deploy alpha" }),
                 
            ] as any,
            { text: "deploy", kind: null },
            { recents: store },
        );

        assert.deepEqual(ids(ranked), ["recent", "cold"]);
    });

    test("recency does not flip a materially better text match", () => {
        // The whole point of the bounded bonus: daily habits break ties, they
        // do not bury the thing you actually typed.
        const store = recentsWith("stale");
        const ranked = rankCommands(
            [
                command("exact", { title: "deploy" }),
                command("stale", { title: "zzz", group: "deploy" }),
                 
            ] as any,
            { text: "deploy", kind: null },
            { recents: store },
        );

        assert.deepEqual(ids(ranked), ["exact", "stale"]);
    });
});

describe("ordering rules", () => {
    test("equal-scoring commands come back alphabetically by title", () => {
        const ranked = rank(
            [
                command("c", { title: "Charlie deploy" }),
                command("a", { title: "Alpha deploy" }),
                command("b", { title: "Bravo deploy" }),
            ],
            "deploy",
        );

        assert.deepEqual(
            ranked.map((r) => r.command.title),
            ["Alpha deploy", "Bravo deploy", "Charlie deploy"],
        );
    });

    test("disabled commands sink below everything selectable", () => {
        const ranked = rank(
            [
                command("off", { title: "deploy alpha", enabled: false }),
                command("on", { title: "deploy zulu" }),
            ],
            "deploy",
        );

        // Alphabetically "alpha" would win; being disabled outweighs that.
        assert.deepEqual(ids(ranked), ["on", "off"]);
    });

    test("a far-from-start match still outranks a non-match", () => {
        // The distance penalty is bounded by a Math.max(score, 1) floor, so a
        // late hit degrades toward 1 rather than falling out of the results.
        const ranked = rank(
            [command("late", { title: `${"x".repeat(60)} deploy` })],
            "deploy",
        );

        assert.equal(ranked.length, 1);
        assert.ok(ranked[0].score >= 1);
    });

    test("an empty query lists everything with recency and priority applied", () => {
        const store = recentsWith("recent");
        const ranked = rankCommands(
            [command("cold"), command("recent")] as never,
            { text: "", kind: null },
            { recents: store },
        );

        assert.deepEqual(ids(ranked), ["recent", "cold"]);
    });

    test("the kind filter drops other lanes", () => {
        const ranked = rankCommands(
            [
                command("a-command", { title: "deploy", kind: "command" }),
                command("a-file", { title: "deploy", kind: "file" }),
                 
            ] as any,
            { text: "deploy", kind: "file" },
            { recents },
        );

        assert.deepEqual(ids(ranked), ["a-file"]);
    });

    test("limit caps the returned rows", () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            command(`c${i}`, { title: `deploy ${i}` }),
        );

        assert.equal(rank(many, "deploy", { limit: 3 }).length, 3);
    });
});

describe("groupRanked and flattenGroups", () => {
    test("flatten(group(x)) keeps every item and preserves order within a group", () => {
        // Note the round-trip is *not* the identity on an interleaved list:
        // grouping's whole job is to make each group contiguous, so "a, b, c"
        // with groups One, Two, One comes back "a, c, b". What is preserved is
        // membership and the relative order inside each group -- which is what
        // makes the flattened list a valid selectable-index order.
        const ranked = rank(
            [
                command("a", { title: "deploy a", group: "One" }),
                command("b", { title: "deploy b", group: "Two" }),
                command("c", { title: "deploy c", group: "One" }),
            ],
            "deploy",
        );

        const flattened = ids(flattenGroups(groupRanked(ranked)));

        assert.deepEqual(flattened, ["a", "c", "b"]);
        assert.deepEqual([...flattened].sort(), [...ids(ranked)].sort());
    });

    test("flatten(group(x)) is the identity on an already-contiguous list", () => {
        const ranked = rank(
            [
                command("a", { title: "deploy a", group: "One" }),
                command("b", { title: "deploy b", group: "One" }),
                command("c", { title: "deploy c", group: "Two" }),
            ],
            "deploy",
        );

        assert.deepEqual(ids(flattenGroups(groupRanked(ranked))), ids(ranked));
    });

    test("groups follow their best-scoring member, not first appearance", () => {
        const ranked = rank(
            [
                command("weak", { title: "zzz", group: "Low", subtitle: "deploy" }),
                command("strong", { title: "deploy", group: "High" }),
            ],
            "deploy",
        );
        const groups = groupRanked(ranked);

        assert.deepEqual(
            groups.map((g) => g.group),
            ["High", "Low"],
        );
    });

    test("members of one group stay contiguous", () => {
        const ranked = rank(
            [
                command("a", { title: "deploy a", group: "One" }),
                command("b", { title: "deploy b", group: "Two" }),
                command("c", { title: "deploy c", group: "One" }),
            ],
            "deploy",
        );
        const groups = groupRanked(ranked);

        assert.equal(groups.length, 2);
        for (const group of groups) {
            assert.ok(group.items.length > 0);
        }
        assert.equal(flattenGroups(groups).length, ranked.length);
    });

    test("ungrouped commands collect under the empty-string group", () => {
        const ranked = rank(
            [
                command("grouped", { title: "deploy a", group: "One" }),
                command("loose", { title: "deploy b" }),
            ],
            "deploy",
        );
        const groups = groupRanked(ranked);

        const ungrouped = groups.find((g) => g.group === "");
        assert.ok(ungrouped, "ungrouped items get their own block");
        assert.deepEqual(ids(ungrouped.items), ["loose"]);
    });

    test("an empty list round-trips to an empty list", () => {
        assert.deepEqual(flattenGroups(groupRanked([])), []);
    });
});
