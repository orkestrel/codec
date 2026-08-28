/** The RFC 4648 §4 alphabet, transcribed from the specification. */
export const RFC_STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** The RFC 4648 §5 url alphabet, transcribed from the specification. */
export const RFC_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** Every octet value, in one buffer. */
export const OCTETS = Uint8Array.from({ length: 256 }, (_value, index) => index)
/** The sextet population, so an alphabet sweep reads one index per character. */
export const SEXTETS = Array.from({ length: 64 }, (_value, index) => index)

/**
 * Every octet's hex spelling, in octet order.
 *
 * The digits come from the language's own radix conversion rather than from this package's table,
 * so the hex sweep compares `encodeHex` against a mechanism that can disagree with it instead of
 * re-deriving the answer the way the source does.
 */
export const HEX_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	byte.toString(16).padStart(2, '0'),
)

/** Named canonical vectors: one value, its §4 spelling, and its §5 spelling. */
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
 * Mixed admitted and refused texts, each row stating what both faces owe it.
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
	{ text: 'AQ ID', standard: false, url: false, reason: 'whitespace' },
	{ text: 'A', standard: false, url: false, reason: 'a length off the group boundary' },
	{ text: 'AQID=', standard: false, url: false, reason: 'padding off the group boundary' },
	{ text: '====', standard: false, url: false, reason: 'padding with no data' },
	{ text: 'A===', standard: false, url: false, reason: 'padding wider than the group allows' },
	{ text: 'AA=A', standard: false, url: false, reason: 'padding inside the group' },
	{ text: 'AAAA\n', standard: false, url: false, reason: 'a trailing newline' },
]

/**
 * Mixed admitted and refused hex texts, each row stating the bytes the §8 face owes it.
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

// Every hex-sweep text of length four or less over those characters, built by counting in base
// HEX_SWEEP_CHARACTERS.length and keeping each prefix along the way.
const HEX_SWEEP_TEXTS = new Set<string>([''])
for (let index = 0; index < HEX_SWEEP_CHARACTERS.length ** 4; index += 1) {
	let text = ''
	let remainder = index
	for (let position = 0; position < 4; position += 1) {
		text += HEX_SWEEP_CHARACTERS[remainder % HEX_SWEEP_CHARACTERS.length] ?? ''
		remainder = Math.floor(remainder / HEX_SWEEP_CHARACTERS.length)
		HEX_SWEEP_TEXTS.add(text)
	}
}

/** The hex sweep population, deduplicated. */
export const HEX_SWEEP: readonly string[] = [...HEX_SWEEP_TEXTS]

/**
 * Named measure vectors: one text and the decoded byte length each Base64 face owes it.
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

/** Named hex measure vectors: one §8 text and the decoded byte length it owes, or `undefined`. */
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

// Every text of length four or less over those characters, built by counting in base
// SWEEP_CHARACTERS.length and keeping each prefix along the way.
const SWEEP_TEXTS = new Set<string>([''])
for (let index = 0; index < SWEEP_CHARACTERS.length ** 4; index += 1) {
	let text = ''
	let remainder = index
	for (let position = 0; position < 4; position += 1) {
		text += SWEEP_CHARACTERS[remainder % SWEEP_CHARACTERS.length] ?? ''
		remainder = Math.floor(remainder / SWEEP_CHARACTERS.length)
		SWEEP_TEXTS.add(text)
	}
}

/** The sweep population, deduplicated. */
export const SWEEP: readonly string[] = [...SWEEP_TEXTS]

/** Every text the Base64 measure law sweeps: the sweep population beside both written-out tables. */
export const MEASURE_TEXTS: readonly string[] = [
	...SWEEP,
	...MEMBERSHIP.map((row) => row.text),
	...MEASURES.map((row) => row.text),
]

/** Every text the hex measure law sweeps: the hex sweep population beside both written-out tables. */
export const HEX_MEASURE_TEXTS: readonly string[] = [
	...HEX_SWEEP,
	...HEX_MEMBERSHIP.map((row) => row.text),
	...HEX_MEASURES.map((row) => row.text),
]

// ── The charset oracles ──────────────────────────────────────────────────────
//
// Each oracle is the platform's own coding, which knows nothing about this package's tables and can
// therefore disagree with them. Every one of them was probed before the sweeps were written to it,
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
//   for `EF BB BF 68 69` by default and length 3 with `ignoreBOM: true`. Both oracles here set it,
//   because this package's round-trip law leaves its decoders no byte they may discard.
//
// `TextEncoder` is the UTF-8 encode oracle over well-formed text alone: the probe read `EF BF BD`
// for a lone surrogate, so it replaces where `encodeUTF8` refuses.

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const UTF16LE_DECODER = new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true })
const WINDOWS_1252_DECODER = new TextDecoder('windows-1252')
const UTF8_ENCODER = new TextEncoder()

