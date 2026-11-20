import { BOM, encodeBase64, encodeBase64URL, encodeHex } from '@src/core'
import { BASE64_LOOKUP, HEX_ALPHABET, HEX_LOOKUP } from '../src/core/constants.js'

/** Builds the distinct prefixes of every fixed-width word in least-significant-digit order. */
export function buildCodecTexts(characters: readonly string[], width: number): readonly string[] {
	const words = Array.from({ length: characters.length ** width }, (_, index) => {
		const parts = Array.from(
			{ length: width },
			(_character, position) =>
				characters[Math.floor(index / characters.length ** position) % characters.length] ?? '',
		)
		return parts.map((_part, position) => parts.slice(0, position + 1).join(''))
	})
	return [...new Set(['', ...words.flat()])]
}

/**
 * Draws a xorshift32 stream from a seed, each draw an unsigned 32-bit integer.
 *
 * The stream is a pure function of the seed, so a population drawn from it is identical on every
 * host and every run, which `Math.random` cannot promise.
 */
export function buildDraws(seed: number, count: number): readonly number[] {
	const draws = new Uint32Array(count)
	let state = seed
	for (let index = 0; index < count; index++) {
		const left = state ^ (state << 13)
		const right = left ^ (left >>> 17)
		state = (right ^ (right << 5)) >>> 0
		draws[index] = state
	}
	return Array.from(draws)
}

/** Transcribes the RFC 4648 §4 alphabet from the specification. */
export const RFC_STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** Transcribes the RFC 4648 §5 url alphabet from the specification. */
export const RFC_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** Carries every octet value in one buffer. */
export const OCTETS = Uint8Array.from({ length: 256 }, (_value, index) => index)
/** Carries the sextet population, so an alphabet sweep reads one index per character. */
export const SEXTETS = Array.from({ length: 64 }, (_value, index) => index)

/**
 * Carries every octet's hex spelling, in octet order.
 *
 * The digits come from the language's own radix conversion rather than from this package's table,
 * so the hex sweep compares `encodeHex` against a mechanism that can disagree with it instead of
 * re-deriving the answer the way the source does.
 */
export const HEX_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	byte.toString(16).padStart(2, '0'),
)

/** Names canonical vectors: one value, its §4 spelling, and its §5 spelling. */
export const VECTORS: ReadonlyArray<{
	readonly name: string
	readonly bytes: readonly number[]
	readonly standard: string
	readonly url: string
}> = [
	{ name: 'the empty sequence', bytes: [], standard: '', url: '' },
	{ name: 'hi', bytes: [104, 105], standard: 'aGk=', url: 'aGk' },
	{
		name: 'the alphabet-splitting bytes',
		bytes: [0xfb, 0xff, 0xbf],
		standard: '+/+/',
		url: '-_-_',
	},
	{ name: 'one byte', bytes: [0x69], standard: 'aQ==', url: 'aQ' },
	{ name: 'a full group of zeros', bytes: [0, 0, 0], standard: 'AAAA', url: 'AAAA' },
]

/**
 * Mixes admitted and refused texts, each row stating what both faces owe it.
 *
 * The expectations are written out rather than derived, so a decoder that starts admitting a
 * refused form fails here instead of agreeing with itself.
 */
export const MEMBERSHIP: ReadonlyArray<{
	readonly text: string
	readonly standard: boolean
	readonly url: boolean
	readonly reason: string
}> = [
	{ text: '', standard: true, url: true, reason: 'the empty text' },
	{ text: 'AAAA', standard: true, url: true, reason: 'a group both alphabets spell alike' },
	{ text: 'aGk=', standard: true, url: false, reason: 'padding, which §5 has none of' },
	{ text: 'aGk', standard: false, url: true, reason: 'no padding, which §4 requires' },
	{ text: '+/+/', standard: true, url: false, reason: 'the §4 characters' },
	{ text: '-_-_', standard: false, url: true, reason: 'the §5 characters' },
	{ text: 'aQ==', standard: true, url: false, reason: 'the canonical spelling of 0x69' },
	{ text: 'aQ', standard: false, url: true, reason: 'the §5 spelling of 0x69' },
	{ text: 'aa==', standard: false, url: false, reason: 'a non-zero unused trailing bit' },
	{ text: 'aa', standard: false, url: false, reason: 'a non-zero unused trailing bit' },
	{ text: 'AB==', standard: false, url: false, reason: 'the two-pad unused bit 0x01' },
	{ text: 'AI==', standard: false, url: false, reason: 'the two-pad unused bit 0x08' },
	{ text: 'AC==', standard: false, url: false, reason: 'the two-pad unused bit 0x02' },
	{ text: 'AAB=', standard: false, url: false, reason: 'the one-pad unused bit 0x01' },
	{ text: 'AA==', standard: true, url: false, reason: 'the padded two-character residue' },
	{ text: 'AA', standard: false, url: true, reason: 'the unpadded two-character residue' },
	{ text: 'AQ D', standard: false, url: false, reason: 'whitespace' },
	{ text: 'A', standard: false, url: false, reason: 'a length off the group boundary' },
	{ text: 'AQID=', standard: false, url: false, reason: 'padding off the group boundary' },
	{ text: '====', standard: false, url: false, reason: 'padding with no data' },
	{ text: 'A===', standard: false, url: false, reason: 'padding wider than the group allows' },
	{ text: 'AA=A', standard: false, url: false, reason: 'padding inside the group' },
	{
		text: 'AAAA\n',
		standard: false,
		url: false,
		reason: 'a trailing newline, refused at the length residue',
	},
]

/**
 * Mixes admitted and refused hex texts, each row stating the bytes the §8 face owes it.
 *
 * `bytes` carries the decoded sequence for an admitted text and `undefined` for a refused one, so
 * one row pins `isHex` and `decodeHex` to the same answer. Each `reason` names the rule that
 * actually refuses the text: an odd length is read before any character is looked up, so `'a b'`
 * and `'ab\n'` never reach their whitespace.
 */
export const HEX_MEMBERSHIP: ReadonlyArray<{
	readonly text: string
	readonly bytes: readonly number[] | undefined
	readonly reason: string
}> = [
	{ text: 'ab', bytes: [0xab], reason: 'the canonical lowercase spelling' },
	{ text: '', bytes: [], reason: 'the empty text' },
	{ text: 'AB', bytes: undefined, reason: 'uppercase, which re-encodes as ab' },
	{ text: 'aB', bytes: undefined, reason: 'one uppercase digit' },
	{ text: 'abc', bytes: undefined, reason: 'an odd length' },
	{ text: '0xab', bytes: undefined, reason: 'a 0x prefix' },
	{ text: 'a b', bytes: undefined, reason: 'whitespace, refused at the odd length' },
	{ text: 'ab\n', bytes: undefined, reason: 'a trailing newline, refused at the odd length' },
	{ text: 'g0', bytes: undefined, reason: 'a character outside the alphabet' },
]

