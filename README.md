<div align="center">

# openapi-mock

**Spin up a mock API server from any OpenAPI spec in one command**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](package.json)

</div>

## Install
```bash
npx github:NickCirv/openapi-mock api.yaml
```

## Usage
```bash
# Start with defaults (port 3000)
npx github:NickCirv/openapi-mock api.yaml

# Custom port, artificial delay, reproducible data
npx github:NickCirv/openapi-mock api.yaml --port 8080 --delay 200 --seed 42
```

| Flag | Description |
|------|-------------|
| `--port N` | Port to listen on (default: 3000) |
| `--delay N` | Add N ms latency to every response |
| `--seed N` | Seed for reproducible random data |
| `--overrides <file>` | JSON file with fixed response overrides |
| `--no-cors` | Disable CORS headers (on by default) |
| `--verbose` / `-v` | Log every request with status + timing |
| `--help` / `-h` | Show help |

## What it does

Reads an OpenAPI 3.0 spec (YAML or JSON), extracts every path and method, and starts an HTTP server that returns realistic mock data. String fields respect `format` hints (`email`, `uuid`, `date`, `date-time`, `uri`). Arrays return 2-5 items, `$ref` schemas are resolved, and `enum` values are sampled randomly. While the server is running, press `r` to reload the spec, `l` to list routes, or `q` to quit.

---
<sub>Zero dependencies · Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
