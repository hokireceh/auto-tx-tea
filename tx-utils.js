const { ethers } = require("ethers");
const {
  AMOUNT, MAX_RETRY, WAIT_TIMEOUT, EXPLORER_URL
} = require("./config");
const { sendTelegramMessage, updateTelegramMessage } = require("./telegram");

async function sendTx(wallet, provider, toAddress) {
  const amount = ethers.parseEther(AMOUNT);
  const nonce = await wallet.getNonce();
  const fee = await provider.getFeeData();

  if (!fee.maxFeePerGas || !fee.maxPriorityFeePerGas) {
    await sendTelegramMessage("*Transaksi Gagal*\nRPC tidak mengembalikan fee data.");
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

    const tx = { to: toAddress, value: amount, nonce, maxFeePerGas, maxPriorityFeePerGas };
    const label = attempt === 0 ? "TX Awal" : `Retry ke-${attempt}`;

    let interval; // <-- Tambahkan deklarasi interval di luar try

    try {
      const txResp = await wallet.sendTransaction(tx);
      console.log(`🚀 ${label} dikirim: ${txResp.hash}`);

      const sentMsg = await sendTelegramMessage(
        `*${label}*\n\nTo: \`${toAddress}\`\nAmount: \`${AMOUNT} TEA\`\n\nMenunggu konfirmasi...`
      );

      const messageId = sentMsg?.message_id;
      const loadingChars = ["◐", "◑", "◒", "◓"];
      let i = 0;
      let stopped = false;

      interval = setInterval(async () => {
        if (stopped || !messageId) return;
        try {
          await updateTelegramMessage(
            `*${label}*\n\n*Menunggu konfirmasi..* ${loadingChars[i]}`,
            messageId
          );
        } catch (err) {
          console.warn("❌ Gagal update pesan Telegram:", err.message || err);
        }
        i = (i + 1) % loadingChars.length;
      }, 3000);

      await Promise.race([
        txResp.wait(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout konfirmasi")), WAIT_TIMEOUT)),
      ]);

      clearInterval(interval);
      stopped = true;
      success = true;

      const remaining = await provider.getBalance(await wallet.getAddress());
      const formattedBalance = ethers.formatEther(remaining);

      const successMsg =
        `*${label} Berhasil*\n\n` +
        `To: \`${toAddress}\`\nAmount: \`${AMOUNT} TEA\`\n` +
        `💰 Sisa saldo: \`${formattedBalance} TEA\`\n\n` +
        `[Lihat di Explorer](${EXPLORER_URL}/tx/${txResp.hash})`;

      if (messageId) {
        try {
          await updateTelegramMessage(successMsg, messageId);
        } catch (err) {
          console.warn("❌ Gagal update pesan sukses:", err.message || err);
          await sendTelegramMessage(successMsg);
        }
      } else {
        await sendTelegramMessage(successMsg);
      }

      console.log(`✅ ${label} dikonfirmasi`);
    } catch (err) {
      if (interval) clearInterval(interval);

      if (err.message?.includes("Timeout konfirmasi")) {
        console.warn(`⏱ ${label} timeout. Retry...`);
      } else {
        await sendTelegramMessage(`*${label} Gagal*\n\n\`\`\`\n${err.message || err}\n\`\`\``);
        break;
      }
    }

    attempt++;

    if (!success && attempt <= MAX_RETRY) {
      await sendTelegramMessage(`*⏳ Retry ${attempt}...* dengan gas fee lebih tinggi`);
    }
  }

  if (!success) {
    await sendTelegramMessage(`*Transaksi ke ${toAddress} gagal setelah ${MAX_RETRY} retry.* ❌`);
    console.log(`❌ Gagal setelah ${MAX_RETRY} attempt`);
    await new Promise(r => setTimeout(r, 60_000));
  }
}

module.exports = { sendTx };
