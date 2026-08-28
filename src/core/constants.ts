// === RFC 4648 Base64
//
// The lookup table is written out rather than computed from BASE64_ALPHABET at module scope:
// constants.ts holds data, and a module-scope callback here is a placement violation the fleet
// policy sweep rejects. Entry `c` of the table is the index of `c` in BASE64_ALPHABET, and the
// alphabet sweep in tests/src/core/helpers.test.ts fails on any single-entry disagreement.

/** The RFC 4648 §4 alphabet, index-ordered; {@link BASE64_LOOKUP} is transcribed against it. */
export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Base64 character to 6-bit value lookup, transcribed against {@link BASE64_ALPHABET}; the
 * alphabet sweep in tests/src/core/helpers.test.ts fails on any single-entry disagreement.
 */
export const BASE64_LOOKUP: Readonly<Record<string, number>> = Object.freeze({
	A: 0,
	B: 1,
	C: 2,
	D: 3,
	E: 4,
	F: 5,
	G: 6,
	H: 7,
	I: 8,
	J: 9,
	K: 10,
	L: 11,
	M: 12,
	N: 13,
	O: 14,
	P: 15,
	Q: 16,
	R: 17,
	S: 18,
	T: 19,
	U: 20,
	V: 21,
	W: 22,
	X: 23,
	Y: 24,
	Z: 25,
	a: 26,
	b: 27,
	c: 28,
	d: 29,
	e: 30,
	f: 31,
	g: 32,
	h: 33,
	i: 34,
	j: 35,
	k: 36,
	l: 37,
	m: 38,
	n: 39,
	o: 40,
	p: 41,
	q: 42,
	r: 43,
	s: 44,
	t: 45,
	u: 46,
	v: 47,
	w: 48,
	x: 49,
	y: 50,
	z: 51,
	'0': 52,
	'1': 53,
	'2': 54,
	'3': 55,
	'4': 56,
	'5': 57,
	'6': 58,
	'7': 59,
	'8': 60,
	'9': 61,
	'+': 62,
	'/': 63,
})

// === RFC 4648 Base16
//
// The same written-out idiom, for the same reason: constants.ts holds data, and a module-scope
// callback here is a placement violation the fleet policy sweep rejects. HEX_ALPHABET is the
// specification's §8 table in this package's canonical lowercase spelling, entry `c` of the table
// is the index of `c` in it, and the oracle sweep in tests/src/core/helpers.test.ts fails on any
// single-entry disagreement. The table holds no uppercase entry, which is what makes `decodeHex`
// refuse `'AB'`.

/** The RFC 4648 §8 alphabet, lowercase and index-ordered; {@link HEX_LOOKUP} is transcribed against it. */
export const HEX_ALPHABET = '0123456789abcdef'

/**
 * Hex character to 4-bit value lookup, transcribed against {@link HEX_ALPHABET}; the oracle sweep
 * in tests/src/core/helpers.test.ts fails on any single-entry disagreement.
 */
export const HEX_LOOKUP: Readonly<Record<string, number>> = Object.freeze({
	'0': 0,
	'1': 1,
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	a: 10,
	b: 11,
	c: 12,
	d: 13,
	e: 14,
	f: 15,
})

// === The Windows-1252 high table
//
// The same written-out idiom again, and here the omissions are the coding. Bytes 0x00-0x7F and
// 0xA0-0xFF are the identity, so only the 0x80-0x9F band needs a table, and the following entries
// are the WHATWG Encoding index for windows-1252 over that band. `encodeWindows1252` reads the
// table in reverse, so this one table is the whole mapping in both directions, and the oracle
// sweep in tests/src/core/helpers.test.ts fails on any single-entry disagreement.

/**
 * Windows-1252 high-band byte to code point lookup, keyed by the byte and transcribed from the
 * WHATWG Encoding index for the code page.
 *
 * @remarks
 * The table covers 0x80-0x9F alone, because every other byte in the code page is the identity.
 * Bytes 0x81, 0x8D, 0x8F, 0x90, and 0x9D carry no entry: the code page leaves those slots
 * undefined, and their absence here is what makes `decodeWindows1252` refuse them. The WHATWG
 * index maps each of those slots to its own C1 control instead, so a decoder built from that index
 * admits every byte this coding refuses.
 */
export const WINDOWS_1252_HIGH: Readonly<Record<string, number>> = Object.freeze({
	0x80: 0x20ac,
	0x82: 0x201a,
	0x83: 0x0192,
	0x84: 0x201e,
	0x85: 0x2026,
	0x86: 0x2020,
	0x87: 0x2021,
	0x88: 0x02c6,
	0x89: 0x2030,
	0x8a: 0x0160,
	0x8b: 0x2039,
	0x8c: 0x0152,
	0x8e: 0x017d,
	0x91: 0x2018,
	0x92: 0x2019,
	0x93: 0x201c,
	0x94: 0x201d,
	0x95: 0x2022,
	0x96: 0x2013,
	0x97: 0x2014,
	0x98: 0x02dc,
	0x99: 0x2122,
	0x9a: 0x0161,
	0x9b: 0x203a,
	0x9c: 0x0153,
	0x9e: 0x017e,
	0x9f: 0x0178,
})
