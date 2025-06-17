// @ts-check
import { ethers } from 'ethers';
import Safe from '@safe-global/protocol-kit';

export async function createTransaction(safeAddress, to, value, data = "0x", owners) {
  const {safeSdk, signer} = await getSafeSdk(safeAddress, owners);
  let safeTx = await safeSdk.createTransaction({ transactions: [{ to, value: ethers.utils.parseEther(value.toString()).toString(), data}] });
  safeTx = await safeSdk.signTransaction(safeTx);
  return {safeTx, signer};
}
export async function collectSignature(safeAddress, owners, safeTx) {
  const {safeSdk, signer} = await getSafeSdk(safeAddress, owners, safeTx);
  safeTx = await safeSdk.signTransaction(safeTx);
  return {safeTx, signer};
}
export async function executeTransaction(safeAddress, safeTx) {
  await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }]})   // To let the user choose the current account
  const {safeSdk} = await getSafeSdk(safeAddress);
  const execTxResponse = await safeSdk.executeTransaction(safeTx);
  return execTxResponse.transactionResponse?.wait();
}
async function getSafeSdk(safeAddress, owners, safeTx) {
  if(!window.ethereum)
    throw new Error("No build-in provider found, please install MetaMask or another wallet provider");
  let accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
  if(!accounts || accounts.length === 0)
    throw new Error("No accounts found, please connect your wallet");
  if(owners && owners.findIndex(o => o.toLowerCase()==accounts[0])==-1 || safeTx && safeTx.signatures.has(accounts[0].toLowerCase())) {
    console.log("current account is either not an owner or has already signed, trying to connect to another account");
    const permissions = await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }]})
    console.log("permissions=", permissions);
    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if(owners && owners.findIndex(o => o.toLowerCase()==accounts[0])==-1)
      throw new Error("This account is not an owner");
    if(safeTx && safeTx.signatures.has(accounts[0].toLowerCase()))
      throw new Error("This owner has already signed the transaction");
  }
  const signer = accounts[0];
  
  console.log("accounts:", accounts);
  console.log("Using signer address:", signer);

  const safeSdk = await Safe.init({ provider: window.ethereum, signer, safeAddress });
  return {safeSdk, signer};
}

/* Listen for manual account changes in the MetaMask UI as well */
window.ethereum.on('accountsChanged', accounts => {
  console.log('User picked a different account', accounts);
  // Optionally update UI or re-enable the “Sign” button
})