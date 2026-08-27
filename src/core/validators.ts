import { decodeBase64, decodeBase64URL } from './helpers.js'

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