/**
 * Characters spanning the hex alphabet, its uppercase spelling, and characters it does not hold.
 *
 * `A` and `F` witness the uppercase refusal at both ends of the letter range; `x`, the space, and
 * the newline are characters the alphabet lacks, so lookup pollution fails the canonical sweep.
 */
export const HEX_SWEEP_CHARACTERS: readonly string[] = [
	'0',
	'9',
	'a',
	'f',
	'A',
	'F',
	'x',
	' ',
	'\n',
]

/** Deduplicates the hex sweep population. */
export const HEX_SWEEP: readonly string[] = buildCodecTexts(HEX_SWEEP_CHARACTERS, 4)

/**
 * Names measure vectors: one text and the decoded byte length each Base64 face owes it.
 *
 * The table carries a column per face, the way {@link MEMBERSHIP} does, because the padding a text
 * carries moves the `standard` and `url` answers in opposite directions: `'aGk='` measures on §4
 * and is refused on §5, and `'aGk'` measures on §5 and is refused on §4. A refused text owes
 * `undefined`.
 */
export const MEASURES: ReadonlyArray<{
	readonly text: string
	readonly standard: number | undefined
	readonly url: number | undefined
	readonly reason: string
}> = [
	{ text: '', standard: 0, url: 0, reason: 'the empty text' },
	{ text: 'aGk=', standard: 2, url: undefined, reason: 'one pad character, which §5 has none of' },
	{ text: 'aGk', standard: undefined, url: 2, reason: 'no padding, which §4 requires' },
	{ text: 'AQID', standard: 3, url: 3, reason: 'a full group both faces spell alike' },
	{ text: 'aa==', standard: undefined, url: undefined, reason: 'a non-zero unused trailing bit' },
	{ text: 'aa', standard: undefined, url: undefined, reason: 'that bit without the padding' },
	{
		text: 'A',
		standard: undefined,
		url: undefined,
		reason: 'a length off the group boundary no padding completes',
	},
]

/** Names hex measure vectors: one §8 text and the decoded byte length it owes, or `undefined`. */
export const HEX_MEASURES: ReadonlyArray<{
	readonly text: string
	readonly length: number | undefined
	readonly reason: string
}> = [
	{ text: '', length: 0, reason: 'the empty text' },
	{ text: 'ab', length: 1, reason: 'one byte' },
	{ text: 'abcd', length: 2, reason: 'two bytes' },
	{ text: 'AB', length: undefined, reason: 'uppercase, which re-encodes as ab' },
	{ text: 'abc', length: undefined, reason: 'an odd length' },
]

/** Values no guard may narrow, none of which is a string. */
export const FOREIGN: readonly unknown[] = [
	undefined,
	null,
	0,
	4,
	Number.NaN,
	true,
	{},
	[],
	['aGk='],
	new Uint8Array([104, 105]),
	Symbol('aGk='),
]

/**
 * Characters spanning both alphabets, the pad, and characters neither alphabet holds.
 *
 * B and h witness the low and high unused-bit positions in both pad classes; `*` is a character
 * neither alphabet holds, so lookup pollution fails the canonical sweep.
 */
export const SWEEP_CHARACTERS: readonly string[] = [
	'A',
	'Q',
	'a',
	'q',
	'B',
	'h',
	'0',
	'+',
	'/',
	'-',
	'_',
	'=',
	' ',
	'*',
]

/** Deduplicates the sweep population. */
export const SWEEP: readonly string[] = buildCodecTexts(SWEEP_CHARACTERS, 4)

// ── The measure mutant population ────────────────────────────────────────────
//
// The sweep populations reach four characters, so every refused text a measure meets there is short
// enough that a grammar walk and a length arithmetic agree by accident. The mutants are longer: each
// one is a canonical encoding of an octet prefix carrying exactly one substitution, insertion, or
// truncation, so a refusal lands deep inside a text whose prefix is admissible.
//
// The generator is a written-out xorshift32 over a constant seed rather than `Math.random`, so the
// population is identical on every host and every run. The draws are produced first and consumed
// second, which keeps the state advance in one place.

/** The characters a mutant can carry: both Base64 alphabets, the pad, uppercase hex, and foreigners. */
const MUTANT_CHARACTERS = 'AQaqBh09fF+/-_= \n*x'
/** The longest octet prefix the mutant bases encode. */
const MUTANT_PREFIX = 24
/** The mutants drawn per base encoding. */
const MUTANT_ROUNDS = 8
/** The xorshift32 seed, constant so the population never moves. */
const MUTANT_SEED = 0x1252c0de

// The draws per mutant are the mutation, the position, and the character, over every base.
const MUTANT_DRAWS = buildDraws(MUTANT_SEED, MUTANT_PREFIX * 3 * MUTANT_ROUNDS * 3)

const MUTANT_BASES = Array.from({ length: MUTANT_PREFIX }, (_, index) => {
	const bytes = OCTETS.slice(0, index + 1)
	return [encodeBase64(bytes), encodeBase64URL(bytes), encodeHex(bytes)].flatMap((base, face) => [
		base,
		...Array.from({ length: MUTANT_ROUNDS }, (_draw, round) => {
			const cursor = ((index * 3 + face) * MUTANT_ROUNDS + round) * 3
			const mutation = (MUTANT_DRAWS[cursor] ?? 0) % 3
			const position = (MUTANT_DRAWS[cursor + 1] ?? 0) % base.length
			const character = MUTANT_CHARACTERS.charAt(
				(MUTANT_DRAWS[cursor + 2] ?? 0) % MUTANT_CHARACTERS.length,
			)
			return mutation === 0
				? base.slice(0, position) + character + base.slice(position + 1)
				: mutation === 1
					? base.slice(0, position) + character + base.slice(position)
					: base.slice(0, position)
		}),
	])
})

/**
 * Carries the deterministic mutant population: canonical encodings of octet prefixes, each also
 * present under one substitution, insertion, or truncation.
 *
 * Every measure sweeps every mutant, whichever face produced the base. The sound-triple law holds
 * over every string rather than over one face's own texts, so a §4 mutant is a refused hex text and
 * a hex mutant is a refused §5 text, and each measure owes `undefined` on both walks for it.
 */
