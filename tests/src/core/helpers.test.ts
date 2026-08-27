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
import {
	FOREIGN,
	MEMBERSHIP,
	OCTETS,
	RFC_STANDARD,
	RFC_URL,
	SEXTETS,
	SWEEP,
	VECTORS,
} from '../../setup.js'

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
