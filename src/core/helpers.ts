import {
	BASE64_ALPHABET,
	BASE64_LOOKUP,
	HEX_ALPHABET,
	HEX_LOOKUP,
	WINDOWS_1252_HIGH,
} from './constants.js'

// === The RFC 4648 codings
//
// One grammar per coding, and one canonical spelling per input. `decodeBase64` walks the §4 form
// one four-character group at a time and refuses everything the group boundary does not admit: a
// character outside BASE64_LOOKUP, a length off the boundary, padding anywhere but the end, and a
// non-zero unused trailing bit. The §5 face is that same grammar under a two-character
// substitution with the padding removed, so `encodeBase64URL` substitutes into the §4 output and
// `decodeBase64URL` substitutes back and refuses the §4 characters before delegating. The §8 face
// is a two-digit table walk with no padding and no unused bit to check, so its only refusals are
// an odd length and a character outside HEX_LOOKUP — uppercase included, because HEX_LOOKUP holds
// the lowercase spelling alone. Each guard answers exactly what its own decoder accepts, by asking
// it, so the two cannot drift.

/**
 * Encodes a byte sequence as standard padded Base64.
 *
 * @remarks
 * Emits the RFC 4648 §4 alphabet (`+`, `/`) with `=` padding — the canonical spelling of these
 * bytes and the only form {@link decodeBase64} accepts. Total: encoding cannot fail.
 *
 * @param bytes - The bytes to encode.
 * @returns The canonical padded Base64 text.
 *
 * @example
 * ```ts
 * encodeBase64(new Uint8Array([104, 105])) // 'aGk='
 * ```
 */
export function encodeBase64(bytes: Uint8Array): string {
	let text = ''
	for (let index = 0; index < bytes.length; index += 3) {
		const second = bytes[index + 1]
		const third = bytes[index + 2]
		const value = ((bytes[index] ?? 0) << 16) | ((second ?? 0) << 8) | (third ?? 0)
		text += BASE64_ALPHABET.charAt((value >> 18) & 0x3f)
		text += BASE64_ALPHABET.charAt((value >> 12) & 0x3f)
		text += second === undefined ? '=' : BASE64_ALPHABET.charAt((value >> 6) & 0x3f)
		text += third === undefined ? '=' : BASE64_ALPHABET.charAt(value & 0x3f)
	}
	return text
}

/**
 * Decodes canonical standard Base64 text into its bytes.
 *
 * @remarks
 * Accepts only the RFC 4648 §4 form {@link encodeBase64} produces: the standard alphabet, a length
 * on the four-character group boundary, `=` padding only at the end, and zero in every unused
 * trailing bit. `'aa=='` therefore fails where `'aQ=='` — the canonical spelling of the same
 * leading byte — succeeds. `undefined` is the only failure mode; nothing here throws.
 *
 * @param text - The text to decode.
 * @returns The decoded bytes, or `undefined` when `text` is not canonical §4 Base64.
 *
 * @example
 * ```ts
 * decodeBase64('aGk=') // Uint8Array [104, 105]
 * decodeBase64('aa==') // undefined
 * ```
 */
export function decodeBase64(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (text.length % 4 !== 0) return undefined
	const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0
	const bytes = new Uint8Array((text.length / 4) * 3 - padding)
	let cursor = 0
	for (let index = 0; index < text.length; index += 4) {
		const tail = text.length - index === 4 ? padding : 0
		const first = BASE64_LOOKUP[text.charAt(index)]
		const second = BASE64_LOOKUP[text.charAt(index + 1)]
		const third = tail === 2 ? 0 : BASE64_LOOKUP[text.charAt(index + 2)]
		const fourth = tail === 0 ? BASE64_LOOKUP[text.charAt(index + 3)] : 0
		if (first === undefined || second === undefined) return undefined
		if (third === undefined || fourth === undefined) return undefined
		if (tail === 2 && (second & 0x0f) !== 0) return undefined
		if (tail === 1 && (third & 0x03) !== 0) return undefined
		const value = (first << 18) | (second << 12) | (third << 6) | fourth
		bytes[cursor] = (value >> 16) & 0xff
		if (tail < 2) bytes[cursor + 1] = (value >> 8) & 0xff
		if (tail === 0) bytes[cursor + 2] = value & 0xff
		cursor += 3 - tail
	}
	return bytes
}