export const MEASURE_MUTANTS: readonly string[] = [...new Set(MUTANT_BASES.flat())]

/**
 * Collects every text the Base64 measure law sweeps: the sweep population, both tables, and the
 * mutants.
 */
export const MEASURE_TEXTS: readonly string[] = [
	...SWEEP,
	...MEMBERSHIP.map((row) => row.text),
	...MEASURES.map((row) => row.text),
	...MEASURE_MUTANTS,
]

/**
 * Collects every text the hex measure law sweeps: the hex sweep population, both tables, and the
 * mutants.
 */
export const HEX_MEASURE_TEXTS: readonly string[] = [
	...HEX_SWEEP,
	...HEX_MEMBERSHIP.map((row) => row.text),
	...HEX_MEASURES.map((row) => row.text),
	...MEASURE_MUTANTS,
]

// ── The charset oracles ──────────────────────────────────────────────────────
//
// Each oracle is a mechanism that can disagree with the face it reads. Where a face walks its own
// tables, the oracle is the platform's coding. Where a face delegates to the platform, as
// `decodeUTF8` does, the oracle is the walk that face shipped before it delegated, which reads no
// platform table. Every platform oracle was probed before the sweeps were written to it,
// and each divergence the probe found is recorded on the oracle it belongs to. The suite restricts
// an oracle to the population it agrees with and asserts the divergent class directly.
//
// The three divergences, all confirmed by probe on this host:
//
// - `TextDecoder('latin1')` reports `encoding === 'windows-1252'` and answers U+20AC for 0x80. The
//   WHATWG `latin1` label IS windows-1252, so it is never the ISO-8859-1 oracle. The identity is:
//   LATIN1_OCTETS is built from `String.fromCharCode`, which is the coding's own definition.
// - `TextDecoder('windows-1252')` maps 0x81, 0x8D, 0x8F, 0x90, and 0x9D to their C1 controls rather
//   than refusing them, and `{ fatal: true }` does not change that — the probe read `ok` for every
//   one of those slots under the fatal flag. So WINDOWS_1252_OCTETS is the oracle over the whole
//   byte range and WINDOWS_1252_UNDEFINED names the bytes the sweep must exclude and pin directly.
// - A fatal `TextDecoder` STRIPS a leading BOM unless `ignoreBOM` is set: the probe read length 2
//   for `EF BB BF 68 69` by default and length 3 with `ignoreBOM: true`. The UTF-16LE oracle and
//   `decodeUTF8` set it, because this package's round-trip law leaves its decoders no byte they may
//   discard.
//
// `TextEncoder` is the UTF-8 encode oracle over well-formed text alone: the probe read `EF BF BD`
// for a lone surrogate, so it replaces where `encodeUTF8` refuses.

const UTF16LE_DECODER = new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true })
const WINDOWS_1252_DECODER = new TextDecoder('windows-1252')
const UTF8_ENCODER = new TextEncoder()

/**
 * Decodes strict UTF-8 by walking the RFC 3629 grammar code point by code point, the walk
 * `decodeUTF8` shipped in codec 0.0.12, answering `undefined` for every refused sequence.
 *
 * `decodeUTF8` delegates to the host's fatal decoder, so this walk is the second mechanism that can
 * disagree with it: it reads no platform table, keeps a leading BOM because it discards no byte,
 * and returns `undefined` where the host throws.
 */
export function decodeUTF8Oracle(bytes: Uint8Array): string | undefined {
	const text: string[] = []
	const positions = Array.from({ length: bytes.length }).keys()
	for (const index of positions) {
		const lead = bytes[index] ?? 0
		const width =
			lead < 0x80
				? 1
				: lead >= 0xc2 && lead <= 0xdf
					? 2
					: lead >= 0xe0 && lead <= 0xef
						? 3
						: lead >= 0xf0 && lead <= 0xf4
							? 4
							: 0
		if (width === 0 || index + width > bytes.length) return undefined
		const point = positions.take(width - 1).reduce<number | undefined>(
			(value, position) => {
				if (value === undefined) return undefined
				const continuation = bytes[position] ?? 0
				return (continuation & 0xc0) === 0x80 ? (value << 6) | (continuation & 0x3f) : undefined
			},
			width === 1 ? lead : lead & (0xff >> (width + 1)),
		)
		if (point === undefined) return undefined
		if (width === 3 && point < 0x800) return undefined
		if (width === 4 && point < 0x10000) return undefined
		if (point >= 0xd800 && point <= 0xdfff) return undefined
		if (point > 0x10ffff) return undefined
		text.push(String.fromCodePoint(point))
	}
	return text.join('')
}

/**
 * Decodes bytes through the platform's strict UTF-16LE decoder, reporting a refusal as `undefined`.
 *
 * The decoder keeps the leading BOM, for the same reason `decodeUTF8Oracle` does.
 */
export function decodeUTF16LEOracle(bytes: Uint8Array): string | undefined {
	try {
		return UTF16LE_DECODER.decode(bytes)
	} catch {
		return undefined
	}
}

/** Encodes well-formed text through the platform's UTF-8 encoder, which cannot report a refusal. */
export function encodeUTF8Oracle(text: string): Uint8Array {
	return UTF8_ENCODER.encode(text)
}

/**
 * Builds bytes whose own `Symbol.iterator` yields `yielded` instead of the indexed bytes, so a test
 * reads whether a function takes the bytes by index or through the iterator.
 */
export function createIteratedBytes(
	values: readonly number[],
	yielded: readonly number[],
): Uint8Array<ArrayBuffer> {
	const bytes = Uint8Array.from(values)
	const iterator = [...yielded]
	Object.defineProperty(bytes, Symbol.iterator, { value: iterator[Symbol.iterator].bind(iterator) })
	return bytes
}

/** Measures UTF-8 by reducing over code points, the walk `measureUTF8` shipped in codec 0.0.12. */
export function measureUTF8Oracle(text: string): number | undefined {
	if (!text.isWellFormed()) return undefined
	return Iterator.from(text).reduce((total, character) => {
		const point = character.codePointAt(0) ?? 0
		return total + (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4)
	}, 0)
}

