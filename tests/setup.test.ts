import {
	buildBenchStrings,
	buildBenchText,
	buildCodecTexts,
	buildDraws,
	buildRandomBytes,
	buildUTF8Mutants,
	buildUTF8Texts,
	createIteratedBytes,
	drawBenchRun,
	drawCodePoint,
	mutateBytes,
	RecordedBytes,
	UTF8_BANDS,
	UTF8_BENCH_RANGES,
	UTF8_BOM_PERIOD,
	UTF8_EDGE_BYTES,
	UTF8_TEXT_LIMIT,
	decodeUTF16LEOracle,
	decodeUTF8Oracle,
	encodeHexOracle,
	encodeUTF8Oracle,
	measureBase64Oracle,
	measureHexOracle,
	measureUTF8Oracle,
	HEX_OCTETS,
	OCTETS,
	RFC_STANDARD,
	RFC_URL,
	SEXTETS,
	VECTORS,
} from './setup.js'
import { describe, expect, it } from 'vitest'

describe('setup tables', () => {
	it('builds distinct prefixes in digit order without splitting astral characters', () => {
		expect(buildCodecTexts(['a', 'b'], 2)).toEqual(['', 'a', 'aa', 'b', 'ba', 'ab', 'bb'])
		expect(buildCodecTexts(['\u{10000}', 'a'], 1)).toEqual(['', '\u{10000}', 'a'])
		expect(buildCodecTexts(['a', 'a'], 2)).toEqual(['', 'a', 'aa'])
		expect(buildCodecTexts(['a'], 0)).toEqual([''])
		expect(buildCodecTexts([], 2)).toEqual([''])
	})

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

	it('measures UTF-8 widths and refuses a lone surrogate', () => {
		expect(measureUTF8Oracle('A¢€\u{1f600}')).toBe(10)
		expect(measureUTF8Oracle('')).toBe(0)
		expect(measureUTF8Oracle('\udc00')).toBeUndefined()
	})

	it('measures lowercase hex and refuses odd and uppercase text', () => {
		expect(measureHexOracle('00ff')).toBe(2)
		expect(measureHexOracle('0')).toBeUndefined()
		expect(measureHexOracle('FF')).toBeUndefined()
		expect(measureHexOracle('')).toBe(0)
	})

	it('measures canonical Base64 and refuses a nonzero unused bit', () => {
		expect(measureBase64Oracle('aGk=')).toBe(2)
		expect(measureBase64Oracle('aQ==')).toBe(1)
		expect(measureBase64Oracle('aa==')).toBeUndefined()
		expect(measureBase64Oracle('aGk')).toBeUndefined()
	})

	it('builds bytes whose iterator yields other values than their indices hold', () => {
		const bytes = createIteratedBytes([0xab, 0xcd], [0x01])

		expect([...bytes]).toEqual([0x01])
		expect(bytes[0]).toBe(0xab)
		expect(bytes[1]).toBe(0xcd)
		expect(bytes).toHaveLength(2)
	})

	it('encodes bytes as lowercase hex digit pairs', () => {
		expect(encodeHexOracle(new Uint8Array([0x00, 0x0f, 0xab, 0xff]))).toBe('000fabff')
		expect(encodeHexOracle(new Uint8Array())).toBe('')
	})

	it('returns empty results for empty oracle inputs', () => {
		expect(decodeUTF8Oracle(new Uint8Array())).toBe('')
		expect(decodeUTF16LEOracle(new Uint8Array())).toBe('')
		expect(encodeUTF8Oracle('')).toEqual(new Uint8Array())
	})
})

