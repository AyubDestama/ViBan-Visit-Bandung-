import express from 'express'
import cors from 'cors'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const muat = (nama) => JSON.parse(readFileSync(join(__dirname, '..', 'data', nama + '.json'), 'utf-8'))

// Data dibaca sekali saat server start. Ganti ke database kalau nanti dibutuhkan.
const DATA = { gunung: muat('gunung'), pantai: muat('pantai') }

const PORT = process.env.PORT || 3000
const app = express()

// FRONTEND_ORIGIN boleh diisi (pisahkan dengan koma) untuk membatasi asal request. Default: semua.
const origin = process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : true
app.use(cors({ origin }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// GET /api/gunung  dan  /api/pantai   (opsional: ?q=nama, khusus pantai ?kabupaten=garut)
// GET /api/gunung/:id  dan  /api/pantai/:id
for (const jenis of ['gunung', 'pantai']) {
  app.get(`/api/${jenis}`, (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase()
    const { kabupaten, tingkat } = req.query
    const hasil = DATA[jenis].filter((d) =>
      (!q || d.nama.toLowerCase().includes(q)) &&
      (!kabupaten || d.kabupaten === kabupaten) &&
      (!tingkat || d.tingkat === tingkat)
    )
    res.json(hasil)
  })

  app.get(`/api/${jenis}/:id`, (req, res) => {
    const item = DATA[jenis].find((d) => d.id === Number(req.params.id))
    if (!item) return res.status(404).json({ error: `${jenis} dengan id ${req.params.id} tidak ditemukan` })
    res.json(item)
  })
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ada' }))

app.listen(PORT, () => console.log(`Backend jalan di http://localhost:${PORT}`))
