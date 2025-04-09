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
   git clone https://github.com/hokireceh/auto-tx-tea.git
   cd auto-tx-tea
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Buat file `.env` berdasarkan template di bawah ini:**

---

## 📄 Contoh `.env`

```.env
# RPC endpoint dari jaringan testnet Tea Sepolia
RPC_URL=https://tea-sepolia.g.alchemy.com/v2/your-alchemy-api-key

# Private key wallet pengirim
PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# Daftar wallet tujuan (dipisah koma, tanpa spasi)
TO_ADDRESSES=0xAddress1,0xAddress2,0xAddress3

# Jumlah TEA yang ingin dikirim per wallet (dalam satuan ETH, misalnya 0.01)
AMOUNT=0.01

# Token Bot Telegram
BOT_TOKEN=123456789:AAExampleTokenTelegramABCDEF

# Chat ID Telegram kamu (pastikan bot sudah bisa kirim ke sini)
CHAT_ID=123456789

# (Opsional) URL explorer untuk link TX
EXPLORER_URL=https://sepolia.tea.xyz

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
