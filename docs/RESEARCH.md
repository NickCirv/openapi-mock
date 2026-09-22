# Source review — openapi-mock

## Revision and method

Inspected public commit: [`580e869f8230f81410f047642465f21b194f7552`](https://github.com/NickCirv/openapi-mock/commit/580e869f8230f81410f047642465f21b194f7552). Source tree: `8ea4916d65e57f7da4f658c321f8125a624925c8`. Capture scope: all eligible text files; 6 of 6 eligible files.

This review read captured implementation and documentation. It did not install dependencies, execute project commands, call project APIs, check package publication or establish live CI status. Examples are source-derived, not captured execution transcripts.

## Claim ledger

| Claim | Evidence | Status |
| --- | --- | --- |
| Argument parsing, schema generation, server binding and responses | [index.js](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/index.js) | Verified in inspected source; execution unverified |

## Findings and verification gaps

YAML parsing and schema generation are hand-written subsets, not complete OpenAPI/YAML validation. Only local `#/` references are resolved, and recursive generation has a depth cap. The listener does not specify a loopback host, so do not assume it is private to localhost. There is no authentication implementation. Generated responses are fixtures, not evidence that a real service follows the contract.

The captured smoke test only asks Node to syntax-check the entrypoint. It does not exercise behavior, integrations or failure paths. Neither that test nor installation was run in this review.

| Dimension | Result |
| --- | --- |
| Purpose and documented commands | Partially verified: static source inspection |
| Clean installation and examples | Unverified |
| Test suite and live CI | Unverified |
| Performance and security guarantees | Unverified |
| Publication | Local documentation only |

## Documentation inventory

- [README.md](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/README.md) — Rewritten; historic section anchors retained where practical.
- [LICENSE](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/LICENSE) — protected document preserved unchanged.

## Captured source inventory

- [LICENSE](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/LICENSE) — Git blob `05b804beeec7d1a6c933d087387ba4adf6463d93`.
- [README.md](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/README.md) — Git blob `202f2de22ca36216235303894879a67527dbeb1e`.
- [package.json](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/package.json) — Git blob `93a0e7f016c150cf42015980a461d9b41c312b12`.
- [.github/workflows/ci.yml](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/.github/workflows/ci.yml) — Git blob `44515034a394670de44454a7a1bd2c7ef0c9836e`.
- [index.js](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/index.js) — Git blob `487526ff6bab7cbb1110bfbd22078258a955cc55`.
- [test/smoke.test.js](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/test/smoke.test.js) — Git blob `ebbccaaf2583b4850575f835313e4b0afd21bff7`.

## Scope boundary

Capture excludes lockfiles, binary artwork, generated output, vendored dependencies and files above the acquisition size limit. The tree records their existence; no verification claim is made for omitted content. Protected documents and historical records are not replaced.

## Reference coverage

Added [command reference](REFERENCE.md) from the argument parser, command handlers and source-defined help at the pinned revision. README examples remain unexecuted.
