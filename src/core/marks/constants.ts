/**
 * Holds the byte order mark, U+FEFF, as a one-character string.
 *
 * @remarks
 * Every coding here carries the mark as data rather than as a signal: `encodeUTF8` writes it as
 * EF BB BF, `encodeUTF16LE` writes it as FF FE, and each decoder reads those bytes back as this
 * character, leading position included. A consumer that writes or strips a leading mark compares
 * against this value.
 *
 * @example
 * ```ts
 * encodeUTF8(BOM) // Uint8Array [239, 187, 191]
 * `${BOM}id,name`.startsWith(BOM) // true
 * ```
 */
export const BOM = '\ufeff'
