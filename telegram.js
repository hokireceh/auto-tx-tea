const https = require("https");
const { BOT_TOKEN, CHAT_ID } = require("./config");

function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const text = encodeURIComponent(message);
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=Markdown`;

    https.get(url, res => {
      let data = '';
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (!json.ok && json.error_code === 429) {
            const retryAfter = json.parameters?.retry_after || 30;
            console.warn(`⏱ Terkena rate-limit Telegram. Tunggu ${retryAfter} detik...`);
            return setTimeout(() => {
              sendTelegramMessage(message).then(resolve).catch(reject);
            }, retryAfter * 1000);
          }

          if (!json.ok) return reject("❌ Gagal kirim pesan Telegram: " + json.description);

          resolve(json.result);
        } catch {
          reject("❌ Gagal parse response Telegram API");
        }
      });
    }).on("error", err => reject("❌ Gagal kirim ke Telegram: " + err.message));
  });
}

function updateTelegramMessage(message, messageId) {
  return new Promise((resolve, reject) => {
    const text = encodeURIComponent(message);
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText?chat_id=${CHAT_ID}&message_id=${messageId}&text=${text}&parse_mode=Markdown`;

    https.get(url, res => {
      let data = '';
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (!json.ok && json.error_code === 429) {
            const retryAfter = json.parameters?.retry_after || 30;
            console.warn(`⏱ Rate-limit saat update pesan Telegram. Tunggu ${retryAfter} detik...`);
            return setTimeout(() => {
              updateTelegramMessage(message, messageId).then(resolve).catch(reject);
            }, retryAfter * 1000);
          }

          if (!json.ok) return reject("❌ Gagal update pesan Telegram: " + json.description);

          resolve();
        } catch {
          reject("❌ Gagal parse response saat update Telegram");
        }
      });
    }).on("error", err => reject("❌ Gagal update pesan Telegram: " + err.message));
  });
}

module.exports = { sendTelegramMessage, updateTelegramMessage };