/**
 * Encodes a byte sequence as unpadded base64url.
 *
 * @remarks
 * Emits the RFC 4648 §5 url alphabet (`-`, `_`) with the padding removed — the {@link encodeBase64}
 * output under that substitution, and the only form {@link decodeBase64URL} accepts. Total:
 * encoding cannot fail.
 *
 * @param bytes - The bytes to encode.
 * @returns The canonical unpadded base64url text.
 *
 * @example
 * ```ts
 * encodeBase64URL(new Uint8Array([104, 105])) // 'aGk'
 * ```
 */
export function encodeBase64URL(bytes: Uint8Array): string {
	return encodeBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/**
 * Decodes canonical base64url text into its bytes.
 *
 * @remarks
 * Accepts only the RFC 4648 §5 form {@link encodeBase64URL} produces: the url alphabet, no padding,
 * and zero in every unused trailing bit. A `+`, a `/`, or an `=` belongs to the §4 face and is
 * refused here, so `'-_-_'` decodes where `'+/+/'` and `'aGk='` do not. `undefined` is the only
 * failure mode; nothing here throws.
 *
 * @param text - The text to decode.
 * @returns The decoded bytes, or `undefined` when `text` is not canonical §5 base64url.
 *
 * @example
 * ```ts
 * decodeBase64URL('aGk') // Uint8Array [104, 105]
 * decodeBase64URL('aGk=') // undefined
 * ```
 */
export function decodeBase64URL(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (text.includes('+') || text.includes('/') || text.includes('=')) return undefined
	const standard = text.replaceAll('-', '+').replaceAll('_', '/')
	const remainder = standard.length % 4
	return decodeBase64(remainder === 0 ? standard : standard + '='.repeat(4 - remainder))
}

/**
 * Encodes a byte sequence as lowercase hex.
 *
 * @remarks
 * Emits the RFC 4648 §8 base16 coding, two digits per byte — the canonical spelling of these bytes
 * and the only form {@link decodeHex} accepts. The specification's §8 table spells the alphabet
 * uppercase; this package spells it lowercase, a deliberate departure matching every producer the
 * fleet already reads, and one canonical spelling per input is what forces a single choice. Total:
 * encoding cannot fail.
 *
 * @param bytes - The bytes to encode.
 * @returns The canonical lowercase hex text.
 *
 * @example
 * ```ts
 * encodeHex(new Uint8Array([0xab])) // 'ab'
 * ```
 */
export function encodeHex(bytes: Uint8Array): string {
	let text = ''
	for (const byte of bytes) {
		text += HEX_ALPHABET.charAt((byte >> 4) & 0x0f)
		text += HEX_ALPHABET.charAt(byte & 0x0f)
	}
	return text
}

/**
 * Decodes canonical lowercase hex text into its bytes.
 *
 * @remarks
 * Accepts only the RFC 4648 §8 form {@link encodeHex} produces: lowercase digits, two per byte, and
 * nothing else. `'AB'` re-encodes as `'ab'`, so admitting it would break the canonical-form law;
 * an odd length, a `0x` prefix, whitespace, and any character outside the alphabet are refused for
 * the same reason. `undefined` is the only failure mode; nothing here throws.
 *
 * @param text - The text to decode.
 * @returns The decoded bytes, or `undefined` when `text` is not canonical lowercase hex.
 *
 * @example
 * ```ts
 * decodeHex('ab') // Uint8Array [171]
 * decodeHex('AB') // undefined
 * ```
 */
export function decodeHex(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (text.length % 2 !== 0) return undefined
	const bytes = new Uint8Array(text.length / 2)
	for (let index = 0; index < text.length; index += 2) {
		const high = HEX_LOOKUP[text.charAt(index)]
		const low = HEX_LOOKUP[text.charAt(index + 1)]
		if (high === undefined || low === undefined) return undefined
		bytes[index / 2] = (high << 4) | low
	}
	return bytes
}

// === The measures
//
// A measure answers the decoded length of a text its coding admits, and `undefined` for a text the
// coding refuses. It walks the same grammar its decoder does and allocates no output buffer, which
// is the whole reason it exists: a measure that decodes has measured nothing. `measureBase64` and
// `measureHex` therefore repeat the §4 and §8 walks rather than calling their decoders, and
// `measureBase64URL` carries the §5 substitution over `measureBase64` exactly as
// `decodeBase64URL` carries it over `decodeBase64`, so no measure reaches a decoder. The law
// sweeps in tests/src/core/helpers.test.ts hold each measure against its decoder, two independent
// walks per face.

/**
 * Measures the byte length canonical standard Base64 text decodes to.
 *
 * @remarks
 * Keeps the sound triple `measureBase64(text) === decodeBase64(text)?.length` for every string,
 * walking the full RFC 4648 §4 grammar — the length residue, the padding placement, the alphabet
 * membership, and the unused trailing bits — without allocating the decoded bytes. That is its
 * reason to exist, so it repeats the walk rather than asking {@link decodeBase64}. `undefined` is
 * the only failure mode; nothing here throws.
 *
 * @param text - The text to measure.
 * @returns The decoded byte length, or `undefined` when `text` is not canonical §4 Base64.
 *
 * @example
 * ```ts
 * measureBase64('aGk=') // 2
 * measureBase64('aa==') // undefined
 * ```
 */
export function measureBase64(text: string): number | undefined {
	if (text.length % 4 !== 0) return undefined
	const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0
	for (let index = 0; index < text.length; index += 4) {
		const tail = text.length - index === 4 ? padding : 0
		const first = BASE64_LOOKUP[text.charAt(index)]
		const second = BASE64_LOOKUP[text.charAt(index + 1)]
		const third = tail === 2 ? 0 : BASE64_LOOKUP[text.charAt(index + 2)]
		const fourth = tail === 0 ? BASE64_LOOKUP[text.charAt(index + 3)] : 0
		if (first === undefined || second === undefined) return undefined
		if (third === undefined || fourth === undefined) return undefined
		if (tail === 2 && (second & 0x0f) !== 0) return undefined
		if (tail === 1 && (third & 0x03) !== 0) return undefined
	}
	return (text.length / 4) * 3 - padding
}

/**
 * Measures the byte length canonical base64url text decodes to.
 *
 * @remarks
 * Keeps the sound triple `measureBase64URL(text) === decodeBase64URL(text)?.length` for every
 * string, walking the full RFC 4648 §5 grammar — the `+`, `/`, and `=` the url face refuses
 * outright, the length residue padding completes, the alphabet membership, and the unused trailing
 * bits — without allocating the decoded bytes. That is its reason to exist, so it reads the §5
 * face the way {@link decodeBase64URL} reads it and lands on {@link measureBase64} rather than on
 * a decoder. `undefined` is the only failure mode; nothing here throws.
 *
 * @param text - The text to measure.
 * @returns The decoded byte length, or `undefined` when `text` is not canonical §5 base64url.
 *
 * @example
 * ```ts
 * measureBase64URL('aGk') // 2
 * measureBase64URL('aa') // undefined
 * ```
 */
export function measureBase64URL(text: string): number | undefined {
	if (text.includes('+') || text.includes('/') || text.includes('=')) return undefined
	const standard = text.replaceAll('-', '+').replaceAll('_', '/')
	const remainder = standard.length % 4
	return measureBase64(remainder === 0 ? standard : standard + '='.repeat(4 - remainder))
}

/**
 * Measures the byte length canonical lowercase hex text decodes to.
 *
 * @remarks
 * Keeps the sound triple `measureHex(text) === decodeHex(text)?.length` for every string, walking
 * the full RFC 4648 §8 grammar — the even length and the lowercase alphabet membership, which
 * holds no uppercase digit — and answering half the length only after that walk admits the text,
 * without allocating the decoded bytes. That is its reason to exist, so it repeats the walk rather
 * than asking {@link decodeHex}. `undefined` is the only failure mode; nothing here throws.
 *
 * @param text - The text to measure.
 * @returns The decoded byte length, or `undefined` when `text` is not canonical lowercase hex.
 *
 * @example
 * ```ts
 * measureHex('abcd') // 2
 * measureHex('AB') // undefined
 * ```
 */
export function measureHex(text: string): number | undefined {
	if (text.length % 2 !== 0) return undefined
	for (let index = 0; index < text.length; index += 2) {
		const high = HEX_LOOKUP[text.charAt(index)]
		const low = HEX_LOOKUP[text.charAt(index + 1)]
		if (high === undefined || low === undefined) return undefined
	}
	return text.length / 2
}

// === The UTF-8 coding
//
// The charset codings run the other way round from the RFC 4648 faces. A charset's wire form is
// bytes and its native form is text, so `encodeUTF8` takes text and answers bytes and `decodeUTF8`
// takes bytes and answers text. The two laws are unchanged under that inversion: encoding a text
// and decoding the result returns the text, and decoding admitted bytes and re-encoding them
// returns those bytes.
//
// `encodeUTF8` refuses exactly the ill-formed strings, which `String.prototype.isWellFormed`
// already names, and emits the RFC 3629 shortest form for everything else. `decodeUTF8` walks the
// same grammar in reverse and refuses every non-shortest or out-of-range spelling: a lead byte the
// grammar has no width for (0xC0, 0xC1, and 0xF5 through 0xFF), a continuation byte that is not
// 0b10xxxxxx, a sequence the buffer truncates, an overlong three- or four-byte form, an encoded
// surrogate, and a code point past U+10FFFF. A leading BOM is data here rather than a signal:
// U+FEFF encodes to EF BB BF and those bytes decode back to U+FEFF, because the round-trip law
// admits no byte the decoder is allowed to discard.

/**
 * Encodes text as UTF-8 bytes.
 *
 * @remarks
 * Emits the RFC 3629 shortest form for every code point — the canonical spelling of this text and
 * the only form {@link decodeUTF8} accepts. Ill-formed text is the one failure: a lone surrogate
 * has no UTF-8 spelling, so `encodeUTF8` answers `undefined` for exactly the strings
 * `String.prototype.isWellFormed` reports false for. U+FEFF encodes to its own bytes wherever it
 * sits, leading position included; this coding reads no byte order mark.
 *
 * @param text - The text to encode.
 * @returns The UTF-8 bytes, or `undefined` when `text` is ill-formed.
 *
 * @example
 * ```ts
 * encodeUTF8('hi') // Uint8Array [104, 105]
 * encodeUTF8('\ud800') // undefined
 * ```
 */
export function encodeUTF8(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (!text.isWellFormed()) return undefined
	const bytes: number[] = []
	for (let index = 0; index < text.length; index += 1) {
		let point = text.charCodeAt(index)
		if (point >= 0xd800 && point <= 0xdbff) {
			point = (point - 0xd800) * 0x400 + (text.charCodeAt(index + 1) - 0xdc00) + 0x10000
			index += 1
		}
		if (point < 0x80) {
			bytes.push(point)
		} else if (point < 0x800) {
			bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f))
		} else if (point < 0x10000) {
			bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f))
		} else {
			bytes.push(
				0xf0 | (point >> 18),
				0x80 | ((point >> 12) & 0x3f),
				0x80 | ((point >> 6) & 0x3f),
				0x80 | (point & 0x3f),
			)
		}
	}
	return Uint8Array.from(bytes)
}

