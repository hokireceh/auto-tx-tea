const { ethers } = require("ethers");
const { RPC_URL, PRIVATE_KEY, TO_ADDRESSES } = require("./config");
const { sendTx } = require("./tx-utils");
const { sendTelegramMessage } = require("./telegram");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Fungsi delay acak dalam ms
function getRandomDelay(min = 30_000, max = 90_000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Dynamic import chalk
let chalk;
(async () => {
  chalk = await import("chalk");
})();

// Fungsi countdown mundur di terminal
async function waitWithCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const spinnerFrames = ["|", "/", "-", "\\"];
  const c = chalk.default;

  for (let i = totalSeconds; i >= 0; i--) {
    const frame = spinnerFrames[i % spinnerFrames.length];
    const timeStr = c.cyan(`${i}s`);
    const spinner = c.yellow(frame);
    process.stdout.write(`\r${spinner} ${c.green("Delay")} ${timeStr}...     `);
    await new Promise(r => setTimeout(r, 1000));
  }

  process.stdout.write("\n"); // biar rapi setelah countdown selesai
}

async function mainLoop() {
  while (true) {
    for (const address of TO_ADDRESSES) {
      try {
        await sendTx(wallet, provider, address);
      } catch (err) {
        console.error("❌ Error TX:", err);
        await sendTelegramMessage(`*Gagal kirim ke ${address}*\n\`\`\`\n${err.message || err}\n\`\`\``);
      }

      const delay = getRandomDelay();
      await waitWithCountdown(delay);
    }
  }
}

mainLoop();
