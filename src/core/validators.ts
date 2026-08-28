import {
	decodeBase64,
	decodeBase64URL,
	decodeHex,
	decodeUTF8,
	decodeUTF16LE,
	decodeWindows1252,
	encodeLatin1,
} from './helpers.js'

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

// === The charset guards
//
// A charset guard attaches to its coding's partial direction, because a guard names the set some
// function refuses and a total function refuses nothing. For UTF-8, Windows-1252, and UTF-16LE that
// is the bytes side, so those guards narrow to `Uint8Array` by asking their decoder. Latin-1 is the
// exception: its decoder is total, so `isLatin1` names the encode side and narrows to `string`.
// UTF-8's text side ships no guard at all, because `String.prototype.isWellFormed` already names
// exactly the strings `encodeUTF8` accepts and wrapping it would add nothing.
//
// `ArrayBuffer.isView` carries the totality that `typeof value === 'string'` carries on the text
// side, and it is not redundant beside `instanceof`: a revoked proxy and a hostile prototype both
// make a bare `instanceof Uint8Array` throw, while `ArrayBuffer.isView` reads an internal slot and
// answers false. Reading it first also refuses a proxy wrapping a real byte array, whose `length`
// trap could otherwise walk a decoder past the bytes it actually holds.

/**
 * Checks whether a value is bytes that decode as strict UTF-8.
 *
 * @remarks
 * True for exactly the byte sequences {@link decodeUTF8} answers text for, because it asks that
 * decoder. An overlong spelling, an encoded surrogate, and a truncated sequence are false. Total on
 * any value: a string, `null`, a sibling view kind, or a proxy is false rather than a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is a byte sequence in strict UTF-8; false otherwise.
 *
 * @example
 * ```ts
 * isUTF8(new Uint8Array([104, 105])) // true
 * isUTF8(new Uint8Array([0xc0, 0x80])) // false
 * ```
 */
export function isUTF8(value: unknown): value is Uint8Array {
	return ArrayBuffer.isView(value) && value instanceof Uint8Array && decodeUTF8(value) !== undefined
}

/**
 * Checks whether a value is text ISO/IEC 8859-1 can encode.
 *
 * @remarks
 * True for exactly the strings {@link encodeLatin1} answers bytes for, because it asks that
 * encoder. This coding's guard names the encode side because its decoder is total and so refuses
 * nothing there. Total on any value: a number, `null`, or a byte sequence is false rather than a
 * throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is text every code unit of which fits one Latin-1 byte; false otherwise.
 *
 * @example
 * ```ts
 * isLatin1('hi') // true
 * isLatin1('Ā') // false
 * ```
 */
export function isLatin1(value: unknown): value is string {
	return typeof value === 'string' && encodeLatin1(value) !== undefined
}

/**
 * Checks whether a value is bytes that decode as Windows-1252.
 *
 * @remarks
 * True for exactly the byte sequences {@link decodeWindows1252} answers text for, because it asks
 * that decoder. Bytes 0x81, 0x8D, 0x8F, 0x90, and 0x9D are undefined slots of the code page and are
 * false. Total on any value: a string, `null`, a sibling view kind, or a proxy is false rather than
 * a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is a byte sequence of defined Windows-1252 slots; false otherwise.
 *
 * @example
 * ```ts
 * isWindows1252(new Uint8Array([128])) // true
 * isWindows1252(new Uint8Array([0x81])) // false
 * ```
 */
export function isWindows1252(value: unknown): value is Uint8Array {
	return (
		ArrayBuffer.isView(value) &&
		value instanceof Uint8Array &&
		decodeWindows1252(value) !== undefined
	)
}

/**
 * Checks whether a value is bytes that decode as UTF-16LE.
 *
 * @remarks
 * True for exactly the byte sequences {@link decodeUTF16LE} answers text for, because it asks that
 * decoder. An odd length and an unpaired surrogate are false. Total on any value: a string, `null`,
 * a sibling view kind, or a proxy is false rather than a throw.
 *
 * @param value - The value to test.
 * @returns True if `value` is a byte sequence in well-formed UTF-16LE; false otherwise.
 *
 * @example
 * ```ts
 * isUTF16LE(new Uint8Array([104, 0])) // true
 * isUTF16LE(new Uint8Array([104])) // false
 * ```
 */
export function isUTF16LE(value: unknown): value is Uint8Array {
	return (
		ArrayBuffer.isView(value) && value instanceof Uint8Array && decodeUTF16LE(value) !== undefined
	)
}