/**
 * Decodes UTF-8 bytes into their text.
 *
 * @remarks
 * Accepts only the RFC 3629 shortest form {@link encodeUTF8} produces. An overlong spelling, an
 * encoded surrogate, a code point past U+10FFFF, a truncated sequence, a stray continuation byte,
 * and a lead byte outside the grammar are all `undefined`. A leading BOM is preserved as U+FEFF
 * rather than stripped, because the round-trip law leaves the decoder no byte it may discard —
 * that is this coding's one documented departure from the platform's own default decoder.
 * `undefined` is the only failure mode; nothing here throws.
 *
 * @param bytes - The bytes to decode.
 * @returns The decoded text, or `undefined` when `bytes` are not strict UTF-8.
 *
 * @example
 * ```ts
 * decodeUTF8(new Uint8Array([104, 105])) // 'hi'
 * decodeUTF8(new Uint8Array([0xc0, 0x80])) // undefined
 * ```
 */
export function decodeUTF8(bytes: Uint8Array): string | undefined {
	let text = ''
	let index = 0
	while (index < bytes.length) {
		const lead = bytes[index] ?? 0
		const width =
			lead < 0x80
				? 1
				: lead >= 0xc2 && lead <= 0xdf
					? 2
					: lead >= 0xe0 && lead <= 0xef
						? 3
						: lead >= 0xf0 && lead <= 0xf4
							? 4
							: 0
		if (width === 0 || index + width > bytes.length) return undefined
		let point = width === 1 ? lead : lead & (0xff >> (width + 1))
		for (let offset = 1; offset < width; offset += 1) {
			const continuation = bytes[index + offset] ?? 0
			if ((continuation & 0xc0) !== 0x80) return undefined
			point = (point << 6) | (continuation & 0x3f)
		}
		if (width === 3 && point < 0x800) return undefined
		if (width === 4 && point < 0x10000) return undefined
		if (point >= 0xd800 && point <= 0xdfff) return undefined
		if (point > 0x10ffff) return undefined
		text += String.fromCodePoint(point)
		index += width
	}
	return text
}

