# 🔁 Auto ETH Sender with Telegram Alerts

Script Node.js untuk mengirim ETH ke daftar alamat secara otomatis dengan delay acak, sambil mengirim notifikasi ke Telegram saat transaksi berhasil atau gagal.

## 🚀 Fitur

- Kirim ETH ke banyak alamat dari file `.env`
- Delay acak antar transaksi (1–5 menit)
- Notifikasi real-time via Telegram (TX sent, confirmed, atau gagal)
- Retry otomatis jika transaksi gagal

---

## 🛠️ Instalasi

1. **Clone repo ini:**
   ```bash
   git clone https://github.com/hokireceh/tea.git
   cd tea
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Buat file `.env` berdasarkan template di bawah ini:**

---

## 📄 Contoh `.env`

```env
# RPC URL jaringan (contoh: Sepolia, atau testnet lain)
RPC_URL=https://rpc.sepolia.org

# Private key dari wallet pengirim
PRIVATE_KEY=0x123...

# Daftar alamat tujuan (dipisah dengan koma)
TO_ADDRESSES=0xabc...,0xdef...,0xghi...

# Jumlah ETH yang dikirim ke tiap alamat
AMOUNT=0.001

# Telegram Bot Token
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Chat ID Telegram tujuan
CHAT_ID=123456789
```

---

## 🧠 Cara Kerja

- Script akan looping terus-menerus (`while (true)`) mengirim ETH ke semua alamat satu per satu.
- Setelah tiap transaksi, script akan:
  - Menunggu konfirmasi TX.
  - Mengirim notifikasi ke Telegram.
  - Menunggu delay acak 1–5 menit sebelum lanjut ke alamat berikutnya.
- Jika transaksi gagal, script akan mencoba ulang setelah 1 menit.

---

## 📦 Jalankan Script

```bash
node sendTx.js
```

---

## 🧪 Notes

- Gunakan testnet (misalnya Sepolia) saat mencoba pertama kali.
- **JANGAN gunakan wallet utama**. Gunakan wallet dengan dana terbatas untuk keamanan.
- Kamu bisa ganti explorer link jika menggunakan jaringan selain Sepolia:
  ```js
  https://sepolia.tea.xyz/tx/${txResponse.hash}
  ```

---
