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

const MAX_RETRY = 3;
const WAIT_TIMEOUT = 90_000;

if (!RPC_URL || !PRIVATE_KEY || !TO_ADDRESSES.length || !AMOUNT || !BOT_TOKEN || !CHAT_ID) {
  console.error("❌ 𝙋𝙖𝙨𝙩𝙞𝙠𝙖𝙣 𝙨𝙚𝙢𝙪𝙖 𝙫𝙖𝙧𝙞𝙖𝙗𝙚𝙡 𝙙𝙞 .env 𝙨𝙪𝙙𝙖𝙝 𝙩𝙚𝙧𝙞𝙨𝙞!");
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
          reject("❌ 𝙂𝙖𝙜𝙖𝙡 𝙥𝙖𝙧𝙨𝙚 𝙧𝙚𝙨𝙥𝙤𝙣𝙨𝙚 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢 API");
        }
      });
    }).on("error", err => reject("❌ 𝙂𝙖𝙜𝙖𝙡 𝙠𝙞𝙧𝙞𝙢 𝙠𝙚 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢: " + err.message));
  });
}

function updateTelegramMessage(message, messageId) {
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText?chat_id=${CHAT_ID}&message_id=${messageId}&text=${text}&parse_mode=Markdown`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      res.on("data", () => {});
      res.on("end", () => resolve());
    }).on("error", err => reject("❌ 𝙂𝙖𝙜𝙖𝙡 𝙪𝙥𝙙𝙖𝙩𝙚 𝙥𝙚𝙨𝙖𝙣 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢: " + err.message));
  });
}

async function sendTx(toAddress) {
  const amount = ethers.parseEther(AMOUNT);
  const nonce = await wallet.getNonce();
  const fee = await provider.getFeeData();

  if (!fee.maxFeePerGas || !fee.maxPriorityFeePerGas) {
    await sendTelegramMessage(`*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝙂𝙖𝙜𝙖𝙡*
RPC 𝙩𝙞𝙙𝙖𝙠 𝙢𝙚𝙣𝙜𝙚𝙢𝙗𝙖𝙡𝙞𝙠𝙖𝙣 𝙛𝙚𝙚 𝙙𝙖𝙩𝙖 𝙮𝙖𝙣𝙜 𝙫𝙖𝙡𝙞𝙙.`);
    return;
  }

  let baseMaxFee = fee.maxFeePerGas;
  let basePriorityFee = fee.maxPriorityFeePerGas;

  let attempt = 0;
  let success = false;

  while (attempt <= MAX_RETRY && !success) {
    const factor = BigInt(2 ** attempt);
    const maxFeePerGas = baseMaxFee * factor;
    const maxPriorityFeePerGas = basePriorityFee * factor;

    const tx = {
      to: toAddress,
      value: amount,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };

    const label = attempt === 0 ? "𝙏𝙓 𝘼𝙬𝙖𝙡" : `𝙍𝙚𝙩𝙧𝙮 𝙠𝙚-${attempt}`;

    try {
      const txResp = await wallet.sendTransaction(tx);
      console.log(`🚀 ${label} 𝙙𝙞𝙠𝙞𝙧𝙞𝙢: ${txResp.hash}`);

      const sentMsg = await sendTelegramMessage(
        `*${label}*

` +
        `𝙏𝙤 : \`${toAddress}\`
` +
        `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} 𝕋𝔼𝔸\`

` +
        `𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞...`
      );

      const messageId = sentMsg?.message_id;
      if (!messageId) {
        console.warn("⚠️ 𝙏𝙞𝙙𝙖𝙠 𝙢𝙚𝙣𝙙𝙖𝙥𝙖𝙩𝙠𝙖𝙣 message_id 𝙙𝙖𝙧𝙞 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢!");
      }

      const loadingChars = ["◐", "◑", "◒", "◓"];
      let i = 0;
      let stopped = false;

      const interval = setInterval(async () => {
        if (stopped || !messageId) return;
        const anim = `*${label}*

*𝙈𝙚𝙣𝙪𝙣𝙜𝙜𝙪 𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞..* ${loadingChars[i]}`;
        try {
          await updateTelegramMessage(anim, messageId);
        } catch (err) {
          console.warn("⚠️ 𝙂𝙖𝙜𝙖𝙡 𝙪𝙥𝙙𝙖𝙩𝙚 𝙖𝙣𝙞𝙢𝙖𝙨𝙞 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢:", err.message);
        }
        i = (i + 1) % loadingChars.length;
      }, 500);

      await Promise.race([
        txResp.wait(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout konfirmasi")), WAIT_TIMEOUT)),
      ]);

      clearInterval(interval);
      stopped = true;
      success = true;

      const successMsg =
        `*${label} 𝘽𝙚𝙧𝙝𝙖𝙨𝙞𝙡*

` +
        `𝙏𝙤 : \`${toAddress}\`
` +
        `𝘼𝙢𝙤𝙪𝙣𝙩 : \`${AMOUNT} 𝕋𝔼𝔸\`

` +
        `[𝙇𝙞𝙝𝙖𝙩 𝙙𝙞 𝙀𝙭𝙥𝙡𝙤𝙧𝙚𝙧](${EXPLORER_URL}/tx/${txResp.hash})`;

      if (messageId) {
        try {
          await updateTelegramMessage(successMsg, messageId);
        } catch (err) {
          console.warn("⚠️ 𝙂𝙖𝙜𝙖𝙡 𝙪𝙥𝙙𝙖𝙩𝙚 𝙠𝙚 𝙨𝙩𝙖𝙩𝙪𝙨 𝙨𝙪𝙠𝙨𝙚𝙨:", err.message);
          await sendTelegramMessage(successMsg);
        }
      } else {
        await sendTelegramMessage(successMsg);
      }

      console.log(`✅ ${label} 𝙙𝙞𝙠𝙤𝙣𝙛𝙞𝙧𝙢𝙖𝙨𝙞`);
    } catch (err) {
      if (err.message.includes("Timeout konfirmasi")) {
        console.warn(`⏱ ${label} 𝙩𝙞𝙢𝙚𝙤𝙪𝙩. 𝘼𝙠𝙖𝙣 𝙢𝙚𝙣𝙘𝙤𝙗𝙖 𝙧𝙚𝙩𝙧𝙮...`);
      } else {
        await sendTelegramMessage(`*${label} 𝙂𝙖𝙜𝙖𝙡*
\`\`\`
${err.message || err}
\`\`\``);
        break;
      }
    }

    attempt++;
    if (!success && attempt <= MAX_RETRY) {
      await sendTelegramMessage(`*⏳ 𝙍𝙚𝙩𝙧𝙮 ${attempt}...* 𝙙𝙚𝙣𝙜𝙖𝙣 𝙜𝙖𝙨 𝙛𝙚𝙚 𝙡𝙚𝙗𝙞𝙝 𝙩𝙞𝙣𝙜𝙜𝙞`);
    }
  }

  if (!success) {
    await sendTelegramMessage(`*𝙏𝙧𝙖𝙣𝙨𝙖𝙠𝙨𝙞 𝙠𝙚 ${toAddress} 𝙜𝙖𝙜𝙖𝙡 𝙨𝙚𝙩𝙚𝙡𝙖𝙝 ${MAX_RETRY} 𝙧𝙚𝙩𝙧𝙮.* ❌`);
    console.log(`❌ 𝙂𝙖𝙜𝙖𝙡 𝙨𝙚𝙩𝙚𝙡𝙖𝙝 ${MAX_RETRY} 𝙖𝙩𝙩𝙚𝙢𝙥𝙩`);
    await new Promise(r => setTimeout(r, 60000));
  }
}

async function loopTx() {
  while (true) {
    for (const address of TO_ADDRESSES) {
      try {
        await sendTx(address);
      } catch (e) {
        console.error("❌ 𝙂𝙖𝙜𝙖𝙡 𝙠𝙞𝙧𝙞𝙢 TX:", e);
      }

      const delay = (Math.floor(Math.random() * 3) + 1) * 60 * 1000;
      console.log(`⏳ 𝘿𝙚𝙡𝙖𝙮 ${(delay / 60000).toFixed(1)} 𝙢𝙚𝙣𝙞𝙩...\n`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

loopTx();