/** Measures hex text a digit pair at a time, the walk `measureHex` shipped in codec 0.0.12. */
export function measureHexOracle(text: string): number | undefined {
	if (text.length % 2 !== 0) return undefined
	for (const position of Array.from({ length: text.length / 2 }).keys()) {
		const index = position * 2
		const high = HEX_LOOKUP[text.charAt(index)]
		const low = HEX_LOOKUP[text.charAt(index + 1)]
		if (high === undefined || low === undefined) return undefined
	}
	return text.length / 2
}

/** Measures Base64 text a group at a time, the walk `measureBase64` shipped in codec 0.0.12. */
export function measureBase64Oracle(text: string): number | undefined {
	if (text.length % 4 !== 0) return undefined
	const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0
	for (const group of Array.from({ length: text.length / 4 }).keys()) {
		const index = group * 4
		const tail = text.length - index === 4 ? padding : 0
		const first = BASE64_LOOKUP[text.charAt(index)]
		const second = BASE64_LOOKUP[text.charAt(index + 1)]
		const third = tail === 2 ? 0 : BASE64_LOOKUP[text.charAt(index + 2)]
		const fourth = tail === 0 ? BASE64_LOOKUP[text.charAt(index + 3)] : 0
		if (first === undefined || second === undefined) return undefined
		if (third === undefined || fourth === undefined) return undefined
		if (tail === 2 && (second & 0x0f) !== 0) return undefined
		if (tail === 1 && (third & 0x03) !== 0) return undefined
	}
	return (text.length / 4) * 3 - padding
}

/** Encodes bytes as hex through an iterator chain, the walk `encodeHex` shipped in codec 0.0.12. */
export function encodeHexOracle(bytes: Uint8Array): string {
	return Iterator.from(bytes)
		.map((byte) => HEX_ALPHABET.charAt((byte >> 4) & 0x0f) + HEX_ALPHABET.charAt(byte & 0x0f))
		.toArray()
		.join('')
}

/**
 * Carries every octet's ISO-8859-1 character, in octet order, read from the coding's own identity.
 */
export const LATIN1_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	String.fromCharCode(byte),
)

/**
 * Carries every octet's Windows-1252 character according to the WHATWG index, in octet order.
 *
 * The index defines an entry for every byte, so the slots this coding refuses carry their C1 control
 * here. {@link WINDOWS_1252_UNDEFINED} names them, and the sweep excludes them.
 */
export const WINDOWS_1252_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	WINDOWS_1252_DECODER.decode(new Uint8Array([byte])),
)

/**
 * Lists the Windows-1252 slots that name no character, written out rather than derived.
 *
 * These are the bytes `decodeWindows1252` refuses and the platform oracle admits, so they are both
 * the divergence the sweep excludes and the refusal the suite pins directly.
 */
export const WINDOWS_1252_UNDEFINED: readonly number[] = Object.freeze([
	0x81, 0x8d, 0x8f, 0x90, 0x9d,
])

/**
 * Transcribes the published Windows-1252 high band here, by hand, from the code page's own table.
 *
 * This is the second mechanism for `WINDOWS_1252_HIGH` in `src/core/constants.ts`, the way
 * {@link RFC_STANDARD} is the second mechanism for the Base64 alphabet. The platform oracle cannot
 * play that part alone: the WHATWG index defines all 256 slots, so it is silent on exactly the
 * omissions that make this code page what it is. Transcribe an entry here from the published table
 * and never from the source table — a copy of the source proves the source agrees with itself.
 *
 * Each value is the character rather than its code point, so the two tables disagree in shape as
 * well as in provenance and a digit transposed in either one reddens the comparison. The comment
 * beside each entry is the character's Unicode name, which is what a reader audits the glyph
 * against. The slots 0x81, 0x8D, 0x8F, 0x90, and 0x9D carry no entry, because the code page defines
 * none.
 */
export const WINDOWS_1252_INDEX: Readonly<Record<string, string>> = Object.freeze({
	0x80: '€', // EURO SIGN
	0x82: '‚', // SINGLE LOW-9 QUOTATION MARK
	0x83: 'ƒ', // LATIN SMALL LETTER F WITH HOOK
	0x84: '„', // DOUBLE LOW-9 QUOTATION MARK
	0x85: '…', // HORIZONTAL ELLIPSIS
	0x86: '†', // DAGGER
	0x87: '‡', // DOUBLE DAGGER
	0x88: 'ˆ', // MODIFIER LETTER CIRCUMFLEX ACCENT
	0x89: '‰', // PER MILLE SIGN
	0x8a: 'Š', // LATIN CAPITAL LETTER S WITH CARON
	0x8b: '‹', // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
	0x8c: 'Œ', // LATIN CAPITAL LIGATURE OE
	0x8e: 'Ž', // LATIN CAPITAL LETTER Z WITH CARON
	0x91: '‘', // LEFT SINGLE QUOTATION MARK
	0x92: '’', // RIGHT SINGLE QUOTATION MARK
	0x93: '“', // LEFT DOUBLE QUOTATION MARK
	0x94: '”', // RIGHT DOUBLE QUOTATION MARK
	0x95: '•', // BULLET
	0x96: '–', // EN DASH
	0x97: '—', // EM DASH
	0x98: '˜', // SMALL TILDE
	0x99: '™', // TRADE MARK SIGN
	0x9a: 'š', // LATIN SMALL LETTER S WITH CARON
	0x9b: '›', // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
	0x9c: 'œ', // LATIN SMALL LIGATURE OE
	0x9e: 'ž', // LATIN SMALL LETTER Z WITH CARON
	0x9f: 'Ÿ', // LATIN CAPITAL LETTER Y WITH DIAERESIS
})

// ── The charset populations ──────────────────────────────────────────────────

/**
 * Characters spanning every UTF-8 width threshold, the BOM, and the code page's own bands.
 *
 * The thresholds are the code points where the encoded width changes — U+0000, U+007F, U+0080,
 * U+07FF, U+0800, U+FFFF, U+10000, and U+10FFFF — so a width rule that shifts by one lands on a
 * member here. U+FEFF is the BOM, carried as an ordinary character. U+0081 is a Windows-1252
 * undefined slot on the text side, U+20AC is a defined high slot, and U+00FF and U+0100 straddle
 * the Latin-1 ceiling. U+D7FF and U+E000 straddle the surrogate range: each is a well-formed
 * character one code point outside it, so a range check written with the wrong comparison refuses a
 * member here rather than passing on a population that never approaches the boundary.
 */