// === The ISO-8859-1 coding
//
// Latin-1 is the identity on a byte: byte `b` is code point U+00`b`, and nothing else. That makes
// the decode direction total — every one of the 256 byte values names a character — so this is the
// one coding here whose decoder cannot fail, and the only failure left is a text carrying a code
// unit past 0xFF. The band 0x80-0x9F is the C1 control block under this coding, which is exactly
// where Windows-1252 puts its printable characters instead; the WHATWG `latin1` label names the
// windows-1252 coding rather than this one.

/**
 * Encodes text as ISO/IEC 8859-1 bytes.
 *
 * @remarks
 * Writes each code unit as the byte of the same value, which is the whole of ISO/IEC 8859-1. A
 * code unit past 0xFF has no byte in this coding, so `encodeLatin1` answers `undefined` for any
 * text carrying one — a lone surrogate included, because every surrogate sits past 0xFF.
 *
 * @param text - The text to encode.
 * @returns The Latin-1 bytes, or `undefined` when a code unit exceeds 0xFF.
 *
 * @example
 * ```ts
 * encodeLatin1('hi') // Uint8Array [104, 105]
 * encodeLatin1('Ā') // undefined
 * ```
 */
export function encodeLatin1(text: string): Uint8Array<ArrayBuffer> | undefined {
	const bytes = new Uint8Array(text.length)
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index)
		if (unit > 0xff) return undefined
		bytes[index] = unit
	}
	return bytes
}

