# Codec

> The fleet's byte-to-text codings, as sound `encode` / `decode` / guard triples over `string` and
> `Uint8Array` — RFC 4648 Base64, base64url, and hex, beside the UTF-8, ISO-8859-1, Windows-1252,
> and UTF-16LE charsets — and a `measure*` that answers a coding's byte-side size question without
> producing those bytes. Zero runtime dependencies, no error type, no options, no class. Source:
> [`src/core`](src/core). Published through `@orkestrel/codec`.

| Name               | Kind     | Signature                                                | Behavior                                                                                                                                                              |
| ------------------ | -------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encodeBase64`     | function | `(bytes: Uint8Array) => string`                          | `bytes` spelled in the RFC 4648 §4 alphabet (`+`, `/`) with `=` padding — the canonical form, and the only form `decodeBase64` accepts. Total: encoding cannot fail.  |
| `decodeBase64`     | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Exactly what `encodeBase64` writes, read back. Every other text — wrong alphabet, whitespace, wrong padding, a non-zero unused trailing bit — is `undefined`.         |
| `isBase64`         | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeBase64` answers bytes for. Total on any value: a number, `null`, or a byte sequence is false rather than a throw.                 |
| `encodeBase64URL`  | function | `(bytes: Uint8Array) => string`                          | `bytes` spelled in the RFC 4648 §5 url alphabet (`-`, `_`) with the padding removed — the canonical form, and the only form `decodeBase64URL` accepts. Total.         |
| `decodeBase64URL`  | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Exactly what `encodeBase64URL` writes, read back. A padded text, a `+`, or a `/` belongs to the §4 face and is `undefined` here.                                      |
| `isBase64URL`      | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeBase64URL` answers bytes for. Total on any value.                                                                                 |
| `encodeHex`        | function | `(bytes: Uint8Array) => string`                          | `bytes` spelled in the RFC 4648 §8 alphabet, lowercase, two digits per byte — the canonical form, and the only form `decodeHex` accepts. Total: encoding cannot fail. |
| `decodeHex`        | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Exactly what `encodeHex` writes, read back. An uppercase digit, an odd length, a `0x` prefix, whitespace, and any foreign character are `undefined`.                  |
| `isHex`            | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeHex` answers bytes for. Total on any value.                                                                                       |
| `measureBase64`    | function | `(text: string) => number \| undefined`                  | The byte length `decodeBase64` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeBase64` refuses.                     |
| `measureBase64URL` | function | `(text: string) => number \| undefined`                  | The byte length `decodeBase64URL` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeBase64URL` refuses.               |
| `measureHex`       | function | `(text: string) => number \| undefined`                  | The byte length `decodeHex` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeHex` refuses.                           |
| `measureUTF8`      | function | `(text: string) => number \| undefined`                  | The UTF-8 byte length `encodeUTF8` would write for `text`, without allocating those bytes; `undefined` for exactly the ill-formed strings `encodeUTF8` refuses.       |

A charset's wire form is bytes rather than text, so its `encode*` takes a string and its `decode*`
takes bytes. The two laws are unchanged; only the direction each is written in inverts.

| Name                | Kind     | Signature                                                | Behavior                                                                                                                                                                               |
| ------------------- | -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encodeUTF8`        | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | `text` spelled in the RFC 3629 shortest form; `undefined` for exactly the ill-formed strings.                                                                                          |
| `decodeUTF8`        | function | `(bytes: Uint8Array) => string \| undefined`             | Exactly what `encodeUTF8` writes, read back. An overlong, an encoded surrogate, a code point past U+10FFFF, and a truncated sequence are `undefined`. A leading BOM is kept as U+FEFF. |
| `isUTF8`            | function | `(value: unknown) => value is Uint8Array`                | True for exactly the byte sequences `decodeUTF8` answers text for. Total on any value.                                                                                                 |
| `encodeLatin1`      | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Each code unit written as the byte of the same value; `undefined` when a code unit exceeds 0xFF.                                                                                       |
| `decodeLatin1`      | function | `(bytes: Uint8Array) => string`                          | Each byte read as the code point of the same value. Total: this decoder has no failure mode.                                                                                           |
| `isLatin1`          | function | `(value: unknown) => value is string`                    | True for exactly the strings `encodeLatin1` answers bytes for — the encode side, because the decoder refuses nothing. Total on any value.                                              |
| `encodeWindows1252` | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | The inverse of the decode mapping; `undefined` for a character outside the code page's image, every C1 control included.                                                               |
| `decodeWindows1252` | function | `(bytes: Uint8Array) => string \| undefined`             | Identity for 0x00-0x7F and 0xA0-0xFF, the written-out high table between them; bytes 0x81, 0x8D, 0x8F, 0x90, and 0x9D are `undefined`.                                                 |
| `isWindows1252`     | function | `(value: unknown) => value is Uint8Array`                | True for exactly the byte sequences `decodeWindows1252` answers text for. Total on any value.                                                                                          |
| `encodeUTF16LE`     | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Each code unit written low byte first; `undefined` for exactly the ill-formed strings.                                                                                                 |
| `decodeUTF16LE`     | function | `(bytes: Uint8Array) => string \| undefined`             | Two bytes read per code unit, low byte first. An odd length and an unpaired surrogate are `undefined`. A leading FF FE is kept as U+FEFF.                                              |
| `isUTF16LE`         | function | `(value: unknown) => value is Uint8Array`                | True for exactly the byte sequences `decodeUTF16LE` answers text for. Total on any value.                                                                                              |