export const TEXT_CHARACTERS: readonly string[] = [
	'\u0000',
	'h',
	'\u007f',
	'\u0080',
	'\u0081',
	'ÿ',
	'Ā',
	'\u07ff',
	'\u0800',
	'€',
	'\ud7ff',
	'\ue000',
	'\ufeff',
	'\uffff',
	'\u{10000}',
	'\u{10ffff}',
]

/** Deduplicates the well-formed text population. */
export const TEXTS: readonly string[] = buildCodecTexts(TEXT_CHARACTERS, 3)

/** Carries ill-formed texts, each with a surrogate no coding over code points can spell. */
export const ILL_FORMED: ReadonlyArray<{ readonly text: string; readonly reason: string }> = [
	{ text: '\ud800', reason: 'a lone lead surrogate' },
	{ text: '\udfff', reason: 'a lone trail surrogate' },
	{ text: 'a\ud800', reason: 'a trailing lead surrogate' },
	{ text: '\ud800a', reason: 'a lead surrogate followed by a BMP character' },
	{ text: '\udc00\ud800', reason: 'a reversed surrogate pair' },
	{ text: '\ud800\ud800', reason: 'two lead surrogates' },
]

/**
 * Carries the UTF-8 width thresholds and the surrogate-range outer boundaries, each with the byte
 * length its code point encodes to.
 *
 * The thresholds are where the encoded width changes, so a width rule off by one lands on a row
 * here. U+D7FF and U+E000 are not thresholds: they sit one code point on either side of the
 * surrogate range, so the per-position mutation sweep driven from this table reaches the encoded
 * surrogates from a canonical neighbour rather than from a written-out refusal row.
 */
export const UTF8_BOUNDARIES: ReadonlyArray<{
	readonly point: number
	readonly width: number
	readonly reason: string
}> = [
	{ point: 0x0000, width: 1, reason: 'the first one-byte code point' },
	{ point: 0x007f, width: 1, reason: 'the last one-byte code point' },
	{ point: 0x0080, width: 2, reason: 'the first two-byte code point' },
	{ point: 0x07ff, width: 2, reason: 'the last two-byte code point' },
	{ point: 0x0800, width: 3, reason: 'the first three-byte code point' },
	{ point: 0xd7ff, width: 3, reason: 'the last code point before the surrogate range' },
	{ point: 0xe000, width: 3, reason: 'the first code point after the surrogate range' },
	{ point: 0xfeff, width: 3, reason: 'the byte order mark, carried as data' },
	{ point: 0xffff, width: 3, reason: 'the last three-byte code point' },
	{ point: 0x10000, width: 4, reason: 'the first four-byte code point' },
	{ point: 0x10ffff, width: 4, reason: 'the last code point Unicode defines' },
]

/**
 * Names UTF-8 measure vectors: one text and the wire byte length it encodes to, or `undefined`.
 *
 * The rows are written out rather than derived, so a measure that starts counting a width wrong
 * fails here as well as against the encoder.
 */
export const UTF8_MEASURES: ReadonlyArray<{
	readonly text: string
	readonly length: number | undefined
	readonly reason: string
}> = [
	{ text: '', length: 0, reason: 'the empty text' },
	{ text: 'A', length: 1, reason: 'a one-byte code point' },
	{ text: 'é', length: 2, reason: 'a two-byte code point' },
	{ text: '€', length: 3, reason: 'a three-byte code point' },
	{ text: '😀', length: 4, reason: 'a four-byte code point, spelled as a surrogate pair' },
	{ text: '\u{10000}', length: 4, reason: 'the first four-byte code point' },
	{ text: '\ud800', length: undefined, reason: 'a lone surrogate, which has no UTF-8 spelling' },
]

/**
 * Collects every text the UTF-8 measure law sweeps: the well-formed population, the ill-formed
 * rows, and one text per boundary code point.
 *
 * The sound-triple law holds over every string rather than over the admitted ones alone, so the
 * ill-formed rows are population here rather than a separate case: each one owes `undefined` on
 * both walks.
 */
export const UTF8_MEASURE_TEXTS: readonly string[] = [
	...TEXTS,
	...ILL_FORMED.map((row) => row.text),
	...UTF8_BOUNDARIES.map((row) => String.fromCodePoint(row.point)),
	...UTF8_MEASURES.map((row) => row.text),
]

/** Lists byte sequences strict UTF-8 refuses, each pinned with the rule that refuses it. */
export const UTF8_REFUSALS: ReadonlyArray<{
	readonly bytes: readonly number[]
	readonly reason: string
}> = [
	{ bytes: [0xc0, 0x80], reason: 'the overlong two-byte spelling of U+0000' },
	{ bytes: [0xc1, 0xbf], reason: 'the overlong two-byte spelling of U+007F' },
	{ bytes: [0xe0, 0x80, 0x80], reason: 'the overlong three-byte spelling of U+0000' },
	{ bytes: [0xe0, 0x9f, 0xbf], reason: 'the overlong three-byte spelling of U+07FF' },
	{ bytes: [0xf0, 0x8f, 0xbf, 0xbf], reason: 'the overlong four-byte spelling of U+FFFF' },
	{ bytes: [0xed, 0xa0, 0x80], reason: 'the encoded lead surrogate U+D800' },
	{ bytes: [0xed, 0xbf, 0xbf], reason: 'the encoded trail surrogate U+DFFF' },
	{ bytes: [0xf4, 0x90, 0x80, 0x80], reason: 'U+110000, past the last code point' },
	{ bytes: [0xe2, 0x82], reason: 'a three-byte sequence the buffer truncates' },
	{ bytes: [0xf0, 0x9f, 0x98], reason: 'a four-byte sequence the buffer truncates' },
	{ bytes: [0x80], reason: 'a continuation byte with no lead' },
	{ bytes: [0xbf], reason: 'the highest continuation byte with no lead' },
	{ bytes: [0xe2, 0x28, 0xa1], reason: 'a lead byte followed by a non-continuation' },
	{ bytes: [0xf8, 0x88, 0x80, 0x80, 0x80], reason: 'a five-byte lead the grammar dropped' },
	{ bytes: [0xff], reason: 'a byte no UTF-8 sequence contains' },
	{ bytes: [0x68, 0xc0, 0x80, 0x69], reason: 'an overlong inside otherwise valid text' },
]

