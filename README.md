# Codec

> The fleet's byte-to-text codings, as sound `encode` / `decode` / guard triples over `string` and
> `Uint8Array` — RFC 4648 Base64, base64url, and hex — beside a `measure*` that reads a decoded
> length off the text without decoding it. Zero runtime dependencies, no error type, no options, no
> class. Source: [`src/core`](src/core). Published through `@orkestrel/codec`.

| Name               | Kind     | Signature                                                | Behavior                                                                                                                                                             |
| ------------------ | -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encodeBase64`     | function | `(bytes: Uint8Array) => string`                          | Spells `bytes` in the RFC 4648 §4 alphabet (`+`, `/`) with `=` padding — the canonical form, and the only form `decodeBase64` accepts. Total: encoding cannot fail.  |
| `decodeBase64`     | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Reads back exactly what `encodeBase64` writes. Every other text — wrong alphabet, whitespace, wrong padding, a non-zero unused trailing bit — is `undefined`.        |
| `isBase64`         | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeBase64` answers bytes for. Total on any value: a number, `null`, or a byte sequence is false rather than a throw.                |
| `encodeBase64URL`  | function | `(bytes: Uint8Array) => string`                          | Spells `bytes` in the RFC 4648 §5 url alphabet (`-`, `_`) with the padding removed — the canonical form, and the only form `decodeBase64URL` accepts. Total.         |
| `decodeBase64URL`  | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Reads back exactly what `encodeBase64URL` writes. A padded text, a `+`, or a `/` belongs to the §4 face and is `undefined` here.                                     |
| `isBase64URL`      | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeBase64URL` answers bytes for. Total on any value.                                                                                |
| `encodeHex`        | function | `(bytes: Uint8Array) => string`                          | Spells `bytes` in the RFC 4648 §8 alphabet, lowercase, two digits per byte — the canonical form, and the only form `decodeHex` accepts. Total: encoding cannot fail. |
| `decodeHex`        | function | `(text: string) => Uint8Array<ArrayBuffer> \| undefined` | Reads back exactly what `encodeHex` writes. An uppercase digit, an odd length, a `0x` prefix, whitespace, and any foreign character are `undefined`.                 |
| `isHex`            | function | `(value: unknown) => value is string`                    | True for exactly the strings `decodeHex` answers bytes for. Total on any value.                                                                                      |
| `measureBase64`    | function | `(text: string) => number \| undefined`                  | The byte length `decodeBase64` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeBase64` refuses.                    |
| `measureBase64URL` | function | `(text: string) => number \| undefined`                  | The byte length `decodeBase64URL` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeBase64URL` refuses.              |
| `measureHex`       | function | `(text: string) => number \| undefined`                  | The byte length `decodeHex` would return for `text`, without allocating those bytes; `undefined` for exactly the texts `decodeHex` refuses.                          |

**The round-trip law.** `decode*(encode*(bytes))` deep-equals `bytes`, for every byte sequence, the
empty one included.

**The canonical-form law.** `encode*(decode*(text)) === text`, for every text the face's guard
admits.

**The sound-triple law.** `measure*(text) === decode*(text)?.length`, for every string — the
admitted texts pinning a length, the refused ones pinning `undefined` on both sides.

RFC 4648 §8 prints its table uppercase; this package's canonical spelling is lowercase, matching
every producer the fleet already reads. One canonical spelling per input is the charter's law, so
`decodeHex('AB')` is `undefined` and `encodeHex(new Uint8Array([0xab]))` is `'ab'`.

```ts
import { decodeBase64, encodeBase64, isBase64 } from '@orkestrel/codec'

decodeBase64('aa==') // undefined — the unused trailing bits are not zero
decodeBase64('aQ==') // Uint8Array [105] — the canonical spelling of that byte
encodeBase64(new Uint8Array([105])) // 'aQ=='
decodeBase64('AQ ID') // undefined — whitespace
decodeBase64('A') // undefined — a length off the group boundary
decodeBase64('AQID=') // undefined — padding off the group boundary
decodeBase64('-_-_') // undefined — the url alphabet
isBase64('aa==') // false
```

See [`guides/codec.md`](guides/codec.md) in this repository for the membership bar and the full
doctrine.
