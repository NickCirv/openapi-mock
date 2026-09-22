# Command reference

Use `node index.js` from the pinned source checkout described in the [README](../README.md). The entries below describe the inspected implementation.

| Command or argument | Behavior |
| --- | --- |
| `SPEC_FILE` | Load an OpenAPI JSON or YAML specification. |
| `-p, --port N` | Set the HTTP listening port; defaults to 3000. |
| `--delay MS` | Delay responses by the requested milliseconds. |
| `--seed N` | Seed generated mock data for reproducibility. |
| `--overrides FILE` | Load JSON response overrides keyed by method and route. |
| `--cors` | Enable CORS response headers, the default. |
| `--no-cors` | Disable those CORS headers. |
| `-v, --verbose` | Log incoming requests. |

For prerequisites, file writes, external services and known limitations, see [Behavior and limits](../README.md#behavior-and-limits).

Implementation: [index.js](https://github.com/NickCirv/openapi-mock/blob/580e869f8230f81410f047642465f21b194f7552/index.js); [review evidence](RESEARCH.md).
