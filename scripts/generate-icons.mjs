import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1c2b43"/><g fill="none" stroke="#93baff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 24h26l-8-8m8 8-8 8M45 40H19l8-8m-8 8 8 8"/></g></svg>'
await mkdir('public/icons', { recursive: true })
await writeFile('public/favicon.svg', svg)
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100%;height:100%}</style>${svg}`)
    await page.screenshot({ path: `public/icons/pocket-${size}.png` })
    if (size === 512) await page.screenshot({ path: 'public/icons/pocket-maskable-512.png' })
  }
} finally { await browser.close() }
