require("dotenv").config();
const { ethers } = require("ethers");
const https = require("https");

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TO_ADDRESSES = process.env.TO_ADDRESSES?.split(",").map(addr => addr.trim()) || [];
const AMOUNT = process.env.AMOUNT;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!RPC_URL || !PRIVATE_KEY || !TO_ADDRESSES.length || !AMOUNT || !BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Pastikan semua variabel di .env sudah terisi!");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

let loadingMessageId = null; // Variabel untuk menyimpan ID pesan loading

function sendTelegramMessage(message) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=Markdown`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          resolve(response.result);
        } catch (e) {
          reject("❌ Gagal parse response Telegram API");
        }
      });
    }).on("error", (e) => {
      reject("❌ Gagal kirim ke Telegram: " + e.message);
    });
  });
}

function updateTelegramMessage(message) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText?chat_id=${CHAT_ID}&message_id=${loadingMessageId}&text=${text}&parse_mode=Markdown`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve());
    }).on("error", (e) => reject("❌ Gagal update pesan di Telegram: " + e.message));
  });
}

async function sendTx(toAddress) {
  const amountInEth = ethers.parseEther(AMOUNT);
  const nonce = await wallet.getNonce();
  const feeData = await provider.getFeeData();

  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    const err = "RPC tidak mengembalikan fee data yang valid.";
    console.error("❌", err);
    sendTelegramMessage(`*Transaksi Gagal*\n${err}`);
    return;
  }

  let maxFeePerGas = feeData.maxFeePerGas;
  let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

  const tx = {
    to: toAddress,
    value: amountInEth,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };

  try {
    console.log(`🚀 Mengirim TX ke ${toAddress}...`);
    const txResponse = await wallet.sendTransaction(tx);
    console.log("✅ TX sent! Hash:", txResponse.hash);

    // Kirim pesan pertama dan simpan message_id
    let loadingMessage = `*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘿𝙞𝙠𝙞𝙧𝙞𝙢*\n\n` +
                          `𝙏𝙤 : \`${toAddress}\`\n` +
                          `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} ETH\`\n\n` +
                          `𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞...`;

    const sentMessage = await sendTelegramMessage(loadingMessage);
    loadingMessageId = sentMessage.message_id;

    let loadingChars = ["◐", "◑", "◒", "◓"];
    let idx = 0;

    // Update animasi "𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞..." setiap setengah detik
    const interval = setInterval(async () => {
      const animation = `*𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞..* ${loadingChars[idx]}`;
      await updateTelegramMessage(animation);
      idx = (idx + 1) % loadingChars.length;
    }, 500); // Update setiap setengah detik

    // Tunggu transaksi dikonfirmasi
    await txResponse.wait();
    console.log("✅ TX confirmed!");

    // Hentikan animasi dan update pesan
    clearInterval(interval);

    const confirmationMessage = `*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘿𝙞𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞*\n\n` +
                                `𝙏𝙤: \`${toAddress}\`\n` +
                                `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} ETH\`\n\n` +
                                `𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝘽𝙚𝙧𝙝𝙖𝙨𝙞𝙡 𝘿𝙞𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞 🎉\n` +
                                `[𝙇𝙞𝙝𝙖𝙩 𝙙𝙞 𝙀𝙭𝙥𝙡𝙤𝙧𝙚𝙧](https://sepolia.tea.xyz/tx/${txResponse.hash})`;

    await updateTelegramMessage(confirmationMessage);

  } catch (error) {
    const errMsg = error.message || JSON.stringify(error);

    if (
      error.code === "CALL_EXCEPTION" &&
      error.info?.error?.message?.includes("max fee per gas less than block base fee")
    ) {
      console.warn("⚠️ Gas fee terlalu rendah, mencoba ulang...");

      maxFeePerGas *= 2n;
      maxPriorityFeePerGas *= 2n;

      const retryTx = {
        to: toAddress,
        value: amountInEth,
        nonce,
        maxFeePerGas,
        maxPriorityFeePerGas,
      };

      try {
        const retryResponse = await wallet.sendTransaction(retryTx);
        console.log("♻️ TX retried! Hash:", retryResponse.hash);
        sendTelegramMessage(
          `*Transaksi Diulang dan Berhasil*\n` +
          `[Lihat di Explorer](https://sepolia.tea.xyz/tx/${retryResponse.hash})`
        );
        await retryResponse.wait();
        console.log("✅ TX confirmed setelah retry!");
        sendTelegramMessage(
          `*Transaksi Dikonfirmasi Setelah Retry*\n` +
          `[Lihat di Explorer](https://sepolia.tea.xyz/tx/${retryResponse.hash})`
        );
      } catch (retryError) {
        console.error("❌ Retry gagal:", retryError.message || retryError);
        sendTelegramMessage(
          `*Transaksi Retry Gagal*\n` +
          `\`\`\`\n${retryError.message || retryError}\n\`\`\``);
      }
    } else {
      console.error("❌ TX failed:", errMsg);
      sendTelegramMessage(
        `*Transaksi Gagal ke ${toAddress}*\n` +
        `\`\`\`\n${errMsg}\n\`\`\``);
    }

    console.log("⏳ Coba lagi dalam 1 menit...\n");
    await new Promise(resolve => setTimeout(resolve, 60 * 1000));
  }
}

async function loopTx() {
  while (true) {
    for (const address of TO_ADDRESSES) {
      await sendTx(address);
      const randomDelay = (Math.floor(Math.random() * 5) + 1) * 60 * 1000;
      console.log(`⏳ Delay ${(randomDelay / 60000).toFixed(1)} menit...\n`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
    }
  }
}

loopTx();