/**
 * Decodes ISO/IEC 8859-1 bytes into their text.
 *
 * @remarks
 * Reads each byte as the code point of the same value. Every byte names a character, so this
 * decoder is total: it has no failure mode and no `undefined` return, and `isLatin1` therefore
 * guards the encode direction instead. Do not reach for the WHATWG `latin1` label to check this
 * coding — that label names windows-1252, which disagrees across 0x80-0x9F.
 *
 * @param bytes - The bytes to decode.
 * @returns The decoded text.
 *
 * @example
 * ```ts
 * decodeLatin1(new Uint8Array([104, 105])) // 'hi'
 * decodeLatin1(new Uint8Array([0xe9])) // 'é' — total: every byte names a character
 * ```
 */
export function decodeLatin1(bytes: Uint8Array): string {
	let text = ''
	for (const byte of bytes) text += String.fromCharCode(byte)
	return text
}

// === The Windows-1252 coding
//
// The code page is the Latin-1 identity outside 0x80-0x9F and WINDOWS_1252_HIGH inside it, and the
// table's omissions are the refusal: 0x81, 0x8D, 0x8F, 0x90, and 0x9D name no character, so
// `decodeWindows1252` answers `undefined` for them. The defined mapping is a bijection, so
// `encodeWindows1252` is its inverse and refuses exactly the characters outside its image — every
// C1 control among them, because no defined slot maps into U+0080-U+009F.

/**
 * Encodes text as Windows-1252 bytes.
 *
 * @remarks
 * Inverts the mapping {@link decodeWindows1252} reads: the identity under U+0080 and across
 * U+00A0-U+00FF, and the reverse of the high table between them. A character outside that image
 * has no byte in this code page, so `encodeWindows1252` answers `undefined` for it — every C1
 * control included, because the code page's defined slots reach none of U+0080-U+009F.
 *
 * @param text - The text to encode.
 * @returns The Windows-1252 bytes, or `undefined` when a character is outside the code page.
 *
 * @example
 * ```ts
 * encodeWindows1252('€') // Uint8Array [128]
 * encodeWindows1252('\u0081') // undefined — an undefined code-page slot
 * ```
 */
export function encodeWindows1252(text: string): Uint8Array<ArrayBuffer> | undefined {
	const entries = Object.entries(WINDOWS_1252_HIGH)
	const bytes = new Uint8Array(text.length)
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index)
		if (unit < 0x80 || (unit >= 0xa0 && unit <= 0xff)) {
			bytes[index] = unit
			continue
		}
		const entry = entries.find(([, point]) => point === unit)
		if (entry === undefined) return undefined
		bytes[index] = Number(entry[0])
	}
	return bytes
}

