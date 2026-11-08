Each item is a chunk that reaches green before the next. An item keeps its number for life: a closed
item leaves this file and its number is never reused, so a commit message citing an item by number
stays true.

- **1.** At the next package visit, replace the local generator behind `MUTANT_DRAWS` in `tests/setup.ts` with direct use of `seededRandom` from `@orkestrel/contract`. Keep encoding alphabets, mutation operations, and coverage assertions local; record the changed deterministic population and prove the same encoding laws. Add no generator wrapper.
