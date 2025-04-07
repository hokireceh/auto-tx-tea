require("dotenv").config();
const { ethers } = require("ethers");
const https = require("https");

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TO_ADDRESSES = process.env.TO_ADDRESSES?.split(",").map(a => a.trim()) || [];
const AMOUNT = process.env.AMOUNT;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const EXPLORER_URL = process.env.EXPLORER_URL || "https://sepolia.tea.xyz";

if (!RPC_URL || !PRIVATE_KEY || !TO_ADDRESSES.length || !AMOUNT || !BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Pastikan semua variabel di .env sudah terisi!");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

function sendTelegramMessage(message) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=Markdown`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.result);
        } catch {
          reject("❌ Gagal parse response Telegram API");
        }
      });
    }).on("error", err => reject("❌ Gagal kirim ke Telegram: " + err.message));
  });
}

function updateTelegramMessage(message, messageId) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText?chat_id=${CHAT_ID}&message_id=${messageId}&text=${text}&parse_mode=Markdown`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      res.on("data", () => {});
      res.on("end", () => resolve());
    }).on("error", err => reject("❌ Gagal update pesan Telegram: " + err.message));
  });
}

async function sendTx(toAddress) {
  const amount = ethers.parseEther(AMOUNT);
  const nonce = await wallet.getNonce();
  const fee = await provider.getFeeData();

  if (!fee.maxFeePerGas || !fee.maxPriorityFeePerGas) {
    await sendTelegramMessage(`*Transaksi Gagal*\nRPC tidak mengembalikan fee data yang valid.`);
    return;
  }

  let maxFeePerGas = fee.maxFeePerGas;
  let maxPriorityFeePerGas = fee.maxPriorityFeePerGas;

  const tx = { to: toAddress, value: amount, nonce, maxFeePerGas, maxPriorityFeePerGas };

  try {
    console.log(`🚀 Mengirim TX ke ${toAddress}...`);
    const txResp = await wallet.sendTransaction(tx);
    console.log("✅ TX dikirim:", txResp.hash);

    const sentMsg = await sendTelegramMessage(
      `*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘿𝙞𝙠𝙞𝙧𝙞𝙢*\n\n` +
      `𝙏𝙤 : \`${toAddress}\`\n` +
      `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} ETH\`\n\n` +
      `𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞...`
    );

    const messageId = sentMsg.message_id;
    const loadingChars = ["◐", "◑", "◒", "◓"];
    let i = 0;
    let stopped = false;

    const interval = setInterval(async () => {
      if (stopped) return;
      const anim = `*𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞..* ${loadingChars[i]}`;
      try {
        await updateTelegramMessage(anim, messageId);
      } catch {}
      i = (i + 1) % loadingChars.length;
    }, 500);

    await txResp.wait();
    clearInterval(interval);
    stopped = true;
    console.log("✅ TX confirmed");

    await updateTelegramMessage(
      `*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘿𝙞𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞*\n\n` +
      `𝙏𝙤 : \`${toAddress}\`\n` +
      `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} ETH\`\n\n` +
      `𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘽𝙚𝙧𝙝𝙖𝙨𝙞𝙡 🎉\n` +
      `[𝙇𝙞𝙝𝙖𝙩 𝙙𝙞 𝙀𝙭𝙥𝙡𝙤𝙧𝙚𝙧](${EXPLORER_URL}/tx/${txResp.hash})`,
      messageId
    );

  } catch (err) {
    const errMsg = err.message || JSON.stringify(err);

    if (
      err.code === "CALL_EXCEPTION" &&
      err.info?.error?.message?.includes("max fee per gas less than block base fee")
    ) {
      console.warn("⚠️ Fee terlalu rendah, mencoba ulang...");

      maxFeePerGas *= 2n;
      maxPriorityFeePerGas *= 2n;

      try {
        const retryTx = {
          to: toAddress,
          value: amount,
          nonce,
          maxFeePerGas,
          maxPriorityFeePerGas,
        };

        const retryResp = await wallet.sendTransaction(retryTx);
        await sendTelegramMessage(`*Transaksi Ulang Terkirim*\n[Lihat Explorer](${EXPLORER_URL}/tx/${retryResp.hash})`);
        await retryResp.wait();
        await sendTelegramMessage(`*Transaksi Retry Dikonfirmasi*\n[Lihat Explorer](${EXPLORER_URL}/tx/${retryResp.hash})`);

      } catch (retryErr) {
        await sendTelegramMessage(`*Transaksi Retry Gagal*\n\`\`\`\n${retryErr.message || retryErr}\n\`\`\``);
      }

    } else {
      await sendTelegramMessage(`*Transaksi Gagal ke ${toAddress}*\n\`\`\`\n${errMsg}\n\`\`\``);
    }

    console.log("⏳ Delay 60 detik sebelum lanjut...\n");
    await new Promise(r => setTimeout(r, 60000));
  }
}

async function loopTx() {
  while (true) {
    for (const address of TO_ADDRESSES) {
      try {
        await sendTx(address);
      } catch (e) {
        console.error("❌ Gagal kirim TX:", e);
      }

      const delay = (Math.floor(Math.random() * 3) + 1) * 60 * 1000;
      console.log(`⏳ Delay ${(delay / 60000).toFixed(1)} menit...\n`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

loopTx();
