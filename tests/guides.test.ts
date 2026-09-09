// The consumer-side guides-parity drop-in: runs `@orkestrel/guide`'s checks against
// this repo's own `guides/README.md` manifest. The constants that follow are this
// package's own, as is the executed section that closes the file.

import type { GuideModule } from '@orkestrel/guide'
import { GuideCommand } from '@orkestrel/guide/server'
import { readInventory } from '@orkestrel/test/server'
import { createVitest } from 'vitest/node'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** The true self-package root specifier. */
const ROOT = '@orkestrel/codec'
/** The one guide this package sources, whose tagline the README pitch equals. */
const GUIDE_SPEC = 'guides/codec.md'
/** Each import specifier this package's own guides may resolve against. */
const MODULES: Readonly<Record<string, GuideModule>> = Object.freeze({
	'@orkestrel/codec': 'src/core',
})
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * The alphabet and its reverse lookup are module data the codings read, not public API:
 * publishing an alphabet invites hand-rolling the coding it belongs to, which is the one thing
 * this package exists to remove. Naming them here is what makes the omission intentional rather
 * than forgotten, and the assertion that follows it fails when a name here stops being stranded,
 * so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([
	'const BASE64_ALPHABET',
	'const BASE64_LOOKUP',
	'const HEX_ALPHABET',
	'const HEX_LOOKUP',
	'const WINDOWS_1252_HIGH',
])
await new GuideCommand({
	root: new URL('../', import.meta.url),
	patterns: ['src/**/*.ts', 'tests/**/*.ts', 'guides/*.md', '*.md', 'package.json'],
	modules: MODULES,
	languages: FENCE_LANGUAGES,
	language: EXAMPLE_LANGUAGE,
	reader: readInventory,
	runner: createVitest,
}).execute(async ({ files, report, root, rows }) => {
	const { computeSymbolKey, createGuide, findMissingSymbols } = await import('@orkestrel/guide')
	const { requireValue } = await import('@orkestrel/test')
	const {
		decodeBase64,
		decodeBase64URL,
		decodeHex,
		decodeLatin1,
		decodeUTF8,
		decodeUTF16LE,
		decodeWindows1252,
		encodeBase64,
		encodeBase64URL,
		encodeHex,
		encodeLatin1,
		encodeUTF8,
		encodeUTF16LE,
		encodeWindows1252,
		isBase64,
		isBase64URL,
		isHex,
		measureBase64,
		measureBase64URL,
		measureHex,
		measureUTF8,
	} = await import('@src/core')
	const { describe, expect, it } = await import('vitest')
	const own = requireValue(
		rows.find((row) => row.entry.spec === GUIDE_SPEC),
		`Missing manifest row: ${GUIDE_SPEC}`,
	)

	it('loads every indexed guide input', () => {
		expect(root.length).toBeGreaterThan(0)
		expect(Object.keys(files).length).toBeGreaterThan(0)
		expect(report.input).toEqual([])
	})

	it('manifest lists at least one guide', () => {
		expect(rows.length).toBeGreaterThan(0)
		expect(own.entry.spec).toBe(GUIDE_SPEC)
	})

	// The example half of the equality case is silent over an empty population: with no
	// title on both sides `findDrift` compares no pair and the case passes on the summaries
	// alone. This pins the population this repository's own guide contributes, so removing
	// every `@example` title reddens the suite instead of quietly retiring half the gate.
	// The failure names both title sets, because a pin reporting only its own emptiness
	// leaves the reader to work out which side dropped the title.
	it('pairs at least one example title across the guide and the source', () => {
		expect(report.examples.titles.filter((finding) => finding.spec === GUIDE_SPEC)).toEqual([])
	})

	// The README's pitch and the guide's tagline are one text, each read as the blockquote
	// under its file's H1. `README.md` is outside the concept index, so the reader is
	// applied to it directly rather than through a manifest row. Each side is guarded
	// against `undefined` first, so a file that lost its blockquote reports that rather
	// than reporting two absences as agreement.
	it('opens the README with the guide tagline', () => {
		expect(report.pitch).toEqual([])
	})

	it('derives the exact package export keys from the same face map', () => {
		const parsed: unknown = JSON.parse(
			requireValue(files['package.json'], 'Missing file: package.json'),
		)
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('The package manifest is not a record')
		}
		const exported: unknown = Object.getOwnPropertyDescriptor(parsed, 'exports')?.value
		if (typeof exported !== 'object' || exported === null) {
			throw new Error('The package manifest declares no object exports')
		}
		const expected = Object.keys(MODULES).map((specifier) =>
			specifier === ROOT ? '.' : `.${specifier.slice(ROOT.length)}`,
		)
		expect(Object.keys(exported).sort()).toEqual(expected.concat('./package.json').sort())
	})

	for (const { entry, guide, source } of rows) {
		describe(`${entry.concept}`, () => {
			it('uses only listed fence languages', () => {
				expect(report.fences.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('extracts a non-empty documented surface', () => {
				expect(guide.surface().length).toBeGreaterThan(0)
			})
			it('re-exports every direct declaration that is not named internal', () => {
				const stranded = findMissingSymbols(source.exports(), source.surface())
				expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
			})
			it('names no symbol internal that the barrel already exports', () => {
				const stranded = findMissingSymbols(source.exports(), source.surface())
				expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
			})
			it('re-exports only direct declarations', () => {
				expect(findMissingSymbols(source.surface(), source.exports())).toEqual([])
			})
			it('documents every barrel export', () => {
				expect(findMissingSymbols(source.surface(), guide.surface())).toEqual([])
			})
			it('documents only barrel exports', () => {
				expect(findMissingSymbols(guide.surface(), source.surface())).toEqual([])
			})

			it('exposes no hidden module-scope declarations', () => {
				expect(source.hidden().map(computeSymbolKey)).toEqual([])
			})

			it('keeps behavioral interfaces and implementing classes in parity', () => {
				expect(report.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			// The equality gate: a `Summary` cell against its export's description paragraph, a
			// titled fence against the `@example` of that title. `findDrift` owns the comparison
			// and names both sides; converge the two sides through the native entry, never by
			// weakening this assertion. `findDrift` pairs an example only where a title is
			// present on both sides, so an untitled `@example` block is outside this case. Each
			// collected line is the spec, the key, and each side's text or `absent` — the same
			// worklist the native entry prints, so a failure here is read the way that command's
			// output is. Select source authority with `--to guide`, or guide authority with
			// `--to source`.
			it('keeps every compared summary and example equal to its source', () => {
				expect(report.drift.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('documents an example for every Surface function', () => {
				expect(report.examples.functions.filter((finding) => finding.spec === entry.spec)).toEqual(
					[],
				)
			})

			it('documents an example for every method', () => {
				expect(report.examples.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('imports only real exports in every ```ts fence', () => {
				expect(report.imports.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('resolves every relative link', () => {
				expect(report.links.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})
			it('links only to test files that exist', () => {
				expect(report.tests.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})
		})
	}

	// ── Flagship fence transcriptions ────────────────────────────────────────────
	//
	// Each block below is one `guides/codec.md` fence, run against the real barrel and asserting the
	// value its comment claims.

	describe('flagship fences', () => {
		const specification = requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`)

		it('carries the sections the charter fixes', () => {
			const sections = createGuide(specification).sections()

			expect(sections).toContain('Surface')
			expect(sections).toContain('The laws')
			expect(sections).toContain('Membership')
			expect(sections).toContain('Declared non-goals')
			expect(sections).toContain('Tests')
		})

		it('encodes and decodes a byte sequence', () => {
			expect(encodeBase64(new Uint8Array([104, 105]))).toBe('aGk=')
			expect(decodeBase64('aGk=')).toStrictEqual(new Uint8Array([104, 105]))
			expect(encodeBase64(new Uint8Array([]))).toBe('')
			expect(decodeBase64('')).toStrictEqual(new Uint8Array([]))
		})

		it('reaches the url face', () => {
			expect(encodeBase64URL(new Uint8Array([104, 105]))).toBe('aGk')
			expect(encodeBase64URL(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_')
			expect(decodeBase64URL('-_-_')).toStrictEqual(new Uint8Array([251, 255, 191]))
			expect(decodeBase64URL('aGk=')).toBeUndefined()
			expect(decodeBase64URL('+/+/')).toBeUndefined()
		})

		it('meets the canonical refusals', () => {
			expect(decodeBase64('aa==')).toBeUndefined()
			expect(decodeBase64('aQ==')).toStrictEqual(new Uint8Array([105]))
			expect(encodeBase64(new Uint8Array([105]))).toBe('aQ==')
			expect(decodeBase64('AQ D')).toBeUndefined()
			expect(decodeBase64('A')).toBeUndefined()
			expect(decodeBase64('AQID=')).toBeUndefined()
			expect(decodeBase64('-_-_')).toBeUndefined()
			expect(isBase64('aa==')).toBe(false)
		})

		it('asks a value whether a decoder would take it', () => {
			expect(isBase64('aGk=')).toBe(true)
			expect(isBase64('aGk')).toBe(false)
			expect(isBase64URL('aGk')).toBe(true)
			expect(isBase64URL('aGk=')).toBe(false)
			expect(isBase64URL(42)).toBe(false)
		})

		it('drives both laws', () => {
			const bytes = new Uint8Array([0, 1, 2, 253, 254, 255])
			const text = encodeBase64(bytes)

			expect(text).toBe('AAEC/f7/')
			expect(decodeBase64(text)).toStrictEqual(bytes)
			expect(isBase64(text)).toBe(true)
			expect(encodeBase64(requireValue(decodeBase64(text)))).toBe(text)
		})

		it('reads the hex face', () => {
			expect(encodeHex(new Uint8Array([0xab]))).toBe('ab')
			expect(decodeHex('ab')).toStrictEqual(new Uint8Array([171]))
			expect(decodeHex('AB')).toBeUndefined()
			expect(decodeHex('0xab')).toBeUndefined()
			expect(decodeHex('abc')).toBeUndefined()
			expect(isHex('ab')).toBe(true)
			expect(isHex('AB')).toBe(false)
		})

		it('encodes and decodes through a charset', () => {
			expect(encodeUTF8('hi')).toStrictEqual(new Uint8Array([104, 105]))
			expect(decodeUTF8(new Uint8Array([104, 105]))).toBe('hi')
			expect(encodeUTF8('\ud800')).toBeUndefined()
			expect(decodeUTF8(new Uint8Array([0xc0, 0x80]))).toBeUndefined()
			expect(decodeUTF8(new Uint8Array([0xef, 0xbb, 0xbf]))).toBe('\ufeff')

			expect(encodeLatin1('é')).toStrictEqual(new Uint8Array([233]))
			expect(decodeLatin1(new Uint8Array([0x80]))).toBe('\u0080')
			expect(encodeLatin1('Ā')).toBeUndefined()

			expect(encodeWindows1252('€')).toStrictEqual(new Uint8Array([128]))
			expect(decodeWindows1252(new Uint8Array([0x80]))).toBe('€')
			expect(decodeWindows1252(new Uint8Array([0x81]))).toBeUndefined()

			expect(encodeUTF16LE('hi')).toStrictEqual(new Uint8Array([104, 0, 105, 0]))
			expect(decodeUTF16LE(new Uint8Array([0x68]))).toBeUndefined()
			expect(decodeUTF16LE(new Uint8Array([0x00, 0xd8]))).toBeUndefined()
		})

		it('measures without producing the bytes', () => {
			expect(measureBase64('aGk=')).toBe(2)
			expect(measureBase64('aa==')).toBeUndefined()
			expect(measureBase64URL('aGk')).toBe(2)
			expect(measureBase64URL('aGk=')).toBeUndefined()
			expect(measureHex('abcd')).toBe(2)
			expect(measureHex('AB')).toBeUndefined()

			expect(measureUTF8('hi')).toBe(2)
			expect(measureUTF8('é')).toBe(2)
			expect(measureUTF8('€')).toBe(3)
			expect(measureUTF8('\u{10000}')).toBe(4)
			expect(measureUTF8('\ud800')).toBeUndefined()
		})
		// The canonical-form ruling the guide states in prose. A sentence about behaviour passes every
		// parity assertion whether or not it is true, so the sentence is bound here and then driven:
		// the refused text, its canonical neighbour, and the same pair on the url face.
		it('states and proves the ruling on a non-zero unused trailing bit', () => {
			const prose = specification.replace(/\s+/gu, ' ')

			expect(prose).toContain(
				"`'aQ=='` is the canonical spelling of the byte `'aa=='` was reaching for, and it decodes.",
			)
			expect(prose).toContain("The url face refuses `'aa'` for the same reason, and admits `'aQ'`.")
			expect(decodeBase64('aa==')).toBeUndefined()
			expect(isBase64('aa==')).toBe(false)
			expect(encodeBase64(requireValue(decodeBase64('aQ==')))).toBe('aQ==')
			expect(decodeBase64URL('aa')).toBeUndefined()
			expect(isBase64URL('aa')).toBe(false)
			expect(encodeBase64URL(requireValue(decodeBase64URL('aQ')))).toBe('aQ')
		})
	})
})
