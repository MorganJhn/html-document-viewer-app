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

  const currentPort = port
  const maxPortTries = 10

  function startServer(attemptPort: number) {
    const server = app.listen(attemptPort, host, () => {
      const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${attemptPort}`
      console.log(`HTML Document Viewer running at ${url}`)
      if (host === '0.0.0.0') {
        console.log('Remote access is enabled. Set HDV_TOKEN to allow write/export actions through a public host.')
      }
    })

    server.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'EADDRINUSE' && attemptPort - port < maxPortTries) {
        console.log(`Port ${attemptPort} is already in use, trying next port...`)
        startServer(attemptPort + 1)
      } else {
        console.error(err)
        process.exit(1)
      }
    })
  }

  startServer(currentPort)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
