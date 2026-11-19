// Streaming .tar.gz reader (no dependencies).
// We download a whole repo in ONE request and only keep the files we want;
// everything else is skipped without being held in memory.

import zlib from 'node:zlib'
import { Readable } from 'node:stream'

function readString(buf, start, len) {
  const slice = buf.subarray(start, start + len)
  const end = slice.indexOf(0)
  return slice.subarray(0, end === -1 ? len : end).toString('utf8')
}

function readOctal(buf, start, len) {
  const s = readString(buf, start, len).trim()
  return s ? parseInt(s, 8) : 0
}

function parsePax(text) {
  const out = {}
  let i = 0
  const buf = Buffer.from(text)
  while (i < buf.length) {
    const sp = buf.indexOf(0x20, i)
    if (sp === -1) break
    const len = parseInt(buf.subarray(i, sp).toString(), 10)
    if (!len) break
    const record = buf.subarray(sp + 1, i + len - 1).toString('utf8')
    const eq = record.indexOf('=')
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1)
    i += len
  }
  return out
}

/**
 * @param {Response} response  fetch() response with a gzip tarball body
 * @param {(path:string, size:number) => 'keep'|'skip'} decide  called per file
 * @param {(path:string, data:Buffer) => void} onKept  called with the bytes of kept files
 * @returns {Promise<{ allPaths: {path:string,size:number}[] }>}
 */
export async function readTarball(response, decide, onKept, { maxBytes = Infinity } = {}) {
  const gunzip = zlib.createGunzip()
  Readable.fromWeb(response.body).pipe(gunzip)
  const it = gunzip[Symbol.asyncIterator]()

  let buf = Buffer.alloc(0)
  let total = 0
  const more = async () => {
    const { value, done } = await it.next()
    if (done) return false
    total += value.length
    if (total > maxBytes) throw new Error('This repository is too big to download in one go.')
    buf = buf.length ? Buffer.concat([buf, value]) : value
    return true
  }
  const need = async (n) => {
    while (buf.length < n) if (!(await more())) return false
    return true
  }
  const take = async (n) => {
    if (!(await need(n))) throw new Error('The repository archive ended unexpectedly.')
    const out = buf.subarray(0, n)
    buf = buf.subarray(n)
    return out
  }
  const skip = async (n) => {
    while (n > 0) {
      if (!buf.length && !(await more())) return
      const k = Math.min(n, buf.length)
      buf = buf.subarray(k)
      n -= k
    }
  }

  const allPaths = []
  let pendingPath = null
  let rootPrefix = null

  for (;;) {
    if (!(await need(512))) break
    const header = await take(512)
    if (header.every((b) => b === 0)) continue
    let name = readString(header, 0, 100)
    const prefix = readString(header, 345, 155)
    if (prefix) name = `${prefix}/${name}`
    const size = readOctal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 48)
    const padded = Math.ceil(size / 512) * 512

    if (type === 'x' || type === 'L') {
      const data = await take(padded)
      const text = data.subarray(0, size).toString('utf8')
      if (type === 'x') {
        const pax = parsePax(text)
        if (pax.path) pendingPath = pax.path
      } else {
        pendingPath = text.replace(/\0+$/, '')
      }
      continue
    }
    if (type === 'g') {
      await skip(padded)
      continue
    }

    const fullPath = pendingPath || name
    pendingPath = null
    if (type !== '0' && type !== '\0') {
      await skip(padded)
      continue
    }

    // strip the "owner-repo-sha/" first directory
    const slash = fullPath.indexOf('/')
    if (rootPrefix === null) rootPrefix = fullPath.slice(0, slash + 1)
    const path = fullPath.startsWith(rootPrefix) ? fullPath.slice(rootPrefix.length) : fullPath
    if (!path) {
      await skip(padded)
      continue
    }
    allPaths.push({ path, size })

    if (decide(path, size) === 'keep') {
      const data = await take(padded)
      onKept(path, data.subarray(0, size))
    } else {
      await skip(padded)
    }
  }
  return { allPaths }
}
