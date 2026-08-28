import { BASE64_ALPHABET, BASE64_LOOKUP, HEX_ALPHABET, HEX_LOOKUP } from './constants.js'

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
