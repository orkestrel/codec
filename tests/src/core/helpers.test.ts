import { describe, expect, it } from 'vitest'
import { createHostileValues, requireValue } from '@orkestrel/test'
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
	isLatin1,
	isUTF8,
	isUTF16LE,
	isWindows1252,
	measureBase64,
	measureBase64URL,
	measureHex,
	measureUTF8,
} from '@src/core'
import { WINDOWS_1252_HIGH } from '../../../src/core/constants.js'
import {
	decodeUTF8Oracle,
	decodeUTF16LEOracle,
	encodeUTF8Oracle,
	FOREIGN,
	FOREIGN_BYTES,
	HEX_MEASURE_TEXTS,
	HEX_MEASURES,
	HEX_MEMBERSHIP,
	HEX_OCTETS,
	HEX_SWEEP,
	ILL_FORMED,
	LATIN1_OCTETS,
	LATIN1_REFUSALS,
	MEASURE_MUTANTS,
	MEASURE_TEXTS,
	MEASURES,
	MEMBERSHIP,
	OCTETS,
	RFC_STANDARD,
	RFC_URL,
	SEXTETS,
	SWEEP,
	TEXTS,
	UTF8_BOUNDARIES,
	UTF8_MEASURE_TEXTS,
	UTF8_MEASURES,
	UTF8_REFUSALS,
	UTF16_REFUSALS,
	VECTORS,
	WINDOWS_1252_INDEX,
	WINDOWS_1252_OCTETS,
	WINDOWS_1252_REFUSALS,
	WINDOWS_1252_UNDEFINED,
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
		expect(decodeHex(encodeHex(OCTETS))).toStrictEqual(OCTETS)
	})

	it('round-trips every padding residue', () => {
		for (let length = 0; length <= 3; length += 1) {
			const bytes = OCTETS.slice(0, length)

			expect(decodeBase64(encodeBase64(bytes)), `length ${length}`).toStrictEqual(bytes)
			expect(decodeBase64URL(encodeBase64URL(bytes)), `length ${length}`).toStrictEqual(bytes)
			expect(decodeHex(encodeHex(bytes)), `length ${length}`).toStrictEqual(bytes)
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

	it('round-trips the empty sequence and the empty text through the hex face', () => {
		expect(encodeHex(new Uint8Array([]))).toBe('')
		expect(decodeHex('')).toStrictEqual(new Uint8Array([]))
	})

	it('round-trips every single byte through the hex face', () => {
		for (const value of OCTETS) {
			const bytes = new Uint8Array([value])

			expect(decodeHex(encodeHex(bytes)), `byte ${value}`).toStrictEqual(bytes)
		}
	})

	it('round-trips every byte pair through the hex face', () => {
		const drift: string[] = []
		for (const first of OCTETS) {
			for (const second of OCTETS) {
				const bytes = new Uint8Array([first, second])
				const decoded = decodeHex(encodeHex(bytes))
				if (decoded === undefined || decoded[0] !== first || decoded[1] !== second) {
					drift.push(`§8 ${first},${second}`)
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

	it('re-encodes every admitted hex sweep text to itself', () => {
		const admitted = HEX_SWEEP.filter((text) => isHex(text))

		expect(admitted.length).toBeGreaterThan(0)
		expect(HEX_SWEEP.length).toBeGreaterThan(admitted.length)
		expect(admitted.filter((text) => encodeHex(requireValue(decodeHex(text))) !== text)).toEqual([])
	})

	it('refuses every uppercase spelling the hex sweep carries', () => {
		const uppercase = HEX_SWEEP.filter(
			(text) => text !== text.toLowerCase() && isHex(text.toLowerCase()),
		)

		expect(uppercase.length).toBeGreaterThan(0)
		expect(uppercase.filter((text) => isHex(text))).toEqual([])
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

describe('the iff law — isHex names exactly what decodeHex accepts', () => {
	for (const row of HEX_MEMBERSHIP) {
		it(`answers the declared membership for ${JSON.stringify(row.text)} — ${row.reason}`, () => {
			const expected = row.bytes === undefined ? undefined : new Uint8Array(row.bytes)

			expect(isHex(row.text)).toBe(row.bytes !== undefined)
			expect(decodeHex(row.text)).toStrictEqual(expected)
		})
	}
})

describe('the measure law — a measure answers the byte-side size without producing the bytes', () => {
	// Two independent walks per face: the measure computes the size from the text and the partner
	// function reports the length of bytes it actually wrote. Neither asks the other, so a grammar
	// rule one of them stops enforcing shows up here as a disagreement. The partner is the decoder on
	// the RFC 4648 faces, whose wire form is text, and the encoder on the UTF-8 face, whose wire form
	// is bytes.
	it('agrees with decodeBase64 on every sweep text', () => {
		const drift = MEASURE_TEXTS.filter((text) => measureBase64(text) !== decodeBase64(text)?.length)

		expect(MEASURE_TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('agrees with decodeBase64URL on every sweep text', () => {
		const drift = MEASURE_TEXTS.filter(
			(text) => measureBase64URL(text) !== decodeBase64URL(text)?.length,
		)

		expect(MEASURE_TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('agrees with decodeHex on every hex sweep text', () => {
		const drift = HEX_MEASURE_TEXTS.filter((text) => measureHex(text) !== decodeHex(text)?.length)

		expect(HEX_MEASURE_TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('agrees with every decoder on every canonical encoding of a byte prefix', () => {
		const drift: string[] = []
		for (let length = 0; length <= OCTETS.length; length += 1) {
			const bytes = OCTETS.slice(0, length)
			if (measureBase64(encodeBase64(bytes)) !== length) drift.push(`§4 length ${length}`)
			if (measureBase64URL(encodeBase64URL(bytes)) !== length) drift.push(`§5 length ${length}`)
			if (measureHex(encodeHex(bytes)) !== length) drift.push(`§8 length ${length}`)
		}
		expect(drift).toEqual([])
	})

	// The sweep texts stop at four characters, so a refusal there is never far from the start. The
	// mutants carry one defect inside an otherwise canonical encoding of up to 24 bytes, which is the
	// class those short texts cannot witness. This case reads what the population actually reaches on
	// each face rather than only its size, because a mutant set that happened to admit everything
	// would pass the law sweep while proving nothing about a refusal.
	it('carries admitted and refused mutants on every face', () => {
		const reach = {
			standard: MEASURE_MUTANTS.filter((text) => measureBase64(text) !== undefined),
			url: MEASURE_MUTANTS.filter((text) => measureBase64URL(text) !== undefined),
			hex: MEASURE_MUTANTS.filter((text) => measureHex(text) !== undefined),
		}
		const longest = MEASURE_MUTANTS.reduce((width, text) => Math.max(width, text.length), 0)

		expect(longest).toBeGreaterThan(4)
		for (const [face, admitted] of Object.entries(reach)) {
			expect(admitted.length, `${face} admits nothing`).toBeGreaterThan(0)
			expect(admitted.length, `${face} refuses nothing`).toBeLessThan(MEASURE_MUTANTS.length)
		}
	})

	it('agrees with encodeUTF8 on every text the UTF-8 measure population reaches', () => {
		const drift = UTF8_MEASURE_TEXTS.filter(
			(text) => measureUTF8(text) !== encodeUTF8(text)?.length,
		)

		expect(UTF8_MEASURE_TEXTS.length).toBeGreaterThan(0)
		expect(
			UTF8_MEASURE_TEXTS.filter((text) => measureUTF8(text) === undefined).length,
		).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('measures every UTF-8 width boundary at the width the specification fixes', () => {
		for (const row of UTF8_BOUNDARIES) {
			const text = String.fromCodePoint(row.point)

			expect(measureUTF8(text), `U+${row.point.toString(16)} — ${row.reason}`).toBe(row.width)
			expect(measureUTF8(text), `U+${row.point.toString(16)}`).toBe(encodeUTF8(text)?.length)
		}
	})

	for (const row of UTF8_MEASURES) {
		it(`measures ${JSON.stringify(row.text)} in the UTF-8 face — ${row.reason}`, () => {
			expect(measureUTF8(row.text)).toBe(row.length)
			expect(measureUTF8(row.text)).toBe(encodeUTF8(row.text)?.length)
		})
	}

	for (const row of MEASURES) {
		it(`measures ${JSON.stringify(row.text)} in both Base64 faces — ${row.reason}`, () => {
			expect(measureBase64(row.text)).toBe(row.standard)
			expect(measureBase64URL(row.text)).toBe(row.url)
			expect(measureBase64(row.text)).toBe(decodeBase64(row.text)?.length)
			expect(measureBase64URL(row.text)).toBe(decodeBase64URL(row.text)?.length)
		})
	}

	for (const row of HEX_MEASURES) {
		it(`measures ${JSON.stringify(row.text)} in the hex face — ${row.reason}`, () => {
			expect(measureHex(row.text)).toBe(row.length)
			expect(measureHex(row.text)).toBe(decodeHex(row.text)?.length)
		})
	}

	// The membership ruling the guide states for the charsets that ship no measure. Each encoder named
	// here writes a fixed number of bytes per code unit, so the wire size is `text.length`
	// arithmetic behind the guard the encoder already applies — a measure there would name no walk
	// its encoder skips. This case is what breaks if that stops being true.
	it('leaves the fixed-width charsets no size question a measure would answer', () => {
		const drift: string[] = []
		let admitted = 0
		for (const text of TEXTS) {
			const latin1 = encodeLatin1(text)
			const windows = encodeWindows1252(text)
			const utf16 = encodeUTF16LE(text)
			if (latin1 !== undefined && latin1.length !== text.length) drift.push(`Latin-1 ${text}`)
			if (windows !== undefined && windows.length !== text.length)
				drift.push(`Windows-1252 ${text}`)
			if (utf16 === undefined || utf16.length !== text.length * 2) drift.push(`UTF-16LE ${text}`)
			if (latin1 !== undefined) admitted += 1
		}

		expect(admitted).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})
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

	// The hex oracle is the language's own radix conversion, which knows nothing about HEX_LOOKUP,
	// so a table entry that drifts from the specification disagrees with it in both directions.
	it('spells every octet the way the radix oracle spells it', () => {
		for (const value of OCTETS) {
			expect(encodeHex(new Uint8Array([value])), `byte ${value}`).toBe(HEX_OCTETS[value])
		}
	})

	it('reads every oracle spelling back to its octet', () => {
		for (const value of OCTETS) {
			expect(decodeHex(requireValue(HEX_OCTETS[value])), `byte ${value}`).toStrictEqual(
				new Uint8Array([value]),
			)
		}
	})

	it('refuses each face the characters the other one owns', () => {
		expect(decodeBase64('-_-_')).toBeUndefined()
		expect(decodeBase64URL('+/+/')).toBeUndefined()
		expect(isBase64('-_-_')).toBe(false)
		expect(isBase64URL('+/+/')).toBe(false)
	})
})

// The charset codings run the other way round: bytes are the wire form, so `encode*` takes text and
// `decode*` takes bytes. The two laws survive that inversion unchanged, and the following sweeps
// drive them in the direction each coding's partial function points.
//
// Every platform oracle here was probed before a sweep was written against it, and each probed
// divergence bounds the population the oracle is allowed to judge. The `latin1` label is not used
// at all: it reports `encoding === 'windows-1252'`, so `String.fromCharCode` — the coding's own
// definition — is the ISO-8859-1 oracle instead, carried by LATIN1_OCTETS.

describe('the round-trip law — the charset codings', () => {
	it('round-trips every well-formed text through UTF-8 and UTF-16LE', () => {
		const drift: string[] = []
		for (const text of TEXTS) {
			const utf8 = encodeUTF8(text)
			const utf16 = encodeUTF16LE(text)
			if (utf8 === undefined || decodeUTF8(utf8) !== text)
				drift.push(`UTF-8 ${JSON.stringify(text)}`)
			if (utf16 === undefined || decodeUTF16LE(utf16) !== text) {
				drift.push(`UTF-16LE ${JSON.stringify(text)}`)
			}
		}

		expect(TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('spells every UTF-8 width boundary at the width the specification fixes', () => {
		for (const row of UTF8_BOUNDARIES) {
			const text = String.fromCodePoint(row.point)
			const bytes = requireValue(encodeUTF8(text), `U+${row.point.toString(16)}`)

			expect(bytes.length, `U+${row.point.toString(16)} — ${row.reason}`).toBe(row.width)
			expect(decodeUTF8(bytes), `U+${row.point.toString(16)}`).toBe(text)
			expect(decodeUTF16LE(requireValue(encodeUTF16LE(text))), `U+${row.point.toString(16)}`).toBe(
				text,
			)
		}
	})

	it('round-trips the whole octet space through the Latin-1 face in one buffer', () => {
		expect(encodeLatin1(decodeLatin1(OCTETS))).toStrictEqual(OCTETS)
	})

	it('round-trips every single byte through the Latin-1 face', () => {
		for (const value of OCTETS) {
			const bytes = new Uint8Array([value])

			expect(encodeLatin1(decodeLatin1(bytes)), `byte ${value}`).toStrictEqual(bytes)
		}
	})

	it('round-trips every defined Windows-1252 byte in both directions', () => {
		const drift: string[] = []
		for (const value of OCTETS) {
			const bytes = new Uint8Array([value])
			const text = decodeWindows1252(bytes)
			if (WINDOWS_1252_UNDEFINED.includes(value)) {
				if (text !== undefined) drift.push(`slot ${value} admitted`)
				continue
			}
			if (text === undefined) drift.push(`byte ${value} refused`)
			else if (encodeWindows1252(text)?.[0] !== value) drift.push(`byte ${value} re-encoded`)
		}

		expect(drift).toEqual([])
	})

	it('round-trips every text the Latin-1 and Windows-1252 faces admit', () => {
		const latin1 = TEXTS.filter((text) => isLatin1(text))
		const windows = TEXTS.filter((text) => encodeWindows1252(text) !== undefined)

		expect(latin1.length).toBeGreaterThan(0)
		expect(windows.length).toBeGreaterThan(0)
		expect(TEXTS.length).toBeGreaterThan(latin1.length)
		expect(TEXTS.length).toBeGreaterThan(windows.length)
		expect(
			latin1.filter((text) => decodeLatin1(requireValue(encodeLatin1(text))) !== text),
		).toEqual([])
		expect(
			windows.filter((text) => decodeWindows1252(requireValue(encodeWindows1252(text))) !== text),
		).toEqual([])
	})
})

describe('the canonical-form law — re-encoding admitted bytes returns the bytes', () => {
	// Two independent walks meet here: the decoder reads the byte grammar and the encoder writes it
	// back from the text alone. A width rule one of them stops enforcing shows up as a disagreement
	// over the exhaustive two-byte space rather than as a spot vector.
	it('re-encodes every admitted byte pair through the UTF-8 and UTF-16LE faces', () => {
		const drift: string[] = []
		let admittedUTF8 = 0
		let admittedUTF16 = 0
		for (let first = 0; first < 256; first += 1) {
			for (let second = 0; second < 256; second += 1) {
				const bytes = new Uint8Array([first, second])
				const utf8 = decodeUTF8(bytes)
				const utf16 = decodeUTF16LE(bytes)
				if (utf8 !== undefined) {
					admittedUTF8 += 1
					const back = encodeUTF8(utf8)
					if (back === undefined || back[0] !== first || back[1] !== second) {
						drift.push(`UTF-8 ${first},${second}`)
					}
				}
				if (utf16 !== undefined) {
					admittedUTF16 += 1
					const back = encodeUTF16LE(utf16)
					if (back === undefined || back[0] !== first || back[1] !== second) {
						drift.push(`UTF-16LE ${first},${second}`)
					}
				}
			}
		}

		expect(admittedUTF8).toBeGreaterThan(0)
		expect(admittedUTF16).toBeGreaterThan(0)
		expect(admittedUTF8).toBeLessThan(65536)
		expect(admittedUTF16).toBeLessThan(65536)
		expect(drift).toEqual([])
	})

	it('re-encodes every admitted byte pair through the Latin-1 and Windows-1252 faces', () => {
		const drift: string[] = []
		for (let first = 0; first < 256; first += 1) {
			for (let second = 0; second < 256; second += 1) {
				const bytes = new Uint8Array([first, second])
				const latin1 = encodeLatin1(decodeLatin1(bytes))
				if (latin1 === undefined || latin1[0] !== first || latin1[1] !== second) {
					drift.push(`Latin-1 ${first},${second}`)
				}
				const text = decodeWindows1252(bytes)
				if (text === undefined) continue
				const back = encodeWindows1252(text)
				if (back === undefined || back[0] !== first || back[1] !== second) {
					drift.push(`Windows-1252 ${first},${second}`)
				}
			}
		}

		expect(drift).toEqual([])
	})

	it('reads the Windows-1252 defined mapping as a bijection', () => {
		const owner = new Map<string, number>()
		const collisions: string[] = []
		for (const value of OCTETS) {
			const text = decodeWindows1252(new Uint8Array([value]))
			if (text === undefined) continue
			const previous = owner.get(text)
			if (previous !== undefined) collisions.push(`${previous},${value}`)
			owner.set(text, value)
		}

		expect(collisions).toEqual([])
		expect(owner.size).toBe(OCTETS.length - WINDOWS_1252_UNDEFINED.length)
	})

	it('reads the Latin-1 mapping as the identity bijection', () => {
		const drift: string[] = []
		for (const value of OCTETS) {
			const text = decodeLatin1(new Uint8Array([value]))
			if (text.length !== 1 || text.codePointAt(0) !== value) drift.push(`byte ${value}`)
		}

		expect(drift).toEqual([])
		expect(new Set(LATIN1_OCTETS).size).toBe(OCTETS.length)
	})
})

describe('the strict refusals — each charset door, pinned', () => {
	for (const row of UTF8_REFUSALS) {
		it(`refuses ${JSON.stringify(row.bytes)} on the UTF-8 face — ${row.reason}`, () => {
			const bytes = new Uint8Array(row.bytes)

			expect(decodeUTF8(bytes)).toBeUndefined()
			expect(isUTF8(bytes)).toBe(false)
		})
	}

	for (const row of UTF16_REFUSALS) {
		it(`refuses ${JSON.stringify(row.bytes)} on the UTF-16LE face — ${row.reason}`, () => {
			const bytes = new Uint8Array(row.bytes)

			expect(decodeUTF16LE(bytes)).toBeUndefined()
			expect(isUTF16LE(bytes)).toBe(false)
		})
	}

	for (const value of WINDOWS_1252_UNDEFINED) {
		it(`refuses the undefined Windows-1252 slot 0x${value.toString(16)}`, () => {
			const bytes = new Uint8Array([value])

			expect(decodeWindows1252(bytes)).toBeUndefined()
			expect(isWindows1252(bytes)).toBe(false)
			// The WHATWG index maps this slot to its own C1 control, so the platform oracle admits
			// exactly what this coding refuses. That divergence is the reason the oracle sweep runs
			// over the defined bytes alone.
			expect(WINDOWS_1252_OCTETS[value]).toBe(String.fromCharCode(value))
		})
	}

	for (const row of LATIN1_REFUSALS) {
		it(`refuses ${JSON.stringify(row.text)} on the Latin-1 face — ${row.reason}`, () => {
			expect(encodeLatin1(row.text)).toBeUndefined()
			expect(isLatin1(row.text)).toBe(false)
		})
	}

	for (const row of WINDOWS_1252_REFUSALS) {
		it(`refuses ${JSON.stringify(row.text)} on the Windows-1252 face — ${row.reason}`, () => {
			expect(encodeWindows1252(row.text)).toBeUndefined()
		})
	}

	for (const row of ILL_FORMED) {
		it(`refuses ${JSON.stringify(row.text)} on both text sides — ${row.reason}`, () => {
			expect(row.text.isWellFormed()).toBe(false)
			expect(encodeUTF8(row.text)).toBeUndefined()
			expect(encodeUTF16LE(row.text)).toBeUndefined()
		})
	}

	it('refuses every C1 control on the Windows-1252 text side', () => {
		const admitted: number[] = []
		for (let point = 0x80; point <= 0x9f; point += 1) {
			if (encodeWindows1252(String.fromCharCode(point)) !== undefined) admitted.push(point)
		}

		expect(admitted).toEqual([])
	})
})

describe('the platform oracles — the same codings, read by a mechanism that can disagree', () => {
	it('decodes every byte pair the way the strict UTF-8 and UTF-16LE decoders do', () => {
		const drift: string[] = []
		for (let first = 0; first < 256; first += 1) {
			for (let second = 0; second < 256; second += 1) {
				const bytes = new Uint8Array([first, second])
				if (decodeUTF8(bytes) !== decodeUTF8Oracle(bytes)) drift.push(`UTF-8 ${first},${second}`)
				if (decodeUTF16LE(bytes) !== decodeUTF16LEOracle(bytes)) {
					drift.push(`UTF-16LE ${first},${second}`)
				}
			}
		}

		expect(drift).toEqual([])
	})

	// The two-byte sweep reads every pair as a whole buffer, so it never presents a defect that sits
	// inside a longer sequence with valid text on both sides. Wrapping each pair between two `A`
	// bytes moves every one of those pairs into the middle of a buffer the decoder has already
	// started walking, which is where a width that consumes one byte too many or a continuation
	// check that runs off the end shows up.
	it('decodes every embedded byte pair the way the strict UTF-8 decoder does', () => {
		const drift: string[] = []
		let admitted = 0
		for (let first = 0; first < 256; first += 1) {
			for (let second = 0; second < 256; second += 1) {
				const bytes = new Uint8Array([0x41, first, second, 0x41])
				const ours = decodeUTF8(bytes)
				if (ours !== undefined) admitted += 1
				if (ours !== decodeUTF8Oracle(bytes)) drift.push(`${first},${second}`)
			}
		}

		expect(admitted).toBeGreaterThan(0)
		expect(admitted).toBeLessThan(65536)
		expect(drift).toEqual([])
	})

	// A canonical encoding mutated one byte at a time reaches the defects a pair sweep cannot reach
	// at all: the overlong spellings of a four-byte code point, the encoded surrogates a canonical
	// U+D7FF sits one lead byte away from, and every continuation byte that stops being one.
	it('decodes every one-byte mutation of every boundary encoding the way the oracle does', () => {
		const drift: string[] = []
		let admitted = 0
		let compared = 0
		for (const row of UTF8_BOUNDARIES) {
			const canonical = requireValue(
				encodeUTF8(String.fromCodePoint(row.point)),
				`U+${row.point.toString(16)}`,
			)
			for (let position = 0; position < canonical.length; position += 1) {
				for (let value = 0; value < 256; value += 1) {
					const bytes = Uint8Array.from(canonical)
					bytes[position] = value
					compared += 1
					const ours = decodeUTF8(bytes)
					if (ours !== undefined) admitted += 1
					if (ours !== decodeUTF8Oracle(bytes)) {
						drift.push(`U+${row.point.toString(16)} at ${position} as ${value}`)
					}
				}
			}
		}

		expect(compared).toBe(UTF8_BOUNDARIES.reduce((total, row) => total + row.width, 0) * 256)
		expect(admitted).toBeGreaterThan(0)
		expect(admitted).toBeLessThan(compared)
		expect(drift).toEqual([])
	})

	// The written-out high table and the WHATWG index share no provenance with each other, but the
	// index defines all 256 slots, so it is silent on exactly the omissions that make this code page
	// what it is. WINDOWS_1252_INDEX is the second mechanism that can speak there: a hand
	// transcription of the published table, carrying the characters rather than their code points and
	// omitting the undefined slots, the way RFC_STANDARD is the second mechanism for the alphabets.
	it('reads the written-out high table entry by entry against the published index', () => {
		const drift: string[] = []
		for (const [key, point] of Object.entries(WINDOWS_1252_HIGH)) {
			const character = WINDOWS_1252_INDEX[key]
			if (character === undefined) drift.push(`${key} absent from the index`)
			else if (character.codePointAt(0) !== point) drift.push(`${key} names another character`)
		}
		const extra = Object.keys(WINDOWS_1252_INDEX).filter(
			(key) => !Object.hasOwn(WINDOWS_1252_HIGH, key),
		)

		expect(drift).toEqual([])
		expect(extra).toEqual([])
		expect(Object.keys(WINDOWS_1252_INDEX).length).toBe(0x20 - WINDOWS_1252_UNDEFINED.length)
		expect(
			WINDOWS_1252_UNDEFINED.filter((value) => Object.hasOwn(WINDOWS_1252_INDEX, String(value))),
		).toEqual([])
	})

	it('decodes every single byte and every pinned refusal the way the oracles do', () => {
		const drift: string[] = []
		for (const value of OCTETS) {
			const bytes = new Uint8Array([value])
			if (decodeUTF8(bytes) !== decodeUTF8Oracle(bytes)) drift.push(`byte ${value}`)
		}
		for (const row of [...UTF8_REFUSALS, ...UTF16_REFUSALS]) {
			const bytes = new Uint8Array(row.bytes)
			if (decodeUTF8(bytes) !== decodeUTF8Oracle(bytes)) drift.push(`UTF-8 ${row.reason}`)
			if (decodeUTF16LE(bytes) !== decodeUTF16LEOracle(bytes)) drift.push(`UTF-16LE ${row.reason}`)
		}

		expect(drift).toEqual([])
	})

	it('encodes every well-formed text the way the platform encoder does', () => {
		const drift: string[] = []
		for (const text of TEXTS) {
			const ours = requireValue(encodeUTF8(text), JSON.stringify(text))
			const theirs = encodeUTF8Oracle(text)
			if (ours.length !== theirs.length) drift.push(`length ${JSON.stringify(text)}`)
			else if (theirs.some((byte, index) => ours[index] !== byte)) drift.push(JSON.stringify(text))
		}

		expect(TEXTS.length).toBeGreaterThan(0)
		expect(drift).toEqual([])
	})

	it('reads its own UTF-16LE encodings back through the platform decoder', () => {
		const drift: string[] = []
		for (const text of TEXTS) {
			const bytes = requireValue(encodeUTF16LE(text), JSON.stringify(text))
			if (decodeUTF16LEOracle(bytes) !== text) drift.push(JSON.stringify(text))
		}

		expect(drift).toEqual([])
	})

	// The oracle here is restricted to the bytes it agrees on. The WHATWG windows-1252 index defines
	// an entry for every byte, so it cannot judge the slots this coding refuses; those are pinned
	// directly in the strict-refusal rows instead.
	it('decodes every defined Windows-1252 byte the way the WHATWG index does', () => {
		const drift: string[] = []
		let compared = 0
		for (const value of OCTETS) {
			if (WINDOWS_1252_UNDEFINED.includes(value)) continue
			compared += 1
			if (decodeWindows1252(new Uint8Array([value])) !== WINDOWS_1252_OCTETS[value]) {
				drift.push(`byte ${value}`)
			}
		}

		expect(compared).toBe(OCTETS.length - WINDOWS_1252_UNDEFINED.length)
		expect(drift).toEqual([])
	})

	it('encodes every defined Windows-1252 character back to the byte the index names', () => {
		const drift: string[] = []
		for (const value of OCTETS) {
			if (WINDOWS_1252_UNDEFINED.includes(value)) continue
			const character = requireValue(WINDOWS_1252_OCTETS[value], `byte ${value}`)
			if (encodeWindows1252(character)?.[0] !== value) drift.push(`byte ${value}`)
		}

		expect(drift).toEqual([])
	})

	it('decodes every byte the way ISO-8859-1 defines it, which the latin1 label does not', () => {
		const drift: string[] = []
		const labelDisagrees: number[] = []
		for (const value of OCTETS) {
			const character = requireValue(LATIN1_OCTETS[value], `byte ${value}`)
			if (decodeLatin1(new Uint8Array([value])) !== character) drift.push(`byte ${value}`)
			if (WINDOWS_1252_OCTETS[value] !== character) labelDisagrees.push(value)
		}

		expect(drift).toEqual([])
		// The WHATWG `latin1` label is windows-1252, so the two codings part company across the high
		// band. This assertion is what stops a later reader reaching for that label as the oracle.
		expect(labelDisagrees.length).toBeGreaterThan(0)
		expect(labelDisagrees.every((value) => value >= 0x80 && value <= 0x9f)).toBe(true)
	})
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
