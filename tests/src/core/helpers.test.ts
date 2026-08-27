import { describe, expect, it } from 'vitest'
import { createHostileValues, requireValue } from '@orkestrel/test'
import {
	decodeBase64,
	decodeBase64URL,
	encodeBase64,
	encodeBase64URL,
	isBase64,
	isBase64URL,
} from '@src/core'

// The laws this package exists to keep, driven as sweeps rather than as spot vectors:
//
// - The round-trip law: decode*(encode*(bytes)) deep-equals bytes, for every byte sequence.
// - The canonical-form law: encode*(decode*(text)) === text, for every text the guard admits.
//
// The canonical-form law is what forces canonical-form decoding, so the sweep carrying it is an
// exhaustive walk over short texts drawn from a character set spanning both alphabets, the pad
// character, and one character neither alphabet holds. Both alphabets are transcribed from
// RFC 4648 here rather than imported, so the assertions compare the package against the
// specification instead of against its own table.

/** The RFC 4648 §4 alphabet, transcribed from the specification. */
const RFC_STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** The RFC 4648 §5 url alphabet, transcribed from the specification. */
const RFC_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** Every octet value, in one buffer. */
const OCTETS = Uint8Array.from({ length: 256 }, (_value, index) => index)
/** The sextet population, so an alphabet sweep reads one index per character. */
const SEXTETS = Array.from({ length: 64 }, (_value, index) => index)

