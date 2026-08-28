import { decodeBase64, decodeBase64URL, decodeHex } from './helpers.js'

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

/**
 * Checks whether a value is canonical lowercase hex text.
 *
 * @remarks
 * True for exactly the strings {@link decodeHex} answers bytes for, because it asks that decoder.
 * An uppercase digit, an odd length, and a `0x` prefix are false. Total on any value: a number,
 * `null`, or a byte sequence is false rather than a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is canonical §8 lowercase hex text; false otherwise.
 *
 * @example
 * ```ts
 * isHex('ab') // true
 * isHex('AB') // false
 * ```
 */
export function isHex(value: unknown): value is string {
	return typeof value === 'string' && decodeHex(value) !== undefined
}
