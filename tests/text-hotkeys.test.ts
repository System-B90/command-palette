import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Imports the built package (the same entry point real consumers resolve).
import { matchText } from "../dist/core/fuzzy.js";
import { matchesShortcut } from "../dist/core/hotkeys.js";
import { isWordStart, normalizeChars } from "../dist/core/text.js";

describe("normalizeChars index alignment", () => {
    test("returns one entry per input code point", () => {
        // This is the contract that makes highlight indices land on the right
        // characters: the matcher maps folded positions back through this
        // array, so a length change silently shifts every highlight.
        const input = "New Event";
        assert.equal(normalizeChars(input).length, Array.from(input).length);
    });

    test("dropped characters become empty strings, not missing slots", () => {
        const chars = normalizeChars("ab'c");

        assert.deepEqual(chars, ["a", "b", "", "c"]);
        assert.equal(chars.length, 4);
    });

    test("Hebrew niqqud drops to empty while the base letters stay aligned", () => {
        const input = "בֵּית";
        const chars = normalizeChars(input);

        assert.equal(chars.length, Array.from(input).length);
        assert.equal(chars.join(""), "בית");
    });

    test("a precomposed accent folds to its base in a single slot", () => {
        assert.deepEqual(normalizeChars("é"), ["e"]);
    });

    test("surrogate pairs stay one slot via Array.from", () => {
        // Array.from iterates code points, so an emoji is one entry rather
        // than two lone surrogates -- otherwise every index after it shifts.
        const chars = normalizeChars("a😀b");

        assert.equal(chars.length, 3);
        assert.equal(chars[1], "😀");
    });

    test("lowercases while preserving slot count", () => {
        assert.deepEqual(normalizeChars("AbC"), ["a", "b", "c"]);
    });

    test("final-form Hebrew letters map to their base form", () => {
        assert.deepEqual(normalizeChars("ךםןףץ"), ["כ", "מ", "נ", "פ", "צ"]);
    });

    test("bidi controls drop to empty", () => {
        const chars = normalizeChars("a‎b");

        assert.deepEqual(chars, ["a", "", "b"]);
    });

    test("a Hangul syllable yields two characters in one slot", () => {
        // Characterization, not endorsement. NFD on U+AC00 produces U+1100 and
        // U+1161 -- both base letters, neither a combining mark -- so this one
        // slot holds two characters and the index alignment the rest of this
        // suite relies on does not hold for Hangul. Latin accents and Hebrew
        // niqqud are mark-based and do align. Pinned so the limit is visible;
        // highlight spans on Hangul titles will be off by one per syllable.
        const chars = normalizeChars("가");

        assert.equal(chars.length, 1);
        assert.equal(Array.from(chars[0]).length, 2);
    });
});

describe("isWordStart", () => {
    test("index 0 always starts a word", () => {
        assert.equal(isWordStart("new event", 0), true);
    });

    test("true after a space, hyphen or slash", () => {
        // These three drive WORD_START_BONUS, which is what makes typing "ne"
        // find "New Event" ahead of a mid-word hit.
        assert.equal(isWordStart("new event", 4), true);
        assert.equal(isWordStart("re-run", 3), true);
        assert.equal(isWordStart("a/b", 2), true);
    });

    test("false mid-word", () => {
        assert.equal(isWordStart("new event", 1), false);
        assert.equal(isWordStart("new event", 5), false);
    });

    test("false after any other separator", () => {
        // Only space, hyphen and slash count; underscores and dots do not.
        assert.equal(isWordStart("a_b", 2), false);
        assert.equal(isWordStart("a.b", 2), false);
    });
});

