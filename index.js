#!/usr/bin/env node
// openapi-mock — Instant mock server from your OpenAPI spec
// Zero dependencies. Pure Node.js ES modules.

import http from 'http'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

// ─── LCG Seeded Random ────────────────────────────────────────────────────────

let seed = Date.now() & 0xffffffff

function setSeed(s) {
  seed = (s | 0) & 0xffffffff
}

function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return (seed >>> 0) / 0xffffffff
}

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randChoice(arr) {
  return arr[Math.floor(rand() * arr.length)]
}

// ─── YAML Parser (hand-rolled, handles OpenAPI basics) ───────────────────────

function parseYaml(text) {
  const lines = text.split('\n')
  const root = {}
  // stack entries: { indent, obj, key }
  const stack = [{ indent: -2, obj: root, isArray: false }]

  function currentObj() {
    return stack[stack.length - 1].obj
  }

  function popTo(indent) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }
  }

  function setVal(obj, key, val) {
    if (Array.isArray(obj)) {
      if (key !== null) {
        // setting a property on the last array element
        const last = obj[obj.length - 1]
        if (last && typeof last === 'object' && !Array.isArray(last)) {
          last[key] = val
        }
      }
    } else {
      obj[key] = val
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineContent = raw.trimEnd()
    if (!lineContent || lineContent.trimStart().startsWith('#')) continue

    const indent = raw.length - raw.trimStart().length
    const content = lineContent.trimStart()

    if (content.startsWith('- ')) {
      // Array item
      popTo(indent)
      const parent = currentObj()
      const rest = content.slice(2).trim()

      if (rest === '') {
        // next lines define an object element
        const newObj = {}
        if (Array.isArray(parent)) {
          parent.push(newObj)
          stack.push({ indent, obj: newObj, isArray: false })
        }
      } else if (rest.includes(':')) {
        // inline key: val inside array item
        const ci = rest.indexOf(':')
        const k = rest.slice(0, ci).trim()
        const v = rest.slice(ci + 1).trim()
        const newObj = {}
        newObj[k] = v === '' ? null : parseScalar(v)
        if (Array.isArray(parent)) {
          parent.push(newObj)
          stack.push({ indent, obj: newObj, isArray: false })
        }
      } else {
        const val = parseScalar(rest)
        if (Array.isArray(parent)) parent.push(val)
      }
      continue
    }

    const colonIdx = content.indexOf(':')
    if (colonIdx === -1) continue

    const rawKey = content.slice(0, colonIdx).trim()
    const key = String(parseScalar(rawKey) ?? rawKey)
    const rest = content.slice(colonIdx + 1).trim()

    popTo(indent)
    const parent = currentObj()

    if (rest === '' || rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
      // peek next line to determine if nested
      let nextLine = lines[i + 1]
      while (nextLine !== undefined && (nextLine.trim() === '' || nextLine.trimStart().startsWith('#'))) {
        i++
        nextLine = lines[i + 1]
      }
      if (nextLine === undefined) {
        setVal(parent, key, null)
        continue
      }
      const nextIndent = nextLine.length - nextLine.trimStart().length
      const nextContent = nextLine.trimStart()

      if (nextContent.startsWith('- ')) {
        const arr = []
        setVal(parent, key, arr)
        stack.push({ indent, obj: arr, isArray: true })
      } else if (nextIndent > indent) {
        const obj = {}
        setVal(parent, key, obj)
        stack.push({ indent, obj, isArray: false })
      } else {
        setVal(parent, key, null)
      }
    } else {
      setVal(parent, key, parseScalar(rest))
    }
  }

  return root
}

function parseScalar(s) {
  if (!s || s === 'null' || s === '~') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+$/.test(s)) return parseInt(s, 10)
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(s)) return parseFloat(s)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

// ─── $ref Resolver ────────────────────────────────────────────────────────────

function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return null
  const parts = ref.slice(2).split('/')
  let cur = spec
  for (const p of parts) {
    const key = p.replace(/~1/g, '/').replace(/~0/g, '~')
    if (cur == null || typeof cur !== 'object') return null
    cur = cur[key]
  }
  return cur
}

function resolveSchema(spec, schema) {
  if (!schema) return {}
  if (schema['$ref']) {
    const r = resolveRef(spec, schema['$ref'])
    return r ? resolveSchema(spec, r) : {}
  }
  return schema
}

// ─── Mock Data Generator ──────────────────────────────────────────────────────

const LOREM = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'eiusmod', 'tempor', 'labore', 'magna', 'aliqua', 'veniam', 'quis']
const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi']

function hex(bytes) {
  return Array.from({ length: bytes }, () => randInt(0, 255).toString(16).padStart(2, '0')).join('')
}

