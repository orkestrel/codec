// The guides-parity gate: @orkestrel/guide's checks run against this repository's own
// `guides/README.md` manifest, and every flagship fence in `guides/codec.md` is transcribed here
// and asserted against what its comments claim. Name resolution is not a behavioural proof, so a
// fence documenting a value the code contradicts is exactly what the transcriptions catch. Change
// a fence, change its transcription.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	createGuide,
	createSource,
	createSourceManager,
	extractSourceLines,
	fenceImports,
	findMissing,
	findUnexampled,
	findUnlisted,
	isExternalLink,
	missingSymbols,
	parseManifest,
	resolveLink,
	symbolKey,
} from '@orkestrel/guide'
import { requireValue } from '@orkestrel/test'
import { readInventory } from '@orkestrel/test/server'
import {
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
} from '@src/core'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** The true self-package root specifier. */
const ROOT = '@orkestrel/codec'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ '@orkestrel/codec': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `symbolKey` strings.
 *
 * The alphabet and its reverse lookup are module data the codings read, not public API:
 * publishing an alphabet invites hand-rolling the coding it belongs to, which is the one thing
 * this package exists to remove. Naming them here is what makes the omission intentional rather
 * than forgotten, and the assertion below fails when a name here stops being stranded, so the
 * list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([
	'const BASE64_ALPHABET',
	'const BASE64_LOOKUP',
	'const HEX_ALPHABET',
	'const HEX_LOOKUP',
	'const WINDOWS_1252_HIGH',
])
/** Root-level files this package's guides link to. `readInventory` walks directories only. */
const ROOT_FILES = Object.freeze(['AGENTS.md'])

const root = new URL('../', import.meta.url)
const files: Record<string, string> = {
	...readInventory(root, ['src', 'guides', 'tests'], { extensions: ['.ts', '.md'] }),
}
for (const name of ROOT_FILES) files[name] = readFileSync(new URL(name, root), 'utf8')
const manifest = parseManifest(
	requireValue(files['guides/README.md'], 'Missing file: guides/README.md'),
	'guides',
)
const sources = createSourceManager({ files, modules: MODULES })
const specification = requireValue(files['guides/codec.md'], 'Missing file: guides/codec.md')

it('manifest lists at least one guide', () => {
	expect(manifest.length).toBeGreaterThan(0)
})

it('derives the exact package export keys from the same face map', () => {
	const parsed: unknown = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
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

for (const entry of manifest) {
	const guide = createGuide(requireValue(files[entry.spec], `Missing file: ${entry.spec}`))
	const source = createSource({ files, module: entry.source })

	describe(`${entry.concept}`, () => {
		it('uses only listed fence languages', () => {
			expect(findUnlisted(guide.fences(), FENCE_LANGUAGES)).toEqual([])
		})

		it('extracts non-empty barrel and documented surfaces', () => {
			expect(source.surface().length).toBeGreaterThan(0)
			expect(guide.surface().length).toBeGreaterThan(0)
		})
		it('re-exports every direct declaration that is not named internal', () => {
			const stranded = missingSymbols(source.exports(), source.surface())
			expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
		})
		it('names no symbol internal that the barrel already exports', () => {
			const stranded = missingSymbols(source.exports(), source.surface())
			expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
		})
		it('re-exports only direct declarations', () => {
			expect(missingSymbols(source.surface(), source.exports())).toEqual([])
		})
		it('documents every barrel export', () => {
			expect(missingSymbols(source.surface(), guide.surface())).toEqual([])
		})
		it('documents only barrel exports', () => {
			expect(missingSymbols(guide.surface(), source.surface())).toEqual([])
		})

		it('exposes no hidden module-scope declarations', () => {
			expect(source.hidden().map(symbolKey)).toEqual([])
		})

		for (const group of guide.methods()) {
			const members = source.methods(group.interface)
			const entity = group.interface.replace(/Interface$/u, '')
			describe(`${group.interface}`, () => {
				it('documents at least one method', () => {
					expect(group.methods.length).toBeGreaterThan(0)
				})
				it('documents every interface method', () => {
					expect(findMissing(members, group.methods)).toEqual([])
				})
				it('documents no phantom method', () => {
					expect(findMissing(group.methods, members)).toEqual([])
				})
				it(`${entity} exposes no undocumented method`, () => {
					const extra =
						entity === group.interface ? [] : findMissing(source.methods(entity), group.methods)
					expect(extra).toEqual([])
				})
			})
		}

		it('documents an example for every Surface function', () => {
			const fences = guide
				.fences()
				.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
				.map((fence) => fence.code)
			const names = guide
				.surface()
				.filter((symbol) => symbol.kind === 'function')
				.map((symbol) => symbol.name)
			expect(names.length).toBeGreaterThan(0)
			expect(findUnexampled(names, fences, source.examples())).toEqual([])
		})

		// The membership rule is `fenceImports`'s own grammar read off Guide's comment-aware source
		// projection: a mapped specifier's bindings compare against that face's barrel surface, a
		// repository alias and an unmapped true subpath of the root are refused because a public
		// guide example must import through a published specifier, and a foreign package stays
		// external and is compared against no face.
		it('imports only real exports through published specifiers in every ts fence', () => {
			const refused: string[] = []
			const missing: string[] = []
			for (const fence of guide.fences().filter((row) => row.language === EXAMPLE_LANGUAGE)) {
				const projected = extractSourceLines(fence.code)
					.map((line) => line.code)
					.join('\n')
				for (const statement of fenceImports(projected)) {
					const specifier = statement.specifier
					if (specifier.startsWith('@src/') || specifier.startsWith('@app/')) {
						refused.push(specifier)
						continue
					}
					const face = sources.source(specifier)
					if (face === undefined) {
						if (specifier === ROOT || specifier.startsWith(`${ROOT}/`)) refused.push(specifier)
						continue
					}
					missing.push(
						...findMissing(
							statement.names,
							face.surface().map((symbol) => symbol.name),
						),
					)
				}
			}
			expect(refused).toEqual([])
			expect(missing).toEqual([])
		})

		it('resolves every relative link', () => {
			const broken = guide
				.links()
				.filter((href) => !isExternalLink(href))
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(broken).toEqual([])
		})
		it('links only to test files that exist', () => {
			const missing = guide
				.tests()
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(guide.tests().length).toBeGreaterThan(0)
			expect(missing).toEqual([])
		})
		// The Tests section is an inventory of what this package proves, so a proof that exists and
		// is not listed is the defect. Listing is asserted as membership against the real test tree,
		// because a count passes while the tree grows a file the section never gained.
		it('lists every test file the repository carries', () => {
			const listed = guide.tests().map((href) => resolveLink(entry.spec, href))
			const present = Object.keys(files).filter((path) => path.endsWith('.test.ts'))

			expect(present.length).toBeGreaterThan(0)
			expect(present.filter((path) => !listed.includes(path))).toEqual([])
		})
	})
}

// ── Flagship fence transcriptions ────────────────────────────────────────────
//
// Each block below is one `guides/codec.md` fence, run against the real barrel and asserting the
// value its comment claims.

describe('flagship fences', () => {
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
		expect(decodeBase64('AQ ID')).toBeUndefined()
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
