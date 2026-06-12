import path from 'node:path'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import { createApp } from './app'

const port = Number.parseInt(process.env.PORT || '4174', 10)
const host = process.env.HOST || '127.0.0.1'
const isProduction = process.env.NODE_ENV === 'production'

async function main() {
  const app = createApp()

  if (isProduction) {
    const dist = path.join(process.cwd(), 'dist')
    app.use(express.static(dist))
    app.use((_req, res) => {
      res.sendFile(path.join(dist, 'index.html'))
    })
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  app.listen(port, host, () => {
    const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`
    console.log(`HTML Document Viewer running at ${url}`)
    if (host === '0.0.0.0') {
      console.log('Remote access is enabled. Set HDV_TOKEN to allow write/export actions through a public host.')
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
