import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Imports the built package (the same entry point real consumers resolve)
// rather than src/, so these tests exercise what actually ships. Only the
// React-free `core/` half is covered here — the dialog needs a DOM.
import { matchText } from "../dist/core/fuzzy.js";
import { matchesShortcut } from "../dist/core/hotkeys.js";
import { buildRawQuery, parseQuery } from "../dist/core/modes.js";
import { groupRanked, rankCommands } from "../dist/core/rank.js";
import { RecentsStore } from "../dist/core/recents.js";
import { CommandRegistry } from "../dist/core/registry.js";
import { normalizeText } from "../dist/core/text.js";

const noop = () => {};

/** `RecentsStore` degrades to an empty history without a `window`, which is what these tests want. */
const recents = new RecentsStore("test");

describe("normalizeText", () => {
    test("lowercases and collapses whitespace", () => {
        assert.equal(normalizeText("  New   Event  "), "new event");
    });

    test("folds Latin diacritics onto their base letters", () => {
        assert.equal(normalizeText("Résumé"), "resume");
    });

    test("drops Hebrew niqqud and quote-likes", () => {
        assert.equal(normalizeText('בֵּית"ר'), "ביתר");
    });

    test("unifies Hebrew final forms", () => {
        assert.equal(normalizeText("ירושלים"), "ירושלימ");
    });
});

describe("matchText", () => {
    test("an empty query matches anything", () => {
        assert.equal(matchText("", "anything").score, 1);
    });

    test("reports indices into the original string", () => {
        const { score, indices } = matchText("event", "New Event");
        assert.ok(score > 0);
        assert.deepEqual(indices, [4, 5, 6, 7, 8]);
    });

    test("matches out-of-order-free subsequences", () => {
        const { score, indices } = matchText("ne", "New Event");
        assert.ok(score > 0);
        assert.deepEqual(indices, [0, 1]);
    });

    test("does not match when a query character is missing", () => {
        assert.equal(matchText("zzz", "New Event").score, 0);
    });

    test("a contiguous prefix hit outranks a scattered one", () => {
        const prefix = matchText("new", "New Event").score;
        const scattered = matchText("new", "Nested Weekly view").score;
        assert.ok(prefix > scattered);
    });

    test("matches Hebrew text past its niqqud", () => {
        assert.ok(matchText("בית", 'בֵּית"ר').score > 0);
    });
});

describe("parseQuery / buildRawQuery", () => {
    test("splits a lane prefix off the text", () => {
        assert.deepEqual(parseQuery(">new"), { kind: "command", text: "new" });
        assert.deepEqual(parseQuery("@bob"), { kind: "entity", text: "bob" });
        assert.deepEqual(parseQuery(":settings"), {
            kind: "goto",
            text: "settings",
        });
    });

    test("an unprefixed query searches every lane", () => {
        assert.deepEqual(parseQuery("new"), { kind: null, text: "new" });
    });

    test("round-trips through buildRawQuery", () => {
        assert.equal(buildRawQuery("command", "new"), ">new");
        assert.equal(buildRawQuery(null, "new"), "new");
        assert.deepEqual(parseQuery(buildRawQuery("entity", "bob")), {
            kind: "entity",
            text: "bob",
        });
    });
});

