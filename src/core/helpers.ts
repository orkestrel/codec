import { BASE64_ALPHABET, BASE64_LOOKUP } from './constants.js'

// === The RFC 4648 codings
//
// One grammar per coding, and one canonical spelling per input. `decodeBase64` walks the §4 form
// one four-character group at a time and refuses everything the group boundary does not admit: a
// character outside BASE64_LOOKUP, a length off the boundary, padding anywhere but the end, and a
// non-zero unused trailing bit. The §5 face is that same grammar under a two-character
// substitution with the padding removed, so `encodeBase64URL` substitutes into the §4 output and
// `decodeBase64URL` substitutes back and refuses the §4 characters before delegating. Each guard
// answers exactly what its own decoder accepts, by asking it, so the two cannot drift.

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
export function decodeBase64(text: string): Uint8Array | undefined {
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
 * Checks whether a value is canonical standard Base64 text.
 *
 * @remarks
 * True for exactly the strings {@link decodeBase64} answers bytes for, because it asks that
 * decoder. Total on any value: a number, `null`, or a byte sequence is false rather than a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is canonical §4 Base64 text; false otherwise.
 *
 * @example
 * ```ts
 * isBase64('aGk=') // true
 * isBase64('aGk') // false
 * ```
 */
export function isBase64(value: unknown): value is string {
	return typeof value === 'string' && decodeBase64(value) !== undefined
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
export function decodeBase64URL(text: string): Uint8Array | undefined {
	if (text.includes('+') || text.includes('/') || text.includes('=')) return undefined
	const standard = text.replaceAll('-', '+').replaceAll('_', '/')
	const remainder = standard.length % 4
	return decodeBase64(remainder === 0 ? standard : standard + '='.repeat(4 - remainder))
}

/**
 * Checks whether a value is canonical base64url text.
 *
 * @remarks
 * True for exactly the strings {@link decodeBase64URL} answers bytes for, because it asks that
 * decoder. Total on any value: a number, `null`, or a byte sequence is false rather than a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is canonical §5 base64url text; false otherwise.
 *
 * @example
 * ```ts
 * isBase64URL('aGk') // true
 * isBase64URL('aGk=') // false
 * ```
 */
export function isBase64URL(value: unknown): value is string {
	return typeof value === 'string' && decodeBase64URL(value) !== undefined
}