**The round-trip law.** `decode*(encode*(value))` deep-equals `value`, for every input the coding
admits, the empty one included.

**The canonical-form law.** `encode*(decode*(wire))` returns `wire`, for every wire form the face's
guard admits.

**The sound-triple law.** A measure equals the length of the bytes the function producing them
would return, for every string — the admitted texts pinning a length, the refused ones pinning
`undefined` on both sides. The producer is the decoder where the wire form is text, so
`measureBase64(text) === decodeBase64(text)?.length`, and the encoder where the wire form is bytes,
so `measureUTF8(text) === encodeUTF8(text)?.length`.

`computeBytes` in `@orkestrel/scaffold` counts UTF-8 bytes too, and it answers a different question
for a lone surrogate: the three bytes `TextEncoder` writes for the replacement character, where
`measureUTF8` answers `undefined`. That divergence is deliberate — it is the strict door this
package keeps on every face — and a consumer wanting the replacement count calls the counter that
produces it.

RFC 4648 §8 prints its table uppercase; this package's canonical spelling is lowercase, matching
every producer the fleet already reads. One canonical spelling per input is the charter's law, so
`decodeHex('AB')` is `undefined` and `encodeHex(new Uint8Array([0xab]))` is `'ab'`.

The charsets part from the platform's own codings in three places, each named in the guide: the
WHATWG `latin1` label is windows-1252 rather than ISO-8859-1, the WHATWG windows-1252 index defines
the slots this code page leaves undefined, and a fatal `TextDecoder` strips a leading BOM that
this package's round-trip law keeps.

```ts
import { decodeBase64, encodeBase64, isBase64 } from '@orkestrel/codec'

decodeBase64('aa==') // undefined — the unused trailing bits are not zero
decodeBase64('aQ==') // Uint8Array [105] — the canonical spelling of that byte
encodeBase64(new Uint8Array([105])) // 'aQ=='
decodeBase64('AQ D') // undefined — whitespace
decodeBase64('A') // undefined — a length off the group boundary
decodeBase64('AQID=') // undefined — padding off the group boundary
decodeBase64('-_-_') // undefined — the url alphabet
isBase64('aa==') // false
```

See [`guides/codec.md`](guides/codec.md) in this repository for the membership bar and the full
doctrine.
