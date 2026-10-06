import { isWordStart, normalizeChars, normalizeText } from "@/core/text.js";

/**
 * The matcher. Hand-rolled rather than pulled from a library so the package
 * carries zero runtime dependencies beyond React/MUI, and so scoring can be
 * tuned for the palette's specific shape (short titles, Hebrew content, a need
 * for per-character match indices to drive highlighting).
 */

export type MatchResult = {
    /** `0` when the query is not a subsequence of the target. Higher is better. */
    score: number;
    /** Indices into the *original* target string that matched. */
    indices: Array<number>;
};

const NO_MATCH: MatchResult = { score: 0, indices: [] };

/** Awarded once when the whole query appears contiguously in the target. */
const CONTIGUOUS_BONUS = 120;
/** Awarded once when that contiguous run also starts a word. */
const PREFIX_BONUS = 90;
/** Per character that continues the previous character's run. */
const RUN_BONUS = 14;
/** Per character that lands on a word boundary. */
const WORD_START_BONUS = 10;
/** Baseline per matched character. */
const CHAR_SCORE = 3;
/** Subtracted per character of distance from the start of the target. */
const DISTANCE_PENALTY = 0.4;
/**
 * Subtracted from a contiguous hit found only once Hebrew vowel letters are
 * folded away, so it lands just below the same hit spelled exactly.
 */
const MATRES_PENALTY = 15;
/** Awarded once when a subsequence fits inside a single word. */
const SINGLE_WORD_BONUS = 30;

/**
 * Hebrew matres lectionis: the vowel letters י and ו that full spelling (ktiv
 * male) adds and defective spelling leaves out, so `שבץ` should still find
 * `שיבוצים` and `תכנן` find `תכנון`.
 */
const MATRES = /[יו]/g;

type Folded = {
    /** Normalised text with dropped characters removed. */
    text: string;
    /** `sourceIndex[i]` is the index in the original string of `text[i]`. */
    sourceIndex: Array<number>;
};

function fold(text: string): Folded {
    const chars = normalizeChars(text);
    let folded = "";
    const sourceIndex: Array<number> = [];

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (!char) continue;
        folded += char;
        sourceIndex.push(i);
    }

    return { text: folded, sourceIndex };
}

/** {@link fold}'s output with the matres lectionis dropped as well. */
function dropMatres({ text, sourceIndex }: Folded): Folded {
    let folded = "";
    const kept: Array<number> = [];

    for (let i = 0; i < text.length; i++) {
        if (text[i] === "י" || text[i] === "ו") continue;
        folded += text[i];
        kept.push(sourceIndex[i]);
    }

    return { text: folded, sourceIndex: kept };
}

function contiguousMatch(
    needle: string,
    { text: haystack, sourceIndex }: Folded,
    penalty: number,
): MatchResult | null {
    const start = haystack.indexOf(needle);
    if (start === -1) return null;

    const indices: Array<number> = [];
    for (let i = 0; i < needle.length; i++) {
        indices.push(sourceIndex[start + i]);
    }

    const score =
        CONTIGUOUS_BONUS +
        (isWordStart(haystack, start) ? PREFIX_BONUS : 0) +
        needle.length * (CHAR_SCORE + RUN_BONUS) -
        start * DISTANCE_PENALTY -
        penalty;

    return { score: Math.max(score, 1), indices };
}

/**
 * Score `query` against `target`.
 *
 * An empty query matches everything with a score of `1`, which lets callers use
 * the same code path for the "nothing typed yet" listing.
 */
export function matchText(query: string, target: string): MatchResult {
    const needle = normalizeText(query);
    if (!needle) return { score: 1, indices: [] };
    if (!target) return NO_MATCH;

    const folded = fold(target);
    if (!folded.text) return NO_MATCH;

    const direct = contiguousMatch(needle, folded, 0);
    if (direct) return direct;

    const bareNeedle = needle.replace(MATRES, "");
    if (bareNeedle) {
        const bare = contiguousMatch(bareNeedle, dropMatres(folded), MATRES_PENALTY);
        if (bare) return bare;
    }

    return subsequenceMatch(needle, folded);
}

/**
 * In-order subsequence fallback: the better of a greedy left-to-right pass
 * over the whole target and the best alignment that fits inside one word, so
 * `שבץ` prefers `שיבוצים` over letters scattered across `לשבת עם ... מקצוע`.
 * Greedy within each span is the standard trade-off here: an optimal alignment
 * would need a DP pass, and for the short strings the palette deals with the
 * greedy pick is indistinguishable in practice.
 */
function subsequenceMatch(needle: string, folded: Folded): MatchResult {
    const haystack = folded.text;
    let best = greedyMatch(needle, folded, 0, haystack.length);

    for (let start = 0; start < haystack.length; start++) {
        if (!isWordStart(haystack, start) || haystack[start] === " ") continue;
        const space = haystack.indexOf(" ", start);
        const end = space === -1 ? haystack.length : space;
        const inWord = greedyMatch(needle, folded, start, end);
        if (inWord.score > 0 && inWord.score + SINGLE_WORD_BONUS > best.score) {
            best = { score: inWord.score + SINGLE_WORD_BONUS, indices: inWord.indices };
        }
    }

    return best;
}

/** Greedy left-to-right subsequence match of `needle` within `[from, to)`. */
function greedyMatch(
    needle: string,
    { text: haystack, sourceIndex }: Folded,
    from: number,
    to: number,
): MatchResult {
    const indices: Array<number> = [];
    let score = 0;
    let needleIndex = 0;
    let previousMatch = -2;

    for (let i = from; i < to && needleIndex < needle.length; i++) {
        if (haystack[i] !== needle[needleIndex]) continue;

        score += CHAR_SCORE;
        if (previousMatch === i - 1) score += RUN_BONUS;
        if (isWordStart(haystack, i)) score += WORD_START_BONUS;
        if (needleIndex === 0) score -= i * DISTANCE_PENALTY;

        indices.push(sourceIndex[i]);
        previousMatch = i;
        needleIndex++;
    }

    // Every query character must be consumed for the match to count.
    if (needleIndex < needle.length) return NO_MATCH;

    return { score: Math.max(score, 1), indices };
}
