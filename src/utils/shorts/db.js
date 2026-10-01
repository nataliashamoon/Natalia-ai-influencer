// Tiny IndexedDB wrapper for Shorts Studio projects. Videos are far too big for
// localStorage, so projects (source video, transcript, clips, renders) live here.

const DB_NAME = 'lavi_shorts'
const VERSION = 1
let dbp = null

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

async function tx(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const req = fn(s)
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export const listProjects = async () => ((await tx('projects', 'readonly', s => s.getAll())) || []).sort((a, b) => b.updatedAt - a.updatedAt)
export const getProject = id => tx('projects', 'readonly', s => s.get(id))
export const saveProject = p => tx('projects', 'readwrite', s => s.put({ ...p, updatedAt: Date.now() }))
export async function deleteProject(p) {
  const keys = [p.sourceKey, ...(p.clips || []).flatMap(c => [c.renderKey, ...Object.values(c.dubs || {}).map(d => d.key)])].filter(Boolean)
  await tx('blobs', 'readwrite', s => { keys.forEach(k => s.delete(k)); return null })
  await tx('projects', 'readwrite', s => s.delete(p.id))
}
export const putBlob = (key, blob) => tx('blobs', 'readwrite', s => s.put(blob, key))
export const getBlob = key => tx('blobs', 'readonly', s => s.get(key))
export const deleteBlob = key => tx('blobs', 'readwrite', s => s.delete(key))