function generateFromSchema(spec, schema, depth = 0) {
  if (depth > 8) return null
  if (!schema) return null

  schema = resolveSchema(spec, schema)

  if (schema.enum && schema.enum.length > 0) return randChoice(schema.enum)

  if (schema.allOf) {
    const merged = {}
    for (const sub of schema.allOf) {
      const val = generateFromSchema(spec, resolveSchema(spec, sub), depth)
      if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(merged, val)
    }
    return merged
  }

  if (schema.oneOf || schema.anyOf) {
    const options = schema.oneOf || schema.anyOf
    return generateFromSchema(spec, resolveSchema(spec, options[0]), depth)
  }

  const type = schema.type

  if (type === 'string' || (!type && !schema.properties && !schema.items)) {
    const fmt = schema.format
    if (fmt === 'email') return `user${randInt(1, 999)}@example.com`
    if (fmt === 'uri' || fmt === 'url') return `https://example.com/${randChoice(LOREM)}`
    if (fmt === 'date') return `2024-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`
    if (fmt === 'date-time') return `2024-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}T${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00Z`
    if (fmt === 'uuid') return `${hex(4)}-${hex(2)}-${hex(2)}-${hex(2)}-${hex(6)}`
    if (fmt === 'password') return 'secret1234'
    if (fmt === 'byte') return Buffer.from(randChoice(LOREM)).toString('base64')
    const title = ((schema.title || '') + (schema.description || '')).toLowerCase()
    if (title.includes('name')) return randChoice(NAMES)
    if (title.includes('email')) return `user${randInt(1, 999)}@example.com`
    if (schema.minLength || schema.maxLength) {
      const len = randInt(schema.minLength || 3, schema.maxLength || 20)
      return LOREM.join(' ').slice(0, len)
    }
    return randChoice(LOREM)
  }

  if (type === 'integer' || type === 'number') {
    const min = schema.minimum !== undefined ? schema.minimum : 1
    const max = schema.maximum !== undefined ? schema.maximum : 1000
    if (type === 'integer') return randInt(min, max)
    return Math.round((rand() * (max - min) + min) * 100) / 100
  }

  if (type === 'boolean') return rand() > 0.5

  if (type === 'array' || schema.items) {
    const count = randInt(2, 5)
    const items = schema.items ? resolveSchema(spec, schema.items) : { type: 'string' }
    return Array.from({ length: count }, () => generateFromSchema(spec, items, depth + 1))
  }

  if (type === 'object' || schema.properties) {
    const obj = {}
    const props = schema.properties || {}
    for (const [k, v] of Object.entries(props)) {
      const resolved = resolveSchema(spec, v)
      obj[k] = generateFromSchema(spec, resolved, depth + 1)
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      obj[`extra_${randChoice(LOREM)}`] = generateFromSchema(spec, schema.additionalProperties, depth + 1)
    }
    return obj
  }

  return randChoice(LOREM)
}

// ─── Route Extraction ─────────────────────────────────────────────────────────

const METHOD_STATUS = { get: 200, post: 201, put: 200, patch: 200, delete: 204, head: 200, options: 200 }

function extractRoutes(spec) {
  const routes = []
  const paths = spec.paths || {}

  for (const [pathTemplate, methods] of Object.entries(paths)) {
    if (typeof methods !== 'object' || methods === null) continue
    for (const [method, operation] of Object.entries(methods)) {
      if (!METHOD_STATUS[method] || typeof operation !== 'object') continue

      const defaultStatus = METHOD_STATUS[method]
      const responses = (operation && operation.responses) || {}
      const successKey = Object.keys(responses).find(s => String(s).replace(/^["']|["']$/g, '').startsWith('2')) || String(defaultStatus)
      const responseObj = responses[successKey] || {}
      const content = responseObj.content || {}
      const jsonSchema = (content['application/json'] || content['*/*'] || {}).schema || null

      const regexStr = '^' + pathTemplate.replace(/\{([^}]+)\}/g, '(?<$1>[^/]+)') + '$'
      const regex = new RegExp(regexStr)

      routes.push({
        method: method.toUpperCase(),
        pathTemplate,
        regex,
        status: parseInt(successKey, 10) || defaultStatus,
        schema: jsonSchema,
      })
    }
  }

  return routes
}

// ─── Override Loader ──────────────────────────────────────────────────────────

function loadOverrides(p) {
  if (!p) return {}
  try {
    return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'))
  } catch (e) {
    console.error(`[warn] Could not load overrides: ${e.message}`)
    return {}
  }
}

// ─── CLI Parser ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2)
  const opts = { spec: null, port: 3000, delay: 0, cors: true, verbose: false, seed: null, overrides: null, help: false }
  let i = 0
  while (i < args.length) {
    const a = args[i]
    if (a === '--help' || a === '-h') { opts.help = true; break }
    if (a === '--port' || a === '-p') { opts.port = parseInt(args[++i], 10); i++; continue }
    if (a === '--delay') { opts.delay = parseInt(args[++i], 10); i++; continue }
    if (a === '--cors') { opts.cors = true; i++; continue }
    if (a === '--no-cors') { opts.cors = false; i++; continue }
    if (a === '--verbose' || a === '-v') { opts.verbose = true; i++; continue }
    if (a === '--seed') { opts.seed = parseInt(args[++i], 10); i++; continue }
    if (a === '--overrides') { opts.overrides = args[++i]; i++; continue }
    if (!a.startsWith('-') && !opts.spec) { opts.spec = a }
    i++
  }
  return opts
}

// ─── Server ───────────────────────────────────────────────────────────────────

function createServer(spec, routes, opts, overrides) {
  return http.createServer((req, res) => {
    const start = Date.now()
    const urlPath = (req.url || '/').split('?')[0]
    const method = (req.method || 'GET').toUpperCase()

    if (opts.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    }

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const respond = () => {
      let matched = null
      let params = {}
      for (const route of routes) {
        if (route.method !== method) continue
        const m = urlPath.match(route.regex)
        if (m) { matched = route; params = m.groups || {}; break }
      }

      if (!matched) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found', path: urlPath, method }))
        if (opts.verbose) console.log(`  404 ${method} ${urlPath}`)
        return
      }

      const overrideKey = `${method} ${matched.pathTemplate}`
      let body

      if (overrides[overrideKey] !== undefined) {
        body = JSON.stringify(overrides[overrideKey], null, 2)
      } else if (matched.status === 204) {
        body = ''
      } else {
        const data = matched.schema ? generateFromSchema(spec, matched.schema) : {}
        body = JSON.stringify(data, null, 2)
      }

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Mock-Server', 'openapi-mock')
      res.writeHead(matched.status)
      res.end(body)

      if (opts.verbose) {
        console.log(`  ${matched.status} ${method} ${urlPath} (${Date.now() - start}ms)`)
      }
    }

    if (opts.delay > 0) {
      setTimeout(respond, opts.delay)
    } else {
      respond()
    }
  })
}

