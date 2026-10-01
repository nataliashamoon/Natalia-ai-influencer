import { zip } from 'fflate'

// Bundles files into one ZIP so "Download all" is a single download — browsers
// block a page from saving several files in a row. Video is already compressed,
// so entries are stored (level 0), which is also much faster.
export async function zipFiles(files) {
  const entries = {}
  for (const { name, blob } of files) entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
  const data = await new Promise((resolve, reject) => zip(entries, (err, out) => (err ? reject(err) : resolve(out))))
  return new Blob([data], { type: 'application/zip' })
}