describe("matchText edge cases", () => {
    test("an empty query matches everything with score 1", () => {
        assert.deepEqual(matchText("", "anything"), { score: 1, indices: [] });
    });

    test("an empty target scores 0", () => {
        assert.deepEqual(matchText("a", ""), { score: 0, indices: [] });
    });

    test("a target that folds to empty is a miss", () => {
        // All quote-marks and bidi controls: nothing survives folding, so
        // there is nothing to match against.
        assert.deepEqual(matchText("a", "'\"`‎"), { score: 0, indices: [] });
    });

    test("a query that folds to empty matches everything", () => {
        // Same code path as a genuinely empty query.
        assert.deepEqual(matchText("'\"", "anything"), { score: 1, indices: [] });
    });

    test("indices point at the original string, not the folded one", () => {
        // The dropped apostrophe must not shift the reported positions.
        const { indices } = matchText("bc", "a'bc");

        assert.deepEqual(indices, [2, 3]);
    });
});

/** Builds a keydown-shaped event; modifiers default to false. */
function keyEvent(key: string, modifiers: Record<string, boolean> = {}) {
    return {
        key,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...modifiers,
         
    } as any;
}

describe("matchesShortcut modifier aliases", () => {
    test("control, option and cmd map to the right event flags", () => {
        assert.equal(
            matchesShortcut(
                keyEvent("p", { ctrlKey: true, altKey: true, metaKey: true }),
                ["Control", "Option", "Cmd", "P"],
            ),
            true,
        );
    });

    test("the command glyph is accepted as a meta alias", () => {
        assert.equal(matchesShortcut(keyEvent("k", { metaKey: true }), ["⌘", "K"]), true);
    });

    test("ctrl and control are interchangeable", () => {
        const event = keyEvent("z", { ctrlKey: true });

        assert.equal(matchesShortcut(event, ["Ctrl", "Z"]), true);
        assert.equal(matchesShortcut(event, ["control", "z"]), true);
    });

    test("accepts a two-modifier chord", () => {
        assert.equal(
            matchesShortcut(
                keyEvent("p", { ctrlKey: true, shiftKey: true }),
                ["Ctrl", "Shift", "P"],
            ),
            true,
        );
    });

    test("rejects the chord when a required modifier is absent", () => {
        assert.equal(
            matchesShortcut(keyEvent("p", { ctrlKey: true }), ["Ctrl", "Shift", "P"]),
            false,
        );
    });

    test("rejects an extra modifier the shortcut did not ask for", () => {
        // The comparison is exact both ways, so Ctrl+Shift+Z does not fire a
        // Ctrl+Z binding.
        assert.equal(
            matchesShortcut(keyEvent("z", { ctrlKey: true, shiftKey: true }), ["Ctrl", "Z"]),
            false,
        );
    });
});

describe("matchesShortcut key comparison", () => {
    test("compares keys case-insensitively", () => {
        assert.equal(matchesShortcut(keyEvent("P", { ctrlKey: true }), ["Ctrl", "p"]), true);
        assert.equal(matchesShortcut(keyEvent("p", { ctrlKey: true }), ["Ctrl", "P"]), true);
    });

    test("rejects a different key", () => {
        assert.equal(matchesShortcut(keyEvent("q", { ctrlKey: true }), ["Ctrl", "P"]), false);
    });

    test("rejects a shortcut made only of modifiers", () => {
        // No non-modifier token means no key to compare, so this can never
        // fire -- otherwise holding Ctrl+Shift alone would trigger it.
        assert.equal(
            matchesShortcut(keyEvent("Control", { ctrlKey: true, shiftKey: true }), [
                "Ctrl",
                "Shift",
            ]),
            false,
        );
    });

    test("rejects an empty shortcut", () => {
        assert.equal(matchesShortcut(keyEvent("p"), []), false);
    });

    test("a bare key with no modifiers matches only a bare press", () => {
        assert.equal(matchesShortcut(keyEvent("Escape"), ["Escape"]), true);
        assert.equal(
            matchesShortcut(keyEvent("Escape", { ctrlKey: true }), ["Escape"]),
            false,
        );
    });

    test("the last non-modifier token wins when several are given", () => {
        // Characterization: `key` is reassigned in the loop rather than
        // rejected, so ["A", "B"] binds B alone.
        assert.equal(matchesShortcut(keyEvent("b"), ["A", "B"]), true);
        assert.equal(matchesShortcut(keyEvent("a"), ["A", "B"]), false);
    });
});