describe('setup generators', () => {
	it('draws the published xorshift32 stream for seed 1', () => {
		expect(buildDraws(1, 5)).toEqual([270369, 67634689, 2647435461, 307599695, 2398689233])
		expect(buildDraws(1, 0)).toEqual([])
	})

	it('draws a code point inside the band the selector names, or a boundary point', () => {
		expect(drawCodePoint(0, 0x41)).toBe(0x41)
		expect(drawCodePoint(1, 0)).toBe(0x80)
		expect(drawCodePoint(2, 0xd7ff - 0x800)).toBe(0xd7ff)
		expect(drawCodePoint(3, 0)).toBe(0xe000)
		expect(drawCodePoint(4, 0xfffff)).toBe(0x10ffff)
		expect(drawCodePoint(UTF8_BANDS.length, 0)).toBe(0x0000)
	})

	it('draws well-formed texts within the limit, opening every period with a BOM', () => {
		const texts = buildUTF8Texts(7, 64)

		expect(texts).toHaveLength(64)
		expect(texts).toEqual(buildUTF8Texts(7, 64))
		expect(texts.every((text) => text.isWellFormed())).toBe(true)
		expect(texts.every((text) => Array.from(text).length <= UTF8_TEXT_LIMIT + 1)).toBe(true)
		expect(
			texts
				.filter((_, index) => index % UTF8_BOM_PERIOD === 0)
				.every((text) => text.startsWith(String.fromCodePoint(0xfeff))),
		).toBe(true)
	})

	it('applies a substitution, an insertion, a deletion, or a truncation', () => {
		const base = new Uint8Array([0x61, 0x62, 0x63])

		expect(mutateBytes(base, 0, 1, 1, 0x7a)).toEqual(new Uint8Array([0x61, 0x7a, 0x63]))
		expect(mutateBytes(base, 1, 1, 1, 0x7a)).toEqual(new Uint8Array([0x61, 0x7a, 0x62, 0x63]))
		expect(mutateBytes(base, 2, 1, 1, 0x7a)).toEqual(new Uint8Array([0x61, 0x63]))
		expect(mutateBytes(base, 3, 1, 1, 0x7a)).toEqual(new Uint8Array([0x61]))
		expect(mutateBytes(base, 0, 0, 0, 2)).toEqual(
			new Uint8Array([UTF8_EDGE_BYTES[2] ?? -1, 0x62, 0x63]),
		)
		expect(mutateBytes(new Uint8Array(), 2, 5, 1, 0x7a)).toEqual(new Uint8Array([0x7a]))
		expect(base).toEqual(new Uint8Array([0x61, 0x62, 0x63]))
	})

	it('follows each encoded text with its mutants', () => {
		const mutants = buildUTF8Mutants(['hi', '€'], 3, 2)

		expect(mutants).toHaveLength(6)
		expect(mutants[0]).toEqual(new Uint8Array([0x68, 0x69]))
		expect(mutants[3]).toEqual(new Uint8Array([0xe2, 0x82, 0xac]))
	})

	it('draws random buffers shorter than the limit', () => {
		const buffers = buildRandomBytes(5, 128, 4)

		expect(buffers).toHaveLength(128)
		expect(buffers.every((bytes) => bytes.length < 4)).toBe(true)
		expect(new Set(buffers.map((bytes) => bytes.length)).size).toBe(4)
	})

	it('holds bytes over a supplied buffer and counts the copies taken of them', () => {
		const bytes = new RecordedBytes(new SharedArrayBuffer(4), [0x68, 0x69])
		const copy = bytes.slice()

		expect(bytes.buffer).toBeInstanceOf(SharedArrayBuffer)
		expect(copy.buffer).toBeInstanceOf(ArrayBuffer)
		expect(copy).toEqual(new Uint8Array([0x68, 0x69]))
		expect(bytes.length).toBe(2)
		expect(bytes.slices).toBe(1)
	})
})

describe('setup bench fixtures', () => {
	it('draws a run from the range its kind selects, at the length that kind admits', () => {
		const ascii = drawBenchRun(0, 0, 0)
		const astral = drawBenchRun(99, 11, 0)

		expect(ascii).toBe(String.fromCodePoint(0x20, 0x27, 0x2e, 0x35))
		expect(Array.from(ascii).length).toBe(4)
		expect(Array.from(astral)).toHaveLength(12)
		expect(
			Array.from(astral).every((character) => (character.codePointAt(0) ?? 0) >= 0x1f300),
		).toBe(true)
		expect(drawBenchRun(85, 0, 0)).toBe(String.fromCodePoint(UTF8_BENCH_RANGES[1]?.[0] ?? -1))
	})

	it('draws a mostly ASCII text carrying every width', () => {
		const text = buildBenchText(2000, 3)
		const widths = new Set(
			Array.from(text, (character) => {
				const point = character.codePointAt(0) ?? 0
				return point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4
			}),
		)
		const ascii = Array.from(text).filter((character) => (character.codePointAt(0) ?? 0) < 0x80)

		expect(text).toBe(buildBenchText(2000, 3))
		expect(text.isWellFormed()).toBe(true)
		expect([...widths].sort()).toEqual([1, 2, 3, 4])
		expect(ascii.length / Array.from(text).length).toBeGreaterThan(0.5)
	})

	it('draws short texts of 1 to 23 characters', () => {
		const texts = buildBenchStrings(500, 9)
		const lengths = texts.map((text) => Array.from(text).length)

		expect(texts).toHaveLength(500)
		expect(Math.min(...lengths)).toBe(1)
		expect(Math.max(...lengths)).toBe(23)
		expect(texts.every((text) => text.isWellFormed())).toBe(true)
	})
})
