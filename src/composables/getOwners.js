//@ts-check
import { ethers } from 'ethers';
import safeABI from './SafeABI.json';

let provider = null;
let safe = null;

// ========== MAIN FUNCTION ==========
export async function getSignersFromSafeTx(txHash) {
  console.log("getSignersFromSafeTx - txHash=" + txHash);
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  const block = await provider.getBlock(receipt.blockNumber);
  const nonce = await safe.nonce({ blockTag: block.number - 1 });
  const iface = new ethers.utils.Interface(safeABI);
  const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });

  const {
    to, value, data, operation,
    safeTxGas, baseGas, gasPrice,
    gasToken, refundReceiver,
    signatures
  } = parsedTx.args;
  console.log("getSignersFromSafeTx - [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, signatures]=" + [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, signatures]);

  const txHashToSign = await safe.getTransactionHash(
    to, value.toNumber(), data, operation,
    safeTxGas.toNumber(), baseGas.toNumber(), gasPrice.toNumber(),
    gasToken, refundReceiver, nonce.toNumber()
  );

  return parseSafeSignatures(signatures, txHashToSign);
}
export function initOwnerRetriever(safeAddress, _provider) {
  provider = _provider;
  safe = new ethers.Contract(safeAddress, safeABI, provider);
}

// ========== SIGNATURE PARSING ==========
function parseSafeSignatures(signatures, txHashToSign) {
  console.log("parseSafeSignatures - txHashToSign=" + txHashToSign + ", signatures=" + signatures);
  const sigs = ethers.utils.arrayify(signatures);
  const signers = [];

  for (let i = 0; i < sigs.length; i += 65) {
    const r = sigs.slice(i, i + 32);
    const s = sigs.slice(i + 32, i + 64);
    let v = sigs[i + 64];
    console.log("parseSafeSignatures - [i, v]=" + [i, v]);

    // Check if it's a contract signature
    if (v === 0) {
      // Contract signatures (v=0) are followed by a dynamic byte array, need custom parsing
      // Just extract the signer from r (last 20 bytes of r)
      const signer = ethers.utils.getAddress(ethers.utils.hexDataSlice(r, 12));
      signers.push({ signer, type: 'contract-signature' });
      continue;
    }

    // Approved hash (e.g. via eth_signTypedData and pre-approval)
    if (v === 1) {
      const signer = ethers.utils.getAddress(ethers.utils.hexDataSlice(r, 12));
      signers.push({ signer, type: 'approved-hash' });
      continue;
    }

    // eth_sign signatures: v > 30
    if (v > 30) {
      v -= 4;
      const sig = ethers.utils.splitSignature({
        r: ethers.utils.hexlify(r),
        s: ethers.utils.hexlify(s),
        v,
      });
      const signer = ethers.utils.recoverAddress(ethers.utils.hashMessage(ethers.utils.arrayify(txHashToSign)), sig);
      signers.push({ signer, type: 'eth_sign' });
      continue;
    }

    // EIP-712 signatures (v == 27 or 28)
    if (v === 27 || v === 28) {
      const sig = ethers.utils.splitSignature({
        r: ethers.utils.hexlify(r),
        s: ethers.utils.hexlify(s),
        v,
      });
      const signer = ethers.utils.recoverAddress(txHashToSign, sig);
      signers.push({ signer, type: 'eip-712' });
      continue;
    }

    // Unknown or unsupported type
    signers.push({ signer: null, type: 'unknown', rawV: v });
  }

  return signers;
}
