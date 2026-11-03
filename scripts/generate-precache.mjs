import { readdir, readFile, writeFile } from 'node:fs/promises'

const files = await readdir('.next/static', { recursive: true, withFileTypes: true })
const urls = files.filter(file => file.isFile()).map(file => `/_next/static/${file.parentPath.replace(/^\.next\/static\/?/, '')}/${file.name}`.replace('/static//', '/static/'))
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim()
const template = await readFile('scripts/service-worker.js', 'utf8')
await writeFile('public/sw.js', template.replace('__BUILD_ID__', buildId).replace('/* PRECACHE_URLS */ []', JSON.stringify(['/', '/favicon.svg', '/icons/pocket-192.png', '/icons/pocket-512.png', '/icons/pocket-maskable-512.png', ...urls])))
console.log(`Generated service worker with ${urls.length} public build assets.`)
