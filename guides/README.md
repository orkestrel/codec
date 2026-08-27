# Guides

A dual-axis index into this repository's guides — by concept, and by directory.

## By concept

| Concept | Spec                   | Source                    | Tests                                 |
| ------- | ---------------------- | ------------------------- | ------------------------------------- |
| Codec   | [`codec.md`](codec.md) | [`src/core`](../src/core) | [`tests/src/core`](../tests/src/core) |

## By directory

| Directory  | Guide                  |
| ---------- | ---------------------- |
| `src/core` | [`codec.md`](codec.md) |

## Dependency reference

[`guide.md`](guide.md) is a byte-identical mirror of the guide for `@orkestrel/guide` — the
devDependency powering this repository's guides-parity suite
([`tests/guides.test.ts`](../tests/guides.test.ts)). It documents **that package's** surface
(`Guide` / `Source`, the manifest and comparison helpers), not anything sourced in this repository;
it is kept here so a reader of the parity suite can see the primitives it is built from without
leaving this guide set.

[`scaffold.md`](scaffold.md) is a mirror of the guide for `@orkestrel/scaffold` — the devDependency
that generated this workspace. It documents **that package's** surface (the generator, its target
selection, and the emitted layout), not anything sourced in this repository; it is kept here so a
reader can see which files are scaffold contract and which are this package's own without leaving
this guide set.

## See also

- [`AGENTS.md`](../AGENTS.md) — the repository rules, including the documentation contract every guide here is held to.
