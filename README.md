# 🚀 TokSort Backend

Backend API untuk memproses dan menyortir data CSV dari TikTok Shop.

---

## ⚡ Fitur

* Upload CSV
* Cleaning data (ambil field penting saja)
* Auto label:

  * **urgent** (< 12:00)
  * **normal** (≥ 12:00)
* Read data (JSON)
* Delete file
* Swagger API Docs

---

## 📡 Endpoint

```bash
POST   /api/upload
GET    /api/history
GET    /api/read/:filename
DELETE /api/delete/:filename
```

---

## ▶️ Run

```bash
npm install
npm start
```

---

## 🌐 API Docs

```bash
/api-docs
```

---

## 🚀 Deploy

Disarankan pakai Render.

---

## ⚠️ Note

File upload bersifat sementara (akan hilang jika server restart).