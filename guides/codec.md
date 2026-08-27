# Codec

> The fleet's byte-to-text codings, as sound `encode` / `decode` / guard triples over `string` and
> `Uint8Array` — RFC 4648 Base64 and base64url today. Zero runtime dependencies, no error type, no
> options, no class. Source: [`src/core`](../src/core). Published through `@orkestrel/codec`.

A coding is a spec-named, stateless mapping with one canonical spelling per input, written as an
`encode*` that produces only the canonical form, a `decode*` that accepts exactly that form and
answers `undefined` for everything else, and an `is*` guard that names the exact set its decoder
accepts. Every function is pure ES: no `atob` / `btoa`, no `Buffer`, no `TextEncoder` /
`TextDecoder`, no `node:*`, and no dependency on another `@orkestrel` package. Totality is
implemented rather than caught: codec ships no error type, no options bag, no class, and no type of
its own. It is not a formats package — it does not compress, frame a stream, escape a document, map
values into a store, or read JSON.

The families are fixed. `encode*` takes bytes and returns the canonical text, and cannot fail.
`decode*` takes text and returns bytes or `undefined`, and never throws. `is*` takes an `unknown`
and narrows it to `string`, and never throws. A face's guard and its decoder are one grammar: the
guard answers by asking the decoder, so the set the guard names and the set the decoder accepts
cannot drift apart.

## Surface

### Codings

The RFC 4648 faces: the codings from [`helpers.ts`](../src/core/helpers.ts) and the guards from
[`validators.ts`](../src/core/validators.ts). `Base64` names the §4 coding and `Base64URL` the §5
one; the alphabets and the reverse lookup behind them are module data, not public API, because
publishing an alphabet invites hand-rolling the coding it belongs to.

| Name              | Kind     | Signature                                  | Behavior                                                                                                                                                            |
| ----------------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encodeBase64`    | function | `(bytes: Uint8Array) => string`            | Spells `bytes` in the RFC 4648 §4 alphabet (`+`, `/`) with `=` padding — the canonical form, and the only form `decodeBase64` accepts. Total: encoding cannot fail. |
| `decodeBase64`    | function | `(text: string) => Uint8Array<ArrayBuffer> | undefined`\|`(text: string) => Uint8Array<ArrayBuffer>                                                                                                              | undefined` | Reads back exactly what `encodeBase64` writes. Every other text — wrong alphabet, whitespace, wrong padding, a non-zero unused trailing bit — is `undefined`. |
| `isBase64`        | function | `(value: unknown) => value is string`      | True for exactly the strings `decodeBase64` answers bytes for. Total on any value: a number, `null`, or a byte sequence is false rather than a throw.               |
| `encodeBase64URL` | function | `(bytes: Uint8Array) => string`            | Spells `bytes` in the RFC 4648 §5 url alphabet (`-`, `_`) with the padding removed — the canonical form, and the only form `decodeBase64URL` accepts. Total.        |
| `decodeBase64URL` | function | `(text: string) => Uint8Array<ArrayBuffer> | undefined`\|`(text: string) => Uint8Array<ArrayBuffer>                                                                                                              | undefined` | Reads back exactly what `encodeBase64URL` writes. A padded text, a `+`, or a `/` belongs to the §4 face and is `undefined` here.                              |
| `isBase64URL`     | function | `(value: unknown) => value is string`      | True for exactly the strings `decodeBase64URL` answers bytes for. Total on any value.                                                                               |

## The laws

Each face keeps two laws, and the suite drives both as sweeps rather than as spot vectors.

**The round-trip law.** `decode*(encode*(bytes))` deep-equals `bytes`, for every byte sequence, the
empty one included.

**The canonical-form law.** `encode*(decode*(text)) === text`, for every text the face's guard
admits.

The canonical-form law is the one that does the work. It says a decoder may accept only the
spelling its own encoder produces, which rules out every lenient door at once: the wrong alphabet
and embedded whitespace close for both faces. Missing or excess padding and a length off the
four-character group boundary are the §4 doors; §5 spells the same closure its own way — the
unpadded url alphabet, refusing `=`, `+`, and `/` outright, and refusing any `length % 4 === 1`
residue, which no amount of padding can complete. And a non-zero unused trailing bit closes last,
for both faces alike. That last refusal is the one consumers meet: `'aa=='` carries a set bit in
the sextet the padding discards, so `decodeBase64('aa==')` is `undefined` and `isBase64('aa==')` is
false. `'aQ=='` is the canonical spelling of the byte `'aa=='` was reaching for, and it decodes.
The url face refuses `'aa'` for the same reason, and admits `'aQ'`.

## Membership

A coding belongs here when it is:

- **stateless and spec-named** — a mapping between bytes and text fixed by a published
  specification, carrying no configuration and no instance;
- **single-spelled** — exactly one canonical text per input;
- **guard-decidable** — membership in the accepted set is decidable from the text alone, so an
  `is*` can name it;
- **both-lawed** — the round-trip law and the canonical-form law hold as written;
- **wanted** — a real consumer in the fleet needs it now.

A transform that carries state between calls, that takes a parameter changing what it produces,
that reads a document grammar rather than a byte-to-text mapping, or that encodes a caller's policy
rather than a specification, is outside the bar. Leniency is a caller's policy in particular: a
consumer that must accept whitespace or unpadded §4 input normalizes its input and then calls the
strict decoder, so the leniency lives with the consumer that owns it rather than in every consumer
of this package.

## Declared non-goals

- **No lenient doors.** No whitespace stripping, no optional padding, no permissive alphabet, and
  no option to relax any of it.
- **No error type.** A decoder reports failure as `undefined` and a guard reports it as `false`.
  Nothing here throws, so there is nothing to catch and no code to branch on.
- **Not yet, and behind the bar:** UTF-8 text codings, hex, charset decoders, and `measure*`
  size predictions. Each is a candidate for a later wave, and each has to meet the membership bar
  with a real consumer before it lands.
- **Never:** compression, stream framing, document escaping, value-to-store mapping, and JSON.
  Those are other packages' work.

## Patterns

### Encode and decode a byte sequence

```ts
import { decodeBase64, encodeBase64 } from '@orkestrel/codec'