/** Lists byte sequences well-formed UTF-16LE refuses, each pinned with the rule that refuses it. */
export const UTF16_REFUSALS: ReadonlyArray<{
	readonly bytes: readonly number[]
	readonly reason: string
}> = [
	{ bytes: [0x68], reason: 'an odd length, which completes no code unit' },
	{ bytes: [0x68, 0x00, 0x69], reason: 'an odd length after a whole code unit' },
	{ bytes: [0x00, 0xd8], reason: 'a lead surrogate with nothing after it' },
	{ bytes: [0xff, 0xdb], reason: 'the last lead surrogate with nothing after it' },
	{ bytes: [0x00, 0xdc], reason: 'a trail surrogate with no lead' },
	{ bytes: [0xff, 0xdf], reason: 'the last trail surrogate with no lead' },
	{ bytes: [0x00, 0xd8, 0x69, 0x00], reason: 'a lead surrogate followed by a BMP code unit' },
	{ bytes: [0x00, 0xd8, 0x00, 0xd8], reason: 'a lead surrogate followed by another lead' },
	{ bytes: [0x00, 0xdc, 0x00, 0xd8], reason: 'a reversed surrogate pair' },
	{ bytes: [0x68, 0x00, 0x00, 0xdc], reason: 'a trail surrogate after valid text' },
]

/** Texts ISO-8859-1 refuses, each carrying a code unit past its 0xFF ceiling. */
export const LATIN1_REFUSALS: ReadonlyArray<{
	readonly text: string
	readonly reason: string
}> = [
	{ text: 'Ā', reason: 'the first code point past the Latin-1 ceiling' },
	{ text: '€', reason: 'a character Windows-1252 spells but Latin-1 cannot' },
	{ text: 'hĀ', reason: 'a refused character after an admitted one' },
	{ text: '\u{10000}', reason: 'an astral character, whose surrogates both exceed 0xFF' },
	{ text: '\ud800', reason: 'a lone surrogate, which also exceeds 0xFF' },
]

/** Texts Windows-1252 refuses, each carrying a character outside the code page's image. */
export const WINDOWS_1252_REFUSALS: ReadonlyArray<{
	readonly text: string
	readonly reason: string
}> = [
	{ text: '\u0081', reason: 'a C1 control no defined slot reaches' },
	{ text: '\u009d', reason: 'another C1 control no defined slot reaches' },
	{ text: 'Ā', reason: 'a Latin Extended-A character outside the code page' },
	{ text: 'Ѐ', reason: 'a Cyrillic character outside the code page' },
	{ text: '\u{10000}', reason: 'an astral character outside the code page' },
	{ text: '\ud800', reason: 'a lone surrogate, which spells no character at all' },
	{ text: '€Ā', reason: 'a refused character after a defined high slot' },
]

/**
 * Values no bytes-side guard may narrow, none of which is a `Uint8Array`.
 *
 * The sibling view kinds and the proxy are the interesting rows. `Int8Array`, `Uint8ClampedArray`,
 * and `DataView` all pass `ArrayBuffer.isView`, so they prove the guard narrows further than that.
 * The proxy wraps a real byte array and answers true to a bare `instanceof`, so it proves the guard
 * reads an internal slot rather than a prototype chain a trap can rewrite.
 */
export const FOREIGN_BYTES: readonly unknown[] = [
	undefined,
	null,
	0,
	4,
	Number.NaN,
	true,
	{},
	[],
	[104, 105],
	'hi',
	Symbol('hi'),
	new Int8Array([104, 105]),
	new Uint8ClampedArray([104, 105]),
	new DataView(new ArrayBuffer(2)),
	new ArrayBuffer(2),
	new Proxy(new Uint8Array([104, 105]), {}),
]

// ── The UTF-8 decode differential ────────────────────────────────────────────
//
// `decodeUTF8` delegates to the host, so the shipped walk in `decodeUTF8Oracle` is held against it
// over two seeded populations, each sized to the property it serves.
//
// - The random buffers put every byte value at every position of a buffer short enough to hold any
//   width at any alignment: 4,096 buffers of 0 to 15 bytes place each of the 256 values in the
//   lead position about 16 times, so no lead class goes unread, and they cost milliseconds.
// - Uniform random bytes are refused within a few bytes, so they rarely reach a refusal with valid
//   text on both sides. The mutants do: each is a seeded well-formed text spanning every width, the
//   surrogate neighbours, and the boundary code points, encoded and then carrying one substitution,
//   insertion, deletion, or truncation. Half the substitutions and insertions draw from
//   UTF8_EDGE_BYTES, where a UTF-8 rule changes its answer. 1,024 texts of up to 24 code points
//   with 4 mutants each reach every refusal class deep in a buffer; every eighth text opens with a
//   BOM, so a decoder that strips one disagrees on that population.

/**
 * Lists texts built from surrogates: astral pairs, lone leads and trails, and pairs broken by order
 * or by a neighbour, so a code-unit walk meets each the way a code-point walk did.
 */
export const SURROGATE_TEXTS: readonly string[] = Object.freeze([
	'😀',
	'a😀b',
	'\u{10000}\u{10ffff}',
	'𐀀𐀀',
	'\ud83d',
	'\ude00',
	'\ude00\ud83d',
	'\ud83d😀',
	'😀\ude00',
	'\u{10ffff}\ud800',
	'é\udbff',
])

/** Holds the bytes where a UTF-8 rule changes its answer, so a drawn edit lands on one often. */
export const UTF8_EDGE_BYTES: readonly number[] = Object.freeze([
	0x00, 0x7f, 0x80, 0x8f, 0x90, 0x9f, 0xa0, 0xbf, 0xc0, 0xc1, 0xc2, 0xdf, 0xe0, 0xed, 0xef, 0xf0,
	0xf4, 0xf5, 0xff,
])

/** Holds the code point bands a drawn text spans: each UTF-8 width, split at the surrogates. */
export const UTF8_BANDS: ReadonlyArray<readonly [number, number]> = Object.freeze([
	[0x00, 0x7f],
	[0x80, 0x7ff],
	[0x800, 0xd7ff],
	[0xe000, 0xffff],
	[0x10000, 0x10ffff],
])

/** Holds the longest drawn text, in code points. */
export const UTF8_TEXT_LIMIT = 24

/** Holds the period at which a drawn text opens with a BOM. */
export const UTF8_BOM_PERIOD = 8

/**
 * Draws a code point from two draws: the first picks a band or the boundary table, the second the
 * point within it.
 */
export function drawCodePoint(selector: number, value: number): number {
	const band = UTF8_BANDS[selector % (UTF8_BANDS.length + 1)]
	if (band === undefined) return UTF8_BOUNDARIES[value % UTF8_BOUNDARIES.length]?.point ?? 0
	const [low, high] = band
	return low + (value % (high - low + 1))
}