// ─── Display ──────────────────────────────────────────────────────────────────

function printBanner(opts, routes) {
  const hr = '━'.repeat(38)
  console.log(`\nopenapi-mock · ${path.basename(opts.spec)}`)
  console.log(hr)
  console.log(`Mock server running at http://localhost:${opts.port}`)
  if (opts.delay) console.log(`Delay: ${opts.delay}ms`)
  if (opts.seed !== null) console.log(`Seed: ${opts.seed}`)
  console.log(`\nRoutes:`)
  for (const r of routes) {
    console.log(`  ${r.method.padEnd(6)} ${r.pathTemplate.padEnd(28)} → ${r.status}`)
  }
  console.log(`\nPress r reload · l list routes · q quit`)
  console.log(hr + '\n')
}

function listRoutes(routes) {
  console.log('\nRoutes:')
  for (const r of routes) console.log(`  ${r.method.padEnd(6)} ${r.pathTemplate} → ${r.status}`)
  console.log()
}

function printHelp() {
  console.log(`
openapi-mock — Instant mock server from your OpenAPI spec

Usage:
  npx openapi-mock <spec>         Start mock server
  npx openapi-mock <spec> [opts]

Options:
  --port N         Port to listen on (default: 3000)
  --delay N        Add N ms delay to all responses
  --seed N         Seed for reproducible random data
  --overrides <f>  Path to JSON overrides file
  --cors           Enable CORS headers (default: on)
  --no-cors        Disable CORS headers
  --verbose, -v    Log every request
  --help, -h       Show this help

Examples:
  npx openapi-mock api.yaml
  npx openapi-mock api.json --port 8080
  npx openapi-mock api.yaml --seed 42 --verbose
  npx openapi-mock api.yaml --overrides overrides.json

Interactive:
  r  Reload spec
  l  List routes
  q  Quit
`)
}

// ─── Spec Loader ──────────────────────────────────────────────────────────────

function loadSpec(specPath) {
  const abs = path.resolve(specPath)
  const raw = fs.readFileSync(abs, 'utf8')
  const ext = path.extname(abs).toLowerCase()
  return ext === '.json' ? JSON.parse(raw) : parseYaml(raw)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv)

  if (opts.help) { printHelp(); process.exit(0) }

  if (!opts.spec) {
    console.error('Error: No spec file specified.\n  Usage: npx openapi-mock <spec.yaml|spec.json>')
    process.exit(1)
  }

  if (!fs.existsSync(opts.spec)) {
    console.error(`Error: File not found: ${opts.spec}`)
    process.exit(1)
  }

  if (opts.seed !== null) setSeed(opts.seed)

  const overrides = loadOverrides(opts.overrides)
  let spec = loadSpec(opts.spec)
  let routes = extractRoutes(spec)

  const server = createServer(spec, routes, opts, overrides)

  server.listen(opts.port, () => {
    printBanner(opts, routes)
  })

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on('keypress', (str, key) => {
      if (str === 'q' || (key && key.ctrl && key.name === 'c')) {
        console.log('\nBye.')
        server.close()
        process.exit(0)
      }
      if (str === 'l') listRoutes(routes)
      if (str === 'r') {
        try {
          spec = loadSpec(opts.spec)
          routes = extractRoutes(spec)
          console.log(`\nReloaded. ${routes.length} routes.\n`)
        } catch (e) {
          console.error(`\nReload failed: ${e.message}\n`)
        }
      }
    })
  }

  process.on('SIGINT', () => {
    console.log('\nBye.')
    server.close()
    process.exit(0)
  })
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