encodeBase64(new Uint8Array([104, 105])) // 'aGk='
decodeBase64('aGk=') // Uint8Array [104, 105]
encodeBase64(new Uint8Array([])) // ''
decodeBase64('') // Uint8Array []
```

### Reach the url face

```ts
import { decodeBase64URL, encodeBase64URL } from '@orkestrel/codec'

encodeBase64URL(new Uint8Array([104, 105])) // 'aGk' — §5 carries no padding
encodeBase64URL(new Uint8Array([0xfb, 0xff, 0xbf])) // '-_-_'
decodeBase64URL('-_-_') // Uint8Array [251, 255, 191]
decodeBase64URL('aGk=') // undefined — padding belongs to §4
decodeBase64URL('+/+/') // undefined — those characters belong to §4
```

### Meet the canonical refusals

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

### Ask a value whether a decoder would take it

```ts
import { isBase64, isBase64URL } from '@orkestrel/codec'

isBase64('aGk=') // true
isBase64('aGk') // false — §4 requires the padding
isBase64URL('aGk') // true
isBase64URL('aGk=') // false
isBase64URL(42) // false — total on any value, never a throw
```

### Drive both laws

```ts
import { decodeBase64, encodeBase64, isBase64 } from '@orkestrel/codec'

const bytes = new Uint8Array([0, 1, 2, 253, 254, 255])
const text = encodeBase64(bytes) // 'AAEC/f7/'

// The round-trip law: decoding an encoding returns the bytes.
decodeBase64(text) // deep-equals bytes

// The canonical-form law: re-encoding an admitted text returns the text.
isBase64(text) // true
const decoded = decodeBase64(text)
if (decoded !== undefined) encodeBase64(decoded) // === text
```

## Tests

- [`tests/src/core/helpers.test.ts`](../tests/src/core/helpers.test.ts) — both laws as sweeps: the
  whole octet space in one buffer, every padding residue, every single byte and every byte pair,
  and an exhaustive walk over short texts spanning both alphabets that re-encodes every admitted
  text to itself; the written-out membership rows that bind each guard to its decoder; the named
  vectors; the canonical refusals; the alphabets read against the specification in both
  directions; and guard totality against hostile values.
- [`tests/policy.test.ts`](../tests/policy.test.ts) — repository coding law: source placement,
  exports, and syntax.
- [`tests/config.test.ts`](../tests/config.test.ts) — the root configuration's aliases, projects,
  outputs, and the gate each proof runs from.
- [`tests/guides.test.ts`](../tests/guides.test.ts) — this guide against the real surface, in both
  directions, plus the transcribed fences.
- [`tests/distribution.test.ts`](../tests/distribution.test.ts) — the packed package installs and
  resolves through its public exports.

## See also

- [`AGENTS.md`](../AGENTS.md) — the repository rules this package is written to.
- [`guide.md`](guide.md) — the mirrored guide for `@orkestrel/guide`, the devDependency powering the
  guides-parity suite.
- [`scaffold.md`](scaffold.md) — the mirrored guide for `@orkestrel/scaffold`, the devDependency
  that generated this workspace.
- [`README.md`](README.md) — the guides index.