/**
 * Draws well-formed texts of 0 to UTF8_TEXT_LIMIT code points from a seed, every
 * UTF8_BOM_PERIOD-th one opening with a BOM.
 */
export function buildUTF8Texts(seed: number, count: number): readonly string[] {
	const stride = 1 + UTF8_TEXT_LIMIT * 2
	const draws = buildDraws(seed, count * stride)
	return Array.from({ length: count }, (_, index) => {
		const cursor = index * stride
		const length = (draws[cursor] ?? 0) % (UTF8_TEXT_LIMIT + 1)
		const points = Array.from({ length }, (_point, position) =>
			drawCodePoint(draws[cursor + 1 + position * 2] ?? 0, draws[cursor + 2 + position * 2] ?? 0),
		)
		const text = String.fromCodePoint(...points)
		return index % UTF8_BOM_PERIOD === 0 ? `${BOM}${text}` : text
	})
}

/**
 * Applies one edit to a copy of the bytes: a substitution, an insertion, a deletion, or a
 * truncation, chosen by `mutation`, at the position `position` selects. The edited byte is drawn
 * from UTF8_EDGE_BYTES when `choice` is even and is `value`'s low byte otherwise.
 */
export function mutateBytes(
	base: Uint8Array,
	mutation: number,
	position: number,
	choice: number,
	value: number,
): Uint8Array<ArrayBuffer> {
	const byte =
		choice % 2 === 0 ? (UTF8_EDGE_BYTES[value % UTF8_EDGE_BYTES.length] ?? 0) : value & 0xff
	const gap = position % (base.length + 1)
	const at = base.length === 0 ? 0 : position % base.length
	const edit = base.length === 0 ? 1 : mutation % 4
	return Uint8Array.from(
		edit === 0
			? [...base.subarray(0, at), byte, ...base.subarray(at + 1)]
			: edit === 1
				? [...base.subarray(0, gap), byte, ...base.subarray(gap)]
				: edit === 2
					? [...base.subarray(0, at), ...base.subarray(at + 1)]
					: [...base.subarray(0, gap)],
	)
}

/** Encodes each text and follows its bytes with `rounds` seeded mutants of them. */
export function buildUTF8Mutants(
	texts: readonly string[],
	seed: number,
	rounds: number,
): ReadonlyArray<Uint8Array<ArrayBuffer>> {
	const draws = buildDraws(seed, texts.length * rounds * 4)
	return texts.flatMap((text, index) => {
		const base = UTF8_ENCODER.encode(text)
		return [
			base,
			...Array.from({ length: rounds }, (_, round) => {
				const cursor = (index * rounds + round) * 4
				return mutateBytes(
					base,
					draws[cursor] ?? 0,
					draws[cursor + 1] ?? 0,
					draws[cursor + 2] ?? 0,
					draws[cursor + 3] ?? 0,
				)
			}),
		]
	})
}

/** Draws buffers of 0 to `limit - 1` uniformly random bytes from a seed. */
export function buildRandomBytes(
	seed: number,
	count: number,
	limit: number,
): ReadonlyArray<Uint8Array<ArrayBuffer>> {
	const stride = limit
	const draws = buildDraws(seed, count * stride)
	return Array.from({ length: count }, (_, index) => {
		const cursor = index * stride
		const length = (draws[cursor] ?? 0) % limit
		return Uint8Array.from(
			{ length },
			(_byte, position) => (draws[cursor + 1 + position] ?? 0) & 0xff,
		)
	})
}

/** Carries the well-formed texts the seeded UTF-8 sweeps draw. */
export const UTF8_SEEDED_TEXTS: readonly string[] = buildUTF8Texts(0x75746638, 1024)

/** Carries the encoded seeded texts, each followed by four seeded mutants. */
export const UTF8_MUTANTS: ReadonlyArray<Uint8Array<ArrayBuffer>> = buildUTF8Mutants(
	UTF8_SEEDED_TEXTS,
	0x6d757461,
	4,
)

/** Carries 4,096 seeded buffers of 0 to 15 uniformly random bytes. */
export const UTF8_RANDOM: ReadonlyArray<Uint8Array<ArrayBuffer>> = buildRandomBytes(
	0x72616e64,
	4096,
	16,
)

/**
 * Pairs each refusal edge of the UTF-8 grammar with its admitted neighbour one step inside, each
 * row naming the text the admitted side spells.
 */
export const UTF8_EDGE_PAIRS: ReadonlyArray<{
	readonly admitted: readonly number[]
	readonly text: string
	readonly refused: readonly number[]
	readonly reason: string
}> = [
	{ admitted: [0xc2, 0x80], text: '\u0080', refused: [0xc1, 0xbf], reason: 'C2 and C1' },
	{
		admitted: [0xe0, 0xa0, 0x80],
		text: 'ࠀ',
		refused: [0xe0, 0x9f, 0xbf],
		reason: 'E0 A0 and E0 9F',
	},
	{
		admitted: [0xed, 0x9f, 0xbf],
		text: '퟿',
		refused: [0xed, 0xa0, 0x80],
		reason: 'ED 9F and ED A0',
	},
	{
		admitted: [0xf0, 0x90, 0x80, 0x80],
		text: '\u{10000}',
		refused: [0xf0, 0x8f, 0xbf, 0xbf],
		reason: 'F0 90 and F0 8F',
	},
	{
		admitted: [0xf4, 0x8f, 0xbf, 0xbf],
		text: '\u{10ffff}',
		refused: [0xf4, 0x90, 0x80, 0x80],
		reason: 'F4 8F and F4 90',
	},
]

/** Lists each width's sequence cut short at the buffer's end, after an admitted byte. */
export const UTF8_TRUNCATIONS: ReadonlyArray<{
	readonly bytes: readonly number[]
	readonly reason: string
}> = [
	{ bytes: [0x68, 0xc2], reason: 'a two-byte sequence missing one byte' },
	{ bytes: [0x68, 0xe2], reason: 'a three-byte sequence missing two bytes' },
	{ bytes: [0x68, 0xe2, 0x82], reason: 'a three-byte sequence missing one byte' },
	{ bytes: [0x68, 0xf0], reason: 'a four-byte sequence missing three bytes' },
	{ bytes: [0x68, 0xf0, 0x9f], reason: 'a four-byte sequence missing two bytes' },
	{ bytes: [0x68, 0xf0, 0x9f, 0x98], reason: 'a four-byte sequence missing one byte' },
]

