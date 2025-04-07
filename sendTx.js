require("dotenv").config();
const { ethers } = require("ethers");
const https = require("https");

// Load dari .env
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TO_ADDRESSES = process.env.TO_ADDRESSES.split(",").map(addr => addr.trim());
const AMOUNT = process.env.AMOUNT;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Setup provider dan wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Kirim notifikasi ke Telegram
function sendTelegramMessage(message) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=Markdown`;

  https.get(url, (res) => {
    res.on("data", () => {});
  }).on("error", (e) => {
    console.error("❌ Gagal kirim ke Telegram:", e);
  });
}

// Fungsi kirim transaksi ke 1 alamat
async function sendTx(toAddress) {
  const tx = {
    to: toAddress,
    value: ethers.parseEther(AMOUNT),
  };

  try {
    console.log(`🚀 Mengirim TX ke ${toAddress}...`);
    const txResponse = await wallet.sendTransaction(tx);
    console.log("✅ TX sent! Hash:", txResponse.hash);
    console.log(`🔗 Explorer: https://sepolia.tea.xyz/tx/${txResponse.hash}`);

    const msg = `
✅ *TX berhasil dikirim!*

📤 *To:* \`${toAddress}\`
💸 *Amount:* \`${AMOUNT} ETH\`
🔗 [View on Explorer](https://sepolia.tea.xyz/tx/${txResponse.hash})

⏳ Nunggu konfirmasi ya bestie...
    `.trim();
    sendTelegramMessage(msg);

    await txResponse.wait();
    console.log("✅ TX confirmed!");

    sendTelegramMessage(`✅ *TX confirmed!*\nHash: \`${txResponse.hash}\``);
  } catch (error) {
    console.error("❌ TX failed:", error);
    sendTelegramMessage(`❌ *TX gagal ke ${toAddress}!*\n\`\`\`\n${error.message || error}\n\`\`\``);
    console.log("⏳ Coba lagi dalam 1 menit...\n");
    await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
  }
}

// Loop kirim ke semua alamat, 1 per 1 dengan delay acak
async function loopTx() {
  while (true) {
    for (const address of TO_ADDRESSES) {
      await sendTx(address);
      const randomDelay = (Math.floor(Math.random() * 5) + 1) * 60 * 1000;
      console.log(`⏳ Delay ${(randomDelay / 60000).toFixed(1)} menit...\n`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }
  }
}

loopTx();
