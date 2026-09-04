import { describe, expect, it } from 'vitest'
import { createHostileValues } from '@orkestrel/test'
import {
	decodeBase64,
	decodeBase64URL,
	decodeHex,
	decodeLatin1,
	decodeUTF8,
	decodeUTF16LE,
	decodeWindows1252,
	encodeLatin1,
	encodeUTF8,
	isBase64,
	isBase64URL,
	isHex,
	isLatin1,
	isUTF8,
	isUTF16LE,
	isWindows1252,
} from '@src/core'
import {
	FOREIGN,
	FOREIGN_BYTES,
	HEX_MEMBERSHIP,
	ILL_FORMED,
	MEMBERSHIP,
	OCTETS,
	TEXTS,
} from '../../setup.js'

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

describe('the iff law — isHex names exactly what decodeHex accepts', () => {
	for (const row of HEX_MEMBERSHIP) {
		it(`answers the declared membership for ${JSON.stringify(row.text)} — ${row.reason}`, () => {
			const expected = row.bytes === undefined ? undefined : new Uint8Array(row.bytes)

			expect(isHex(row.text)).toBe(row.bytes !== undefined)
			expect(decodeHex(row.text)).toStrictEqual(expected)
		})
	}
})

describe('the iff law — each charset guard names exactly what its partial direction accepts', () => {
	it('binds isUTF8, isWindows1252, and isUTF16LE to their decoders over every byte pair', () => {
		const drift: string[] = []
		for (let first = 0; first < 256; first += 1) {
			for (let second = 0; second < 256; second += 1) {
				const bytes = new Uint8Array([first, second])
				if (isUTF8(bytes) !== (decodeUTF8(bytes) !== undefined)) drift.push(`UTF-8 ${first}`)
				if (isUTF16LE(bytes) !== (decodeUTF16LE(bytes) !== undefined)) {
					drift.push(`UTF-16LE ${first},${second}`)
				}
				if (isWindows1252(bytes) !== (decodeWindows1252(bytes) !== undefined)) {
					drift.push(`Windows-1252 ${first},${second}`)
				}
			}
		}

		expect(drift).toEqual([])
	})

	it('binds isLatin1 to its encoder over every text, the partial direction it guards', () => {
		const drift = TEXTS.filter((text) => isLatin1(text) !== (encodeLatin1(text) !== undefined))

		expect(TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('names no guard for the total Latin-1 decoder and no guard for the UTF-8 text side', () => {
		// `decodeLatin1` returns a string for every byte sequence, so a bytes-side Latin-1 guard would
		// answer true for everything and name nothing. `encodeUTF8` refuses exactly the ill-formed
		// strings, which the platform already names, so its text side needs no wrapper either.
		for (const value of OCTETS) {
			expect(typeof decodeLatin1(new Uint8Array([value])), `byte ${value}`).toBe('string')
		}
		const drift = [...TEXTS, ...ILL_FORMED.map((row) => row.text)].filter(
			(text) => text.isWellFormed() !== (encodeUTF8(text) !== undefined),
		)

		expect(drift).toEqual([])
	})
})

describe('guard totality', () => {
	it('refuses every value that is not a string', () => {
		for (const [index, value] of FOREIGN.entries()) {
			expect(isBase64(value), `foreign value ${index}`).toBe(false)
			expect(isBase64URL(value), `foreign value ${index}`).toBe(false)
			expect(isHex(value), `foreign value ${index}`).toBe(false)
			expect(isLatin1(value), `foreign value ${index}`).toBe(false)
		}
	})

	it('refuses every value that is not a byte sequence', () => {
		for (const [index, value] of FOREIGN_BYTES.entries()) {
			expect(isUTF8(value), `foreign value ${index}`).toBe(false)
			expect(isWindows1252(value), `foreign value ${index}`).toBe(false)
			expect(isUTF16LE(value), `foreign value ${index}`).toBe(false)
		}
	})

	it('answers false for every hostile value without throwing', () => {
		for (const [index, value] of createHostileValues().entries()) {
			const answers: Record<string, boolean | undefined> = {}

			expect(() => {
				answers.standard = isBase64(value)
				answers.url = isBase64URL(value)
				answers.hex = isHex(value)
				answers.utf8 = isUTF8(value)
				answers.latin1 = isLatin1(value)
				answers.windows = isWindows1252(value)
				answers.utf16 = isUTF16LE(value)
			}, `hostile value ${index}`).not.toThrow()
			for (const [face, answer] of Object.entries(answers)) {
				expect(answer, `hostile value ${index} on ${face}`).toBe(false)
			}
		}
	})

	it('admits a byte sequence sharing a buffer, which the bytes-side guards must not refuse', () => {
		const buffer = new ArrayBuffer(8)
		new Uint8Array(buffer).set([0x68, 0x69, 0x68, 0x69, 0x68, 0x69, 0x68, 0x69])
		const view = new Uint8Array(buffer, 2, 4)

		expect(isUTF8(view)).toBe(true)
		expect(isWindows1252(view)).toBe(true)
		expect(isUTF16LE(view)).toBe(true)
	})
})