/** Named canonical vectors: one value, its §4 spelling, and its §5 spelling. */
const VECTORS: ReadonlyArray<{
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
const MEMBERSHIP: ReadonlyArray<{
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

/** Values no guard may narrow, none of which is a string. */
const FOREIGN: readonly unknown[] = [
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

/** Characters spanning both alphabets, the pad, and one character neither alphabet holds. */
const SWEEP_CHARACTERS: readonly string[] = ['A', 'Q', 'a', 'q', '0', '+', '/', '-', '_', '=', ' ']

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
const SWEEP: readonly string[] = [...SWEEP_TEXTS]

describe('the round-trip law — decoding an encoding returns the bytes', () => {
	it('round-trips the whole octet space in one buffer', () => {
		expect(decodeBase64(encodeBase64(OCTETS))).toStrictEqual(OCTETS)
		expect(decodeBase64URL(encodeBase64URL(OCTETS))).toStrictEqual(OCTETS)
	})

	it('round-trips every padding residue', () => {
		for (let length = 0; length <= 3; length += 1) {
			const bytes = OCTETS.slice(0, length)

			expect(decodeBase64(encodeBase64(bytes)), `length ${length}`).toStrictEqual(bytes)
			expect(decodeBase64URL(encodeBase64URL(bytes)), `length ${length}`).toStrictEqual(bytes)
		}
	})

	it('round-trips every single byte', () => {
		for (const value of OCTETS) {
			const bytes = new Uint8Array([value])

			expect(decodeBase64(encodeBase64(bytes)), `byte ${value}`).toStrictEqual(bytes)
			expect(decodeBase64URL(encodeBase64URL(bytes)), `byte ${value}`).toStrictEqual(bytes)
		}
	})

	it('round-trips every byte pair, the residue class the unused-bit rule governs', () => {
		const drift: string[] = []
		for (const first of OCTETS) {
			for (const second of OCTETS) {
				const bytes = new Uint8Array([first, second])
				const standard = decodeBase64(encodeBase64(bytes))
				const url = decodeBase64URL(encodeBase64URL(bytes))
				if (standard === undefined || standard[0] !== first || standard[1] !== second) {
					drift.push(`§4 ${first},${second}`)
				}
				if (url === undefined || url[0] !== first || url[1] !== second) {
					drift.push(`§5 ${first},${second}`)
				}
			}
		}
		expect(drift).toEqual([])
	})
})

describe('the canonical-form law — re-encoding an admitted text returns the text', () => {
	it('re-encodes every admitted sweep text to itself', () => {
		const admitted = SWEEP.filter((text) => isBase64(text))
		const admittedURL = SWEEP.filter((text) => isBase64URL(text))

		expect(admitted.length).toBeGreaterThan(0)
		expect(admittedURL.length).toBeGreaterThan(0)
		expect(SWEEP.length).toBeGreaterThan(admitted.length + admittedURL.length)
		expect(
			admitted.filter((text) => encodeBase64(requireValue(decodeBase64(text))) !== text),
		).toEqual([])
		expect(
			admittedURL.filter((text) => encodeBase64URL(requireValue(decodeBase64URL(text))) !== text),
		).toEqual([])
	})

	it('re-encodes every named vector to itself', () => {
		for (const vector of VECTORS) {
			expect(encodeBase64(requireValue(decodeBase64(vector.standard))), `${vector.name} §4`).toBe(
				vector.standard,
			)
			expect(encodeBase64URL(requireValue(decodeBase64URL(vector.url))), `${vector.name} §5`).toBe(
				vector.url,
			)
		}
	})
})

describe('the iff law — each guard names exactly what its decoder accepts', () => {
	it('keeps guard and decoder aligned across the sweep', () => {
		expect(SWEEP.filter((text) => isBase64(text) !== (decodeBase64(text) !== undefined))).toEqual(
			[],
		)
		expect(
			SWEEP.filter((text) => isBase64URL(text) !== (decodeBase64URL(text) !== undefined)),
		).toEqual([])
	})

	for (const row of MEMBERSHIP) {
		it(`answers the declared membership for ${JSON.stringify(row.text)} — ${row.reason}`, () => {
			expect(isBase64(row.text)).toBe(row.standard)
			expect(isBase64URL(row.text)).toBe(row.url)
			expect(decodeBase64(row.text) !== undefined).toBe(row.standard)
			expect(decodeBase64URL(row.text) !== undefined).toBe(row.url)
		})
	}
})

describe('named vectors', () => {
	for (const vector of VECTORS) {
		it(`spells ${vector.name} in both faces`, () => {
			const bytes = new Uint8Array(vector.bytes)

			expect(encodeBase64(bytes)).toBe(vector.standard)
			expect(encodeBase64URL(bytes)).toBe(vector.url)
			expect(decodeBase64(vector.standard)).toStrictEqual(bytes)
			expect(decodeBase64URL(vector.url)).toStrictEqual(bytes)
		})
	}
})

describe('the alphabets', () => {
	it('spells every sextet with the character the specification names', () => {
		for (const value of SEXTETS) {
			const bytes = new Uint8Array([value << 2])

			expect(encodeBase64(bytes).charAt(0), `sextet ${value}`).toBe(RFC_STANDARD.charAt(value))
			expect(encodeBase64URL(bytes).charAt(0), `sextet ${value}`).toBe(RFC_URL.charAt(value))
		}
	})

	it('reads every specification character back to its sextet', () => {
		for (const value of SEXTETS) {
			const bytes = new Uint8Array([value << 2])

			expect(decodeBase64(`${RFC_STANDARD.charAt(value)}A==`), `sextet ${value}`).toStrictEqual(
				bytes,
			)
			expect(decodeBase64URL(`${RFC_URL.charAt(value)}A`), `sextet ${value}`).toStrictEqual(bytes)
		}
	})

	it('refuses each face the characters the other one owns', () => {
		expect(decodeBase64('-_-_')).toBeUndefined()
		expect(decodeBase64URL('+/+/')).toBeUndefined()
		expect(isBase64('-_-_')).toBe(false)
		expect(isBase64URL('+/+/')).toBe(false)
	})
})

describe('guard totality', () => {
	it('refuses every value that is not a string', () => {
		for (const [index, value] of FOREIGN.entries()) {
			expect(isBase64(value), `foreign value ${index}`).toBe(false)
			expect(isBase64URL(value), `foreign value ${index}`).toBe(false)
		}
	})

	it('answers false for every hostile value without throwing', () => {
		for (const [index, value] of createHostileValues().entries()) {
			let standard: boolean | undefined
			let url: boolean | undefined

			expect(() => {
				standard = isBase64(value)
				url = isBase64URL(value)
			}, `hostile value ${index}`).not.toThrow()
			expect(standard, `hostile value ${index}`).toBe(false)
			expect(url, `hostile value ${index}`).toBe(false)
		}
	})
})