/**
 * Decodes bytes through the platform's strict UTF-8 decoder, reporting a refusal as `undefined`.
 *
 * The decoder keeps the leading BOM, so the only remaining difference from `decodeUTF8` is how a
 * refusal is reported: the platform throws where this package returns `undefined`.
 */
export function decodeUTF8Oracle(bytes: Uint8Array): string | undefined {
	try {
		return UTF8_DECODER.decode(bytes)
	} catch {
		return undefined
	}
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

/** Every octet's ISO-8859-1 character, in octet order, read from the coding's own identity. */
export const LATIN1_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	String.fromCharCode(byte),
)

/**
 * Every octet's Windows-1252 character according to the WHATWG index, in octet order.
 *
 * The index defines an entry for every byte, so the slots this coding refuses carry their C1 control
 * here. {@link WINDOWS_1252_UNDEFINED} names them, and the sweep excludes them.
 */
export const WINDOWS_1252_OCTETS: readonly string[] = Array.from(OCTETS, (byte) =>
	WINDOWS_1252_DECODER.decode(new Uint8Array([byte])),
)

/**
 * The Windows-1252 slots that name no character, written out rather than derived.
 *
 * These are the bytes `decodeWindows1252` refuses and the platform oracle admits, so they are both
 * the divergence the sweep excludes and the refusal the suite pins directly.
 */
export const WINDOWS_1252_UNDEFINED: readonly number[] = Object.freeze([
	0x81, 0x8d, 0x8f, 0x90, 0x9d,
])

// ── The charset populations ──────────────────────────────────────────────────

/**
 * Characters spanning every UTF-8 width threshold, the BOM, and the code page's own bands.
 *
 * The thresholds are the code points where the encoded width changes — U+0000, U+007F, U+0080,
 * U+07FF, U+0800, U+FFFF, U+10000, and U+10FFFF — so a width rule that shifts by one lands on a
 * member here. U+FEFF is the BOM, carried as an ordinary character. U+0081 is a Windows-1252
 * undefined slot on the text side, U+20AC is a defined high slot, and U+00FF and U+0100 straddle
 * the Latin-1 ceiling.
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
	'\ufeff',
	'\uffff',
	'\u{10000}',
	'\u{10ffff}',
]

// Every well-formed text of three characters or fewer over those characters, built by counting in
// base TEXT_CHARACTERS.length and keeping each prefix along the way. Every member is well-formed by
// construction: no character here is a lone surrogate, and an astral member carries its own pair.
const TEXT_SET = new Set<string>([''])
for (let index = 0; index < TEXT_CHARACTERS.length ** 3; index += 1) {
	let text = ''
	let remainder = index
	for (let position = 0; position < 3; position += 1) {
		text += TEXT_CHARACTERS[remainder % TEXT_CHARACTERS.length] ?? ''
		remainder = Math.floor(remainder / TEXT_CHARACTERS.length)
		TEXT_SET.add(text)
	}
}

/** The well-formed text population, deduplicated. */
export const TEXTS: readonly string[] = [...TEXT_SET]

/** Ill-formed texts, each carrying a surrogate no coding over code points can spell. */
export const ILL_FORMED: ReadonlyArray<{ readonly text: string; readonly reason: string }> = [
	{ text: '\ud800', reason: 'a lone lead surrogate' },
	{ text: '\udfff', reason: 'a lone trail surrogate' },
	{ text: 'a\ud800', reason: 'a trailing lead surrogate' },
	{ text: '\ud800a', reason: 'a lead surrogate followed by a BMP character' },
	{ text: '\udc00\ud800', reason: 'a reversed surrogate pair' },
	{ text: '\ud800\ud800', reason: 'two lead surrogates' },
]

/** The UTF-8 width thresholds, each with the byte length its code point encodes to. */
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
	{ point: 0xfeff, width: 3, reason: 'the byte order mark, carried as data' },
	{ point: 0xffff, width: 3, reason: 'the last three-byte code point' },
	{ point: 0x10000, width: 4, reason: 'the first four-byte code point' },
	{ point: 0x10ffff, width: 4, reason: 'the last code point Unicode defines' },
]

/** Byte sequences strict UTF-8 refuses, each pinned with the rule that refuses it. */
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

/** Byte sequences well-formed UTF-16LE refuses, each pinned with the rule that refuses it. */
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
