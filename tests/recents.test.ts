import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

// Imports the built package (the same entry point real consumers resolve).
import { RecentsStore } from "../dist/core/recents.js";

/**
 * Minimal localStorage stub. `failOn` makes a given method throw, standing in
 * for private mode and quota exhaustion.
 */
function stubStorage(
    initial: Record<string, string> = {},
    failOn?: "getItem" | "setItem",
) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem(key: string): null | string {
            if (failOn === "getItem") throw new Error("storage unavailable");
            return data.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
            if (failOn === "setItem") throw new Error("quota exceeded");
            data.set(key, value);
        },
        removeItem(key: string): void {
            data.delete(key);
        },
    };
}

/** Installs a fake `window` for the duration of a test. */
function withWindow(localStorage: unknown): void {
    (globalThis as { window?: unknown }).window = { localStorage };
}

afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
});

const KEY = "command-palette:recents:test-ns";

describe("RecentsStore ordering", () => {
    test("records most-recent-first", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");

        store.record("b");
        store.record("a");

        assert.deepEqual(store.ids(), ["a", "b"]);
    });

    test("re-recording moves to front without duplicating", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");

        store.record("a");
        store.record("b");
        store.record("c");
        store.record("b");

        assert.deepEqual(store.ids(), ["b", "c", "a"]);
    });

    test("evicts the oldest past the 40-entry cap", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");

        for (let i = 0; i < 41; i++) store.record(`cmd-${i}`);

        const ids = store.ids();
        assert.equal(ids.length, 40);
        assert.equal(ids[0], "cmd-40", "newest stays at the front");
        assert.equal(ids.at(-1), "cmd-1", "cmd-0 was evicted");
        assert.ok(!ids.includes("cmd-0"));
    });

    test("clear() empties the history", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");
        store.record("a");

        store.clear();

        assert.deepEqual(store.ids(), []);
    });
});

describe("RecentsStore boost", () => {
    test("gives the most recent id the full bonus", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");
        store.record("a");

        assert.equal(store.boost("a"), 30);
    });

    test("decays with position but stays positive", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");
        store.record("c");
        store.record("b");
        store.record("a");

        const [first, second, third] = ["a", "b", "c"].map((id) => store.boost(id));

        assert.equal(first, 30);
        assert.equal(second, 15);
        assert.equal(third, 10);
        assert.ok(first > second && second > third);
        assert.ok(third > 0, "a stale entry still beats an unrecorded one");
    });

    test("returns 0 for an id that was never recorded", () => {
        withWindow(stubStorage());
        const store = new RecentsStore("test-ns");
        store.record("a");

        assert.equal(store.boost("never-run"), 0);
    });
});

describe("RecentsStore persistence", () => {
    test("writes through under the namespaced key", () => {
        const storage = stubStorage();
        withWindow(storage);

        new RecentsStore("test-ns").record("a");

        assert.equal(storage.data.get(KEY), JSON.stringify(["a"]));
    });

    test("namespaces keep separate histories", () => {
        const storage = stubStorage();
        withWindow(storage);

        new RecentsStore("alpha").record("a");
        new RecentsStore("beta").record("b");

        assert.equal(
            storage.data.get("command-palette:recents:alpha"),
            JSON.stringify(["a"]),
        );
        assert.equal(
            storage.data.get("command-palette:recents:beta"),
            JSON.stringify(["b"]),
        );
    });

    test("a new instance reloads what the previous one stored", () => {
        const storage = stubStorage();
        withWindow(storage);
        new RecentsStore("test-ns").record("a");

        assert.deepEqual(new RecentsStore("test-ns").ids(), ["a"]);
    });

    test("falls back to an empty history on malformed JSON", () => {
        withWindow(stubStorage({ [KEY]: "{not json" }));

        // Corrupt storage must not take the palette down with it.
        assert.deepEqual(new RecentsStore("test-ns").ids(), []);
    });

    test("ignores stored JSON that is not an array", () => {
        withWindow(stubStorage({ [KEY]: JSON.stringify({ ids: ["a"] }) }));

        assert.deepEqual(new RecentsStore("test-ns").ids(), []);
    });

    test("filters non-string entries rather than throwing", () => {
        withWindow(stubStorage({ [KEY]: JSON.stringify(["a", 7, null, "b", {}]) }));

        assert.deepEqual(new RecentsStore("test-ns").ids(), ["a", "b"]);
    });

    test("a throwing getItem degrades to an empty history", () => {
        withWindow(stubStorage({}, "getItem"));

        assert.deepEqual(new RecentsStore("test-ns").ids(), []);
    });

    test("a throwing setItem does not propagate", () => {
        withWindow(stubStorage({}, "setItem"));
        const store = new RecentsStore("test-ns");

        // Private mode / quota exhaustion must not break running a command.
        assert.doesNotThrow(() => store.record("a"));
        // In-memory history still works for the session.
        assert.deepEqual(store.ids(), ["a"]);
    });

    test("clear() empties storage as well as memory", () => {
        const storage = stubStorage();
        withWindow(storage);
        const store = new RecentsStore("test-ns");
        store.record("a");

        store.clear();

        assert.equal(storage.data.get(KEY), JSON.stringify([]));
    });

    test("reads storage only once per instance", () => {
        // `loaded` latches, so a corrupted write by another tab mid-session
        // cannot retroactively empty a live palette's history.
        const storage = stubStorage({ [KEY]: JSON.stringify(["a"]) });
        withWindow(storage);
        const store = new RecentsStore("test-ns");
        assert.deepEqual(store.ids(), ["a"]);

        storage.data.set(KEY, JSON.stringify(["z"]));

        assert.deepEqual(store.ids(), ["a"]);
    });
});

describe("RecentsStore SSR safety", () => {
    test("ids() returns empty with no window", () => {
        // No withWindow() call: this is the server-render path.
        assert.deepEqual(new RecentsStore("test-ns").ids(), []);
    });

    test("record, boost and clear are all no-op-safe with no window", () => {
        const store = new RecentsStore("test-ns");

        assert.doesNotThrow(() => store.record("a"));
        assert.doesNotThrow(() => store.clear());
        // record() still updates memory; only persistence is skipped.
        assert.equal(store.boost("never-run"), 0);
    });
});
