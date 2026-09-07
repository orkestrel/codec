# @orkestrel/codec

> The fleet's byte-to-text codings: sound `encode` / `decode` / guard triples over `string` and
> `Uint8Array` for RFC 4648 Base64, base64url, and hex and for the UTF-8, ISO-8859-1,
> Windows-1252, and UTF-16LE charsets, beside a `measure*` that answers a coding's byte-side size
> question without producing those bytes.

Import the face you need from `@orkestrel/codec` and call it: every export is a plain function over
`string` and `Uint8Array`, with no options bag, no class, no error type, and no runtime dependency.
A decoder reports refusal as `undefined` and a guard reports it as `false`, so there is nothing to
catch and nothing to configure. Source: [`src/core`](src/core). Part of the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/codec
```

## Requirements

- Node.js >= 22.12.0, matching the `engines` field in `package.json`
- ESM and CommonJS entry points, selected by the `exports` field in `package.json`
- No runtime dependencies, so installing this package installs nothing else

The RFC 4648 faces and their guards are the guide's [Codings](guides/codec.md#codings) section, and
the byte-side sizes beside them are its [Measures](guides/codec.md#measures) section.

A charset's wire form is bytes rather than text, so its `encode*` takes a string and its `decode*`
takes bytes. The laws are unchanged; only the direction each is written in inverts. Those faces
are the guide's [Charsets](guides/codec.md#charsets) section.

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

The charsets part from the platform's own codings where the guide names it: the WHATWG `latin1`
label is windows-1252 rather than ISO-8859-1, the WHATWG windows-1252 index defines the slots this
code page leaves undefined, and a fatal `TextDecoder` strips a leading BOM that this package's
round-trip law keeps.

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
