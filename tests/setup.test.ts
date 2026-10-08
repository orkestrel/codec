import {
	decodeUTF16LEOracle,
	decodeUTF8Oracle,
	encodeUTF8Oracle,
	HEX_OCTETS,
	OCTETS,
	RFC_STANDARD,
	RFC_URL,
	SEXTETS,
	VECTORS,
} from './setup.js'
import { describe, expect, it } from 'vitest'

describe('setup tables', () => {
	it('carries distinct RFC alphabets with their face-specific suffixes', () => {
		expect(RFC_STANDARD).toHaveLength(64)
		expect(new Set(RFC_STANDARD).size).toBe(64)
		expect(RFC_URL).toHaveLength(64)
		expect(new Set(RFC_URL).size).toBe(64)
		expect(RFC_STANDARD.slice(0, 62)).toBe(
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
		)
		expect(RFC_URL.slice(0, 62)).toBe(RFC_STANDARD.slice(0, 62))
		expect(RFC_STANDARD.slice(62)).toBe('+/')
		expect(RFC_URL.slice(62)).toBe('-_')
	})

	it('carries every octet in numeric order', () => {
		expect(OCTETS).toHaveLength(256)
		for (const [index, byte] of OCTETS.entries()) expect(byte).toBe(index)
	})

	it('carries every sextet in numeric order', () => {
		expect(SEXTETS).toHaveLength(64)
		for (const [index, sextet] of SEXTETS.entries()) expect(sextet).toBe(index)
	})

	it('carries lowercase hex pairs that parse to their octet indices', () => {
		expect(HEX_OCTETS).toHaveLength(256)
		for (const [index, text] of HEX_OCTETS.entries()) {
			expect(text).toMatch(/^[0-9a-f]{2}$/u)
			expect(Number.parseInt(text, 16)).toBe(index)
		}
	})

	it('carries Base64 vector spellings that the platform decodes to their bytes', () => {
		expect(VECTORS.length).toBeGreaterThan(0)
		for (const vector of VECTORS) {
			expect(Array.from(atob(vector.standard), (character) => character.charCodeAt(0))).toEqual(
				vector.bytes,
			)
			expect(
				Array.from(atob(vector.url.replaceAll('-', '+').replaceAll('_', '/')), (character) =>
					character.charCodeAt(0),
				),
			).toEqual(vector.bytes)
		}
	})
})

describe('setup oracles', () => {
	it('decodes UTF-8 widths and preserves a leading BOM', () => {
		expect(
			decodeUTF8Oracle(
				new Uint8Array([
					0xef, 0xbb, 0xbf, 0x41, 0xc2, 0xa2, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80,
				]),
			),
		).toBe('\ufeffA\u00a2\u20ac\u{1f600}')
	})

	it('reports ill-formed UTF-8 as undefined', () => {
		const bytes = new Uint8Array([0xc0, 0x80])
		expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toThrow(TypeError)
		expect(decodeUTF8Oracle(bytes)).toBeUndefined()
	})

	it('decodes UTF-16LE code units and surrogate pairs while preserving a leading BOM', () => {
		expect(
			decodeUTF16LEOracle(
				new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xac, 0x20, 0x3d, 0xd8, 0x00, 0xde]),
			),
		).toBe('\ufeffA\u20ac\u{1f600}')
	})

	it('reports an incomplete UTF-16LE code unit as undefined', () => {
		const bytes = new Uint8Array([0x41])
		expect(() => new TextDecoder('utf-16le', { fatal: true }).decode(bytes)).toThrow(TypeError)
		expect(decodeUTF16LEOracle(bytes)).toBeUndefined()
	})

	it('reports an unpaired UTF-16LE surrogate as undefined', () => {
		const bytes = new Uint8Array([0x00, 0xd8])
		expect(() => new TextDecoder('utf-16le', { fatal: true }).decode(bytes)).toThrow(TypeError)
		expect(decodeUTF16LEOracle(bytes)).toBeUndefined()
	})

	it('encodes UTF-8 widths and a leading BOM to handwritten bytes', () => {
		expect(encodeUTF8Oracle('\ufeffA\u00a2\u20ac\u{1f600}')).toEqual(
			new Uint8Array([
				0xef, 0xbb, 0xbf, 0x41, 0xc2, 0xa2, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80,
			]),
		)
	})

	it('retains the platform encoder replacement behavior for a lone surrogate', () => {
		expect(encodeUTF8Oracle('\ud800')).toEqual(new Uint8Array([0xef, 0xbf, 0xbd]))
	})

	it('returns empty results for empty oracle inputs', () => {
		expect(decodeUTF8Oracle(new Uint8Array())).toBe('')
		expect(decodeUTF16LEOracle(new Uint8Array())).toBe('')
		expect(encodeUTF8Oracle('')).toEqual(new Uint8Array())
	})
})