/**
 * Decodes Windows-1252 bytes into their text.
 *
 * @remarks
 * Reads 0x00-0x7F and 0xA0-0xFF as the identity and 0x80-0x9F through the written-out high table.
 * Bytes 0x81, 0x8D, 0x8F, 0x90, and 0x9D are undefined in the code page and are refused here. The
 * WHATWG Encoding index maps each of those to its own C1 control, so a platform decoder carrying
 * that index disagrees with this one on exactly those bytes. `undefined` is the only failure mode;
 * nothing here throws.
 *
 * @param bytes - The bytes to decode.
 * @returns The decoded text, or `undefined` when a byte is an undefined code-page slot.
 *
 * @example
 * ```ts
 * decodeWindows1252(new Uint8Array([128])) // '€'
 * decodeWindows1252(new Uint8Array([0x81])) // undefined
 * ```
 */
export function decodeWindows1252(bytes: Uint8Array): string | undefined {
	let text = ''
	for (const byte of bytes) {
		if (byte < 0x80 || byte >= 0xa0) {
			text += String.fromCharCode(byte)
			continue
		}
		const point = WINDOWS_1252_HIGH[byte]
		if (point === undefined) return undefined
		text += String.fromCharCode(point)
	}
	return text
}

// === The UTF-16LE coding
//
// Two bytes per code unit, low byte first. The text side is what JavaScript strings already are, so
// `encodeUTF16LE` writes the code units straight out and refuses only what has no UTF-16 spelling
// at all — an unpaired surrogate, which `String.prototype.isWellFormed` names. The byte side
// carries the two refusals the wire form adds: an odd length, which cannot be read as code units,
// and a surrogate the byte stream leaves unpaired. A leading FF FE is data here rather than a byte
// order mark: it decodes to U+FEFF and encodes back to those bytes, the same stance the UTF-8 face
// takes for EF BB BF.

/**
 * Encodes text as little-endian UTF-16 bytes.
 *
 * @remarks
 * Writes each code unit as its low byte then its high byte, which is the whole coding. Ill-formed
 * text is the one failure: an unpaired surrogate is not a UTF-16 sequence, so `encodeUTF16LE`
 * answers `undefined` for exactly the strings `String.prototype.isWellFormed` reports false for. A
 * leading U+FEFF encodes to FF FE and is read back as U+FEFF; this coding writes no byte order
 * mark of its own.
 *
 * @param text - The text to encode.
 * @returns The UTF-16LE bytes, or `undefined` when `text` is ill-formed.
 *
 * @example
 * ```ts
 * encodeUTF16LE('hi') // Uint8Array [104, 0, 105, 0]
 * encodeUTF16LE('\ud800') // undefined
 * ```
 */
export function encodeUTF16LE(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (!text.isWellFormed()) return undefined
	const bytes = new Uint8Array(text.length * 2)
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index)
		bytes[index * 2] = unit & 0xff
		bytes[index * 2 + 1] = (unit >> 8) & 0xff
	}
	return bytes
}

/**
 * Decodes little-endian UTF-16 bytes into their text.
 *
 * @remarks
 * Reads two bytes per code unit, low byte first. An odd length is refused because the trailing byte
 * completes no code unit, and an unpaired surrogate is refused because it spells no character — a
 * lead with nothing after it, a lead followed by a non-trail, and a trail with no lead alike. A
 * leading FF FE is preserved as U+FEFF rather than stripped, which is this coding's documented
 * departure from the platform's own default decoder. `undefined` is the only failure mode; nothing
 * here throws.
 *
 * @param bytes - The bytes to decode.
 * @returns The decoded text, or `undefined` when `bytes` are not well-formed UTF-16LE.
 *
 * @example
 * ```ts
 * decodeUTF16LE(new Uint8Array([104, 0, 105, 0])) // 'hi'
 * decodeUTF16LE(new Uint8Array([0x00, 0xd8])) // undefined
 * ```
 */
export function decodeUTF16LE(bytes: Uint8Array): string | undefined {
	if (bytes.length % 2 !== 0) return undefined
	let text = ''
	let index = 0
	while (index < bytes.length) {
		const unit = ((bytes[index + 1] ?? 0) << 8) | (bytes[index] ?? 0)
		if (unit >= 0xdc00 && unit <= 0xdfff) return undefined
		if (unit >= 0xd800 && unit <= 0xdbff) {
			if (index + 4 > bytes.length) return undefined
			const trail = ((bytes[index + 3] ?? 0) << 8) | (bytes[index + 2] ?? 0)
			if (trail < 0xdc00 || trail > 0xdfff) return undefined
			text += String.fromCharCode(unit, trail)
			index += 4
			continue
		}
		text += String.fromCharCode(unit)
		index += 2
	}
	return text
}