describe("CommandRegistry", () => {
    test("collects from every registered source", () => {
        const registry = new CommandRegistry();
        registry.register("a", [{ id: "a1", title: "A one", run: noop }]);
        registry.register("b", () => [{ id: "b1", title: "B one", run: noop }]);

        assert.deepEqual(
            registry.collect({ text: "", kind: null }).map((c) => c.id),
            ["a1", "b1"],
        );
    });

    test("unregistering removes that source's commands", () => {
        const registry = new CommandRegistry();
        const unregister = registry.register("a", [
            { id: "a1", title: "A one", run: noop },
        ]);
        unregister();

        assert.deepEqual(registry.collect({ text: "", kind: null }), []);
    });

    test("the first contributor of an id wins", () => {
        const registry = new CommandRegistry();
        registry.register("a", [{ id: "dup", title: "First", run: noop }]);
        registry.register("b", [{ id: "dup", title: "Second", run: noop }]);

        const collected = registry.collect({ text: "", kind: null });
        assert.equal(collected.length, 1);
        assert.equal(collected[0].title, "First");
    });

    test("notifies subscribers on change", () => {
        const registry = new CommandRegistry();
        let notifications = 0;
        registry.subscribe(() => notifications++);

        const unregister = registry.register("a", []);
        unregister();

        assert.equal(notifications, 2);
    });

    test("run() invokes a contributed command by id", () => {
        const registry = new CommandRegistry();
        let ran = false;
        registry.register("a", [
            { id: "a1", title: "A one", run: () => (ran = true) },
            {
                id: "a2",
                title: "Disabled",
                enabled: false,
                run: () => assert.fail("disabled command ran"),
            },
        ]);

        registry.run("a1");
        registry.run("a2");
        assert.equal(ran, true);
    });
});

describe("rankCommands", () => {
    const commands = [
        { id: "new", title: "New Event", group: "Schedule", run: noop },
        {
            id: "settings",
            title: "Open Settings",
            keywords: ["prefs"],
            group: "App",
            run: noop,
        },
        {
            id: "goto",
            title: "Go To Today",
            kind: "goto" as const,
            group: "App",
            run: noop,
        },
    ];

    test("filters to the queried lane", () => {
        const ranked = rankCommands(commands, { text: "", kind: "goto" }, {
            recents,
        });
        assert.deepEqual(ranked.map((r) => r.command.id), ["goto"]);
    });

    test("ranks a title hit above a keyword-only hit", () => {
        const ranked = rankCommands(
            [
                { id: "keyword", title: "Unrelated", keywords: ["event"], run: noop },
                { id: "title", title: "New Event", run: noop },
            ],
            { text: "event", kind: null },
            { recents },
        );
        assert.equal(ranked[0].command.id, "title");
    });

    test("matches hidden keywords", () => {
        const ranked = rankCommands(commands, { text: "prefs", kind: null }, {
            recents,
        });
        assert.equal(ranked[0].command.id, "settings");
    });

    test("keeps disabled commands but sorts them last", () => {
        const ranked = rankCommands(
            [
                { id: "off", title: "New Event", enabled: false, run: noop },
                { id: "on", title: "New Event Copy", run: noop },
            ],
            { text: "new", kind: null },
            { recents },
        );
        assert.deepEqual(ranked.map((r) => r.command.id), ["on", "off"]);
    });

    test("honours the result limit", () => {
        const many = Array.from({ length: 10 }, (_, i) => ({
            id: `c${i}`,
            title: `Command ${i}`,
            run: noop,
        }));
        assert.equal(
            rankCommands(many, { text: "", kind: null }, { recents, limit: 3 })
                .length,
            3,
        );
    });

    test("groups follow their best-scoring member", () => {
        const groups = groupRanked(
            rankCommands(commands, { text: "settings", kind: null }, {
                recents,
            }),
        );
        assert.equal(groups[0].group, "App");
    });
});

describe("matchesShortcut", () => {
    const event = (init: Partial<KeyboardEvent>) =>
        ({
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
            ...init,
        }) as KeyboardEvent;

    test("matches a modifier chord case-insensitively", () => {
        assert.equal(
            matchesShortcut(event({ ctrlKey: true, key: "z" }), ["Ctrl", "Z"]),
            true,
        );
    });

    test("rejects an extra modifier", () => {
        assert.equal(
            matchesShortcut(event({ ctrlKey: true, shiftKey: true, key: "z" }), [
                "Ctrl",
                "Z",
            ]),
            false,
        );
    });

    test("rejects a missing modifier", () => {
        assert.equal(matchesShortcut(event({ key: "z" }), ["Ctrl", "Z"]), false);
    });

    test("an empty shortcut never matches", () => {
        assert.equal(matchesShortcut(event({ key: "z" }), []), false);
    });
});
