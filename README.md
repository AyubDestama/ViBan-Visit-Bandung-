# Visit Indonesia – Bandung (Frontend + Backend terpisah)

```
viban/
├── backend/    Express REST API (port 3000) + data JSON
└── frontend/   React + Vite (port 5173), ambil data lewat fetch ke /api
```

## Menjalankan
```
npm run install:all     # sekali saja, di folder utama
npm run dev             # backend + frontend sekaligus
```
Buka http://localhost:5173. Atau jalankan terpisah: `npm run dev:backend` dan `npm run dev:frontend`.

Saat dev, Vite meneruskan `/api/*` ke `http://localhost:3000` (lihat `frontend/vite.config.js`).

## Endpoint backend
| Method | URL | Keterangan |
|---|---|---|
| GET | `/api/health` | cek server |
| GET | `/api/gunung` | daftar gunung (opsional `?q=nama&tingkat=mudah`) |
| GET | `/api/gunung/:id` | detail gunung (404 jika tidak ada) |
| GET | `/api/pantai` | daftar pantai (opsional `?q=nama&kabupaten=garut`) |
| GET | `/api/pantai/:id` | detail pantai (404 jika tidak ada) |

Data ada di `backend/data/gunung.json` dan `pantai.json`. Gambar tetap di `frontend/public/img/`.

## Deploy terpisah
- Backend: `cd backend && npm install && npm start` (atur `PORT`, dan `FRONTEND_ORIGIN` untuk membatasi CORS).
- Frontend: buat `frontend/.env` berisi `VITE_API_URL=https://alamat-backend/api`, lalu `npm run build` dan upload folder `frontend/dist`.
