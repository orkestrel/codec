import { expect, it } from 'vitest'
import { requireValue } from '@orkestrel/test'
import { decodeUTF8, encodeUTF8 } from '@src/core'
import {
	buildBenchStrings,
	buildBenchText,
	decodeUTF8Oracle,
	UTF8_BENCH_RUNS,
	UTF8_BENCH_STRINGS,
} from '../../setup.js'

// The cost of `decodeUTF8` on the host's strict decoder beside the walk it shipped in codec 0.0.12,
// which `decodeUTF8Oracle` keeps. Every input is encoded before the timed region. The bars are the
// targets the change was kept on: 20 times faster on the mixed 2 MB text and twice as fast on the
// short texts a model load decodes. A refusal is reported with no bar, because the host throws where
// the walk returned. Run it with `npm run test:bench`.

it('decodes a mixed 2 MB text at least 20 times faster than the shipped walk', async ({
	bench,
}) => {
	const bytes = requireValue(encodeUTF8(buildBenchText(UTF8_BENCH_RUNS, 0x2a2a2a2a)))
	const result = await bench.compare(
		bench('host', () => {
			decodeUTF8(bytes)
		}),
		bench('walk', () => {
			decodeUTF8Oracle(bytes)
		}),
		{ time: 2000, warmupTime: 500 },
	)
	expect(result.get('host')).toBeFasterThan(result.get('walk'), { delta: 0.95 })
}, 600_000)

it('decodes short texts at least twice as fast as the shipped walk', async ({ bench }) => {
	const inputs = buildBenchStrings(UTF8_BENCH_STRINGS, 0x51515151).map((text) =>
		requireValue(encodeUTF8(text)),
	)
	const result = await bench.compare(
		bench('host', () => {
			for (const bytes of inputs) decodeUTF8(bytes)
		}),
		bench('walk', () => {
			for (const bytes of inputs) decodeUTF8Oracle(bytes)
		}),
		{ time: 2000, warmupTime: 500 },
	)
	expect(result.get('host')).toBeFasterThan(result.get('walk'), { delta: 0.5 })
}, 600_000)

it('reports the cost of a refusal at the first byte and at the last', async ({ bench }) => {
	const text = requireValue(encodeUTF8(buildBenchText(UTF8_BENCH_RUNS, 0x2a2a2a2a)))
	const first = Uint8Array.from(text, (byte, index) => (index === 0 ? 0xff : byte))
	const last = Uint8Array.from(text, (byte, index) => (index === text.length - 1 ? 0xff : byte))
	await bench.compare(
		bench('host at the first byte', () => {
			decodeUTF8(first)
		}),
		bench('walk at the first byte', () => {
			decodeUTF8Oracle(first)
		}),
		bench('host at the last byte', () => {
			decodeUTF8(last)
		}),
		bench('walk at the last byte', () => {
			decodeUTF8Oracle(last)
		}),
		{ time: 2000, warmupTime: 500 },
	)
	expect(decodeUTF8(first)).toBeUndefined()
	expect(decodeUTF8(last)).toBeUndefined()
}, 600_000)
