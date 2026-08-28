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

/** Named measure vectors: one §4 text and the decoded byte length it owes, or `undefined`. */
export const MEASURES: ReadonlyArray<{
	readonly text: string
	readonly length: number | undefined
	readonly reason: string
}> = [
	{ text: '', length: 0, reason: 'the empty text' },
	{ text: 'aGk=', length: 2, reason: 'one pad character' },
	{ text: 'AQID', length: 3, reason: 'a full group' },
	{ text: 'aa==', length: undefined, reason: 'a non-zero unused trailing bit' },
	{ text: 'A', length: undefined, reason: 'a length off the group boundary' },
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