/** Lists code points a decoder could mistake for a signal, each with the bytes that spell it. */
export const UTF8_KEPT: ReadonlyArray<{
	readonly bytes: readonly number[]
	readonly text: string
	readonly reason: string
}> = [
	{ bytes: [0x00], text: '\u0000', reason: 'U+0000, which a C string reads as its end' },
	{ bytes: [0xef, 0xbf, 0xbe], text: '￾', reason: 'U+FFFE, the byte-swapped BOM' },
	{ bytes: [0xef, 0xbf, 0xbf], text: '￿', reason: 'U+FFFF, the last noncharacter of the BMP' },
]

/**
 * Holds bytes over a buffer the caller supplies, with a `slice` that throws, so a test reads whether
 * a decoder copies the view without reaching a hook the caller can override.
 */
export class SlicelessBytes extends Uint8Array<ArrayBufferLike> {
	constructor(buffer: ArrayBufferLike, values: readonly number[]) {
		super(buffer, 0, values.length)
		this.set(values)
	}

	override slice(): Uint8Array<ArrayBuffer> {
		throw new Error('slice reached')
	}
}

/**
 * Builds the copy a species-aware copy constructs, shrinking the source buffer to 1 byte before it
 * allocates, the way a hook a caller supplies can.
 */
export class ShrinkingCopy extends Uint8Array {
	constructor(buffer: ArrayBuffer, length: number) {
		buffer.resize(1)
		super(length)
	}
}

/**
 * Builds a length-tracking view over a resizable buffer holding `values`, whose species constructor
 * is {@link ShrinkingCopy} bound to that buffer, so a copy through `slice` shrinks the source first.
 */
export function createShrinkingBytes(values: readonly number[]): Uint8Array<ArrayBuffer> {
	const buffer = new ArrayBuffer(values.length, { maxByteLength: values.length * 2 })
	const bytes = new Uint8Array(buffer)
	bytes.set(values)
	Object.defineProperty(bytes, 'constructor', {
		value: { [Symbol.species]: ShrinkingCopy.bind(null, buffer) },
	})
	return bytes
}

/**
 * Builds the views a resizable buffer leaves with a length of 0 after holding `values`: one whose
 * buffer was transferred away, one an offset left out of bounds after a shrink, and a fixed-length
 * one over a buffer shrunk below it.
 */
export function createEmptiedViews(values: readonly number[]): ReadonlyArray<{
	readonly view: Uint8Array<ArrayBuffer>
	readonly reason: string
}> {
	const detached = new ArrayBuffer(values.length, { maxByteLength: values.length * 2 })
	const offset = new ArrayBuffer(values.length, { maxByteLength: values.length * 2 })
	const fixed = new ArrayBuffer(values.length, { maxByteLength: values.length * 2 })
	const views = [
		{ view: new Uint8Array(detached), reason: 'a view whose resizable buffer was transferred' },
		{ view: new Uint8Array(offset, 2), reason: 'an offset view a shrink left out of bounds' },
		{
			view: new Uint8Array(fixed, 0, values.length),
			reason: 'a fixed-length view over a buffer shrunk below it',
		},
	]
	for (const entry of views) entry.view.set(values.slice(entry.view.byteOffset))
	detached.transfer()
	offset.resize(1)
	fixed.resize(2)
	return views
}

// ── The UTF-8 bench fixtures ─────────────────────────────────────────────────
//
// The cost cases `tests/src/core/helpers.bench.ts` reads. The mixed text is mostly ASCII with 2-,
// 3-, and 4-byte runs, the shape of a JSON tokenizer file, and about 2 MB at UTF8_BENCH_RUNS runs.
// The short texts are 1 to 23 characters, the shape of a vocabulary's tokens, at the call count a
// model load makes.

/** Holds the run count that puts the mixed bench text at about 2 MB. */
export const UTF8_BENCH_RUNS = 85_000

/** Holds the short-text count, which matches the decode calls of a model load's vocabulary. */
export const UTF8_BENCH_STRINGS = 100_000

/** Holds the code point range each run kind draws from: ASCII, 2-byte, 3-byte, and 4-byte. */
export const UTF8_BENCH_RANGES: ReadonlyArray<readonly [number, number]> = Object.freeze([
	[0x20, 0x7e],
	[0x400, 0x4ff],
	[0x4e00, 0x9fff],
	[0x1f300, 0x1faff],
])

/**
 * Draws a run of characters from a range of {@link UTF8_BENCH_RANGES}: 85 in 100 runs are ASCII of
 * 4 to 48 characters, and the rest are 2-, 3-, or 4-byte runs of 1 to 12 characters.
 */
export function drawBenchRun(kind: number, length: number, start: number): string {
	const pick = kind % 100
	const range = UTF8_BENCH_RANGES[pick < 85 ? 0 : pick < 93 ? 1 : pick < 98 ? 2 : 3] ?? [0x20, 0x7e]
	const [low, high] = range
	const count = pick < 85 ? 4 + (length % 45) : 1 + (length % 12)
	return String.fromCodePoint(
		...Array.from({ length: count }, (_, index) => low + ((start + index * 7) % (high - low + 1))),
	)
}

/** Draws the mixed bench text: `runs` seeded runs, joined. */
export function buildBenchText(runs: number, seed: number): string {
	const draws = buildDraws(seed, runs * 3)
	return Array.from({ length: runs }, (_, index) =>
		drawBenchRun(draws[index * 3] ?? 0, draws[index * 3 + 1] ?? 0, draws[index * 3 + 2] ?? 0),
	).join('')
}

/** Draws short bench texts of 1 to 23 characters: 7 in 10 ASCII, 2 in 10 2-byte, 1 in 10 3-byte. */
export function buildBenchStrings(count: number, seed: number): readonly string[] {
	const draws = buildDraws(seed, count * 3)
	return Array.from({ length: count }, (_, index) => {
		const mix = (draws[index * 3 + 1] ?? 0) % 10
		const [low, high] = UTF8_BENCH_RANGES[mix < 7 ? 0 : mix < 9 ? 1 : 2] ?? [0x20, 0x7e]
		const start = draws[index * 3 + 2] ?? 0
		return String.fromCodePoint(
			...Array.from(
				{ length: 1 + ((draws[index * 3] ?? 0) % 23) },
				(_character, position) => low + ((start + position * 5) % (high - low + 1)),
			),
		)
	})
}
