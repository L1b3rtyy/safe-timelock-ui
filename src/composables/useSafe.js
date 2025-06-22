// @ts-check
import { ethers } from 'ethers';
import guardABI from './TimelockGuardABI.json';
import safeABI from './SafeABI.json';
import ProxyAdminABI from './ProxyAdminABI.json';
import ProxyABI from './ProxyABI.json';
import SafeAppsSDK from '@safe-global/safe-apps-sdk';

let guardAddress = null;
let safeAddress = null;
let provider = null;
let guardContract = null;
let safeContract = null;
let queueCallback = null;
export const zeroAddress = '0x0000000000000000000000000000000000000000';

const sdk = new SafeAppsSDK({ allowedDomains: [/app\.safe\.global$/] });
export const STATES = {QUEUED: 0, CANCELED: 1, EXECUTED: 2, CLEARED: 3};
const EVENT_NAMES = {
  QUEUED: "TransactionQueued",
  CANCELED: "TransactionCanceled",
  CLEARED: "TransactionCleared",
  CLEARED_HASHES: "TransactionsCleared",
  EXECUTED: "TransactionExecuted"
}
export const SAFE_EVENT_NAMES = {
  CHANGED_GUARD: "ChangedGuard",
  ADDED_OWNER: "AddedOwner",
  CHANGED_THRESHOLD: "ChangedThreshold",
  REMOVED_OWNER: "RemovedOwner"
}
export const EVENT_NAMES_PROXY = {
  ADMIN_CHANGED: "AdminChanged",
  UPGRADED: "Upgraded",
  OWNERSHIP_TRANSFERRED: "OwnershipTransferred",
}
let contractOldGuard = null;
export function defineListenersGuard(transactions, configCallback, updateLastQueueTime) {
  if(guardContract) {
    if(contractOldGuard)
      contractOldGuard.removeAllListeners();
    Object.values(EVENT_NAMES).forEach(eventName => guardContract.on(eventName, (...args) => eventListener(transactions, ...args).then(eventData => updateLastQueueTime(eventData))));
    guardContract.on("TimelockConfigChanged", () => loadConfig().then(timelockConfig => configCallback(timelockConfig)));
    contractOldGuard = guardContract;
  }
}
export function defineListenersSafe(callback) {
  if(safeContract)
    Object.values(SAFE_EVENT_NAMES).forEach(eventName => safeContract.on(eventName, (...args) => callback(...args)));
}
export async function initSafe(_queueCallback) {
  console.log("initSafe - Set a timeout explicitly to avoid indefinite hangs, rejects after 3sec");
  queueCallback = _queueCallback;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout, not running inside Safe?')), 3000));
  const chainInfoPromise = sdk.safe.getChainInfo();
  const safeInfo = await Promise.race([sdk.safe.getInfo(), timeout]);
  console.log("initSafe - safeInfo=", safeInfo);
  safeAddress = safeInfo.safeAddress;
  guardAddress = safeInfo.guard;
  if(window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    safeContract = new ethers.Contract(safeAddress, safeABI, provider);
    if(safeInfo.guard)
      guardContract = new ethers.Contract(guardAddress, guardABI, provider);
  }
  return {threshold: safeInfo.threshold, owners: safeInfo.owners, network: safeInfo.network, chainId: safeInfo.chainId, chainInfoPromise, version: safeInfo.version, guardAddress: safeInfo.guard, safeAddress, buildInProvider: Boolean(window.ethereum)};
}
function getEventTime(event) {
  return provider && provider.getBlock(event.blockNumber).then(block => block.timestamp);
}
export async function executeTransaction(to, value, data) {
  console.log("executeTransaction - [to, value, data]=" + [to, value, data]);
  const txs = await sdk.txs.send({txs: [{ to, value: ethers.utils.parseEther(value).toString(), data}]} );
  return txs.safeTxHash;
}
export function buildTxData(moduleAbi, functionName, args) {
  console.log("buildTxData - [moduleAbi, functionName]=" + [moduleAbi, functionName]);
  const iface = new ethers.utils.Interface([moduleAbi]);
  console.log("buildTxData - create data");
  return iface.encodeFunctionData(functionName, args);
}
function executeTransactionHelper(to, moduleAbi, functionName, args) {
  console.log("executeTransaction - [functionName, args]=" + [functionName, args]);
  return executeTransaction(to, '0', buildTxData(moduleAbi, functionName, args))
}
async function loadConfig() {
  console.log("loadConfig - guardContract=" + Boolean(guardContract));
  if(!guardContract) return null;
  return Promise.all([guardContract.timelockConfig(), guardContract.quorumCancel().catch(()=>0), guardContract.quorumExecute().catch(()=>0)])
  .then(([timelockConfig, quorumCancel, quorumExecute]) => ({
    throttle: timelockConfig.throttle.toNumber(),
    limitNoTimelock: ethers.utils.formatEther(timelockConfig.limitNoTimelock),
    timelockDuration: timelockConfig.timelockDuration.toNumber(),
    quorumCancel,
    quorumExecute
  }))
}
export async function setConfig(timelockDuration, throttle, limitNoTimelock, quorumCancel, quorumExecute, clearHashes) {
  console.log("setConfig - [timelockDuration, throttle, limitNoTimelock, quorumCancel, quorumExecute, clearHashes]=" + [timelockDuration, throttle, limitNoTimelock, quorumCancel, quorumExecute, clearHashes]);
  return queueTransactionHelper(guardAddress, '0', 'function setConfig(uint64 timelockDuration, uint64 throttle, uint128 limitNoTimelock, uint8 _quorumCancel, uint8 _quorumExecute, bytes32[] clearHashes)',
    "setConfig", [timelockDuration, throttle, ethers.utils.parseEther(limitNoTimelock.toString()).toString(), quorumCancel, quorumExecute, clearHashes || []])
}
function queueTransactionHelper(to, value, abi, functionName, args) {
  const rawData = [to, value, buildTxData(abi, functionName, args)];
  if(!queueCallback(...rawData))
    return queueTransaction(...rawData);
  else
    return false;
}
export function queueTransaction(to, value, data) {
  return executeTransactionHelper(guardAddress, 'function queueTransaction(address to, uint256 value, bytes calldata data, uint8 operation)', "queueTransaction", [to, ethers.utils.parseEther(value.toString()).toString(), data, 0])
}
export function cancelTransaction(txHash, timestampPos, timestamp) {
  return executeTransactionHelper(guardAddress, 'function cancelTransaction(bytes32 txHash, uint256 timestampPos, uint256 timestamp)', "cancelTransaction", [txHash, timestampPos, timestamp])
}
export async function setGuard(existingTimelockGuard, mewGuardAddress) {
  console.log("setGuard - [existingTimelockGuard, mewGuardAddress]=" + [existingTimelockGuard, mewGuardAddress]);
  if(mewGuardAddress!==undefined) {
    if(!ethers.utils.isAddress(mewGuardAddress))
      throw new Error("invalid guard address");
    const contractNewGuard = new ethers.Contract(mewGuardAddress, guardABI, provider);
    await contractNewGuard.safe()
    .then(safe => {
      if(safe != safeAddress)
        throw new Error("The new guard is not pointing to the Safe contract (points to " + safe + ")");
    })
    .catch(e => {
      console.error("setGuard - error checking new guard address", e);
      throw new Error("Could not retrieve the safe the new guard is pointing to");
    });
  }
  const safeAbi = 'function setGuard(address guard)'
  const functionName = "setGuard";
  const args = [mewGuardAddress || zeroAddress];
  if(existingTimelockGuard)
    return queueTransactionHelper(safeAddress, '0', safeAbi, functionName, args)
  else
    return executeTransactionHelper(safeAddress, safeAbi, functionName, args);
}
export async function removeOwner(prevOwner, owner, threshold) {
  return queueTransactionHelper(safeAddress, '0', "function removeOwner(address prevOwner, address owner, uint256 _threshold)", "removeOwner", [prevOwner === null ? "0x0000000000000000000000000000000000000001" : prevOwner, owner, threshold])
}
export async function upgradeGuard(guardProxyAdmin, guardProxy, newGuardImp) {
  console.log("upgradeGuard - newGuardImp=" + newGuardImp);
  return queueTransactionHelper(guardProxyAdmin, '0', 'function upgrade(address proxy, address implementation)', "upgrade", [guardProxy, newGuardImp])
}
export async function setProvider(providerURL) {
  console.log("setProvider - providerURL=" + providerURL);
  provider =  new ethers.providers.JsonRpcProvider(providerURL);
  safeContract = new ethers.Contract(safeAddress, safeABI, provider);
  return provider.getNetwork();
}
export function loadGuardData(_guardAddress, eventListenerProxy) {
  console.log("loadGuardData - guardAddress=" + _guardAddress);
  guardAddress = _guardAddress;
  if(guardAddress && provider) {
    console.log("loadGuardData - calling backend");
    if(_guardAddress != guardAddress) {
      guardAddress = _guardAddress;
      guardContract = new ethers.Contract(guardAddress, guardABI, provider);
    }
    return {p_tx: loadTransactions(), p_version: getGuardVersion(), p_safe: guardContract.safe(), p_config: loadConfig(), p_proxy: getProxyDetails(guardAddress, eventListenerProxy)};
  }
  guardAddress = _guardAddress;
  return null;
}
export async function getGuardVersion() {
  if(!guardContract) return null;
  return Promise.all([guardContract.VERSION(), guardContract.TESTED_SAFE_VERSIONS()]);
}
let contractsOldProxy = null;
export async function getProxyDetails(proxyAddress, eventListenerProxy) {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

  const [implRaw, adminRaw] = await Promise.all([provider.getStorageAt(proxyAddress, implSlot),provider.getStorageAt(proxyAddress, adminSlot)]);
  
  const implAdd = `0x${implRaw.slice(-40)}`;
  const adminAdd = `0x${adminRaw.slice(-40)}`;

  console.log("getProxyDetails - [implAdd, adminAdd]=" + [implAdd, adminAdd]);

  const isProxy = implAdd !== zeroAddress;
  const isTransparent = adminAdd !== zeroAddress;

  if (isProxy && isTransparent) {
    console.log("getProxyDetails - ✅ This is a Transparent Proxy");
    const proxy = {imp: ethers.utils.getAddress(implAdd), admin: ethers.utils.getAddress(adminAdd)};
    const contractProxy = new ethers.Contract(proxyAddress, ProxyABI, provider);
    const contractProxyAdmin = new ethers.Contract(proxy.admin, ProxyAdminABI, provider);

    if(contractsOldProxy)
      contractsOldProxy.forEach(c => c.removeAllListeners());
    contractsOldProxy = [contractProxy, contractProxyAdmin];
    contractProxy.on(EVENT_NAMES_PROXY.ADMIN_CHANGED, (previousAdmin, newAdmin) => eventListenerProxy(EVENT_NAMES_PROXY.ADMIN_CHANGED, previousAdmin, newAdmin));
    contractProxy.on(EVENT_NAMES_PROXY.UPGRADED, implementation => eventListenerProxy(EVENT_NAMES_PROXY.UPGRADED, implementation));    
    contractProxyAdmin.on(EVENT_NAMES_PROXY.OWNERSHIP_TRANSFERRED, (previousOwner, newOwner) => eventListenerProxy(EVENT_NAMES_PROXY.OWNERSHIP_TRANSFERRED, previousOwner, newOwner))

    const [admin, imp, owner] = await Promise.all([
      contractProxyAdmin.getProxyAdmin(proxyAddress),
      contractProxyAdmin.getProxyImplementation(proxyAddress),
      contractProxyAdmin.owner()]);
    return {proxy, admin: {imp, admin, owner}};
  }
  if (isProxy)
    console.log("getProxyDetails - ⚠️ Proxy detected, but admin slot is missing — may be UUPS or custom proxy.");
  else
    console.log("getProxyDetails - ❌ This is not a recognized proxy contract.");
  return null;
}
async function loadTransactions() {
  console.log("loadTransactions - retrieve all active transactions");

  if(!guardContract)
    return [];
  const eventsDataByName = await Promise.all(Object.values(EVENT_NAMES).map(eventName => guardContract.queryFilter(guardContract.filters[eventName]()).then(events => Promise.all(events.map(e => e && e.args && transactionBuilder(e))))));
  const eventsData = eventsDataByName.flat().sort((a,b) => a.actionDate-b.actionDate);
  console.log("loadTransactions - #eventsData=" + eventsData.length);

  let res = [];
  for(const eventData of eventsData)
    processEvent(res, eventData);
  return res;
}
function getTransactionData(event) {
  switch(event.event) {
    case EVENT_NAMES.QUEUED:
      return getQueueTxData(event);
    case EVENT_NAMES.CLEARED_HASHES:
      return getSetConfigTxData(event);
    case EVENT_NAMES.CANCELED:
      return geCancelTxData(event);
    default:
      console.warn("getTransactionData - unknown event=" + event.event);
      return Promise.resolve({});
  }
}
function _getTransactionData(event, abi, functionName) {
  return provider.getTransaction(event.transactionHash)
  .then(trans => {  
    const iface_safe = new ethers.utils.Interface(['function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures)'])
    const safeTx = iface_safe.decodeFunctionData('execTransaction', trans.data);
    const iface_guard = new ethers.utils.Interface([abi])
    return iface_guard.decodeFunctionData(functionName, safeTx.data);
  })
}
function getQueueTxData(event) {
  return _getTransactionData(event, 'function queueTransaction(address to, uint256 value, bytes calldata data, uint8 operation)', 'queueTransaction')
  .then(guardTx => ({
    to: guardTx.to,
    value:  ethers.utils.formatEther(guardTx.value),
    data: guardTx.data,
    operation: guardTx.operation
  }));
}
function getSetConfigTxData(event) {
  return _getTransactionData(event, 'function setConfig(uint64 timelockDuration, uint64 throttle, uint128 limitNoTimelock, uint8 _quorumCancel, uint8 _quorumExecute, bytes32[] clearHashes)', 'setConfig')
  .then(guardTx => ({ clearHashes: guardTx.clearHashes }));
}
function geCancelTxData(event) {
  return _getTransactionData(event, 'function cancelTransaction(bytes32 txHash, uint256 timestampPos, uint256 timestamp)', 'cancelTransaction')
  .then(guardTx => ({ txHash: guardTx.txHash, timestamp: guardTx.timestamp.toNumber() }));
}
function processEvent(transactions, eventData) {
  console.log("processEvent - eventData=", eventData)
  switch(eventData.eventName) {
    case EVENT_NAMES.QUEUED:
      eventData.state = STATES.QUEUED;
      eventData.queueDate = eventData.actionDate; 
      eventData.queueHash = eventData.transactionHash; 
      transactions.push(eventData);
      break;
    case EVENT_NAMES.CANCELED:
    case EVENT_NAMES.EXECUTED:
      const transaction = transactions.find(e => e.state == STATES.QUEUED && e.txHash == eventData.txHash && e.actionDate == eventData.timestamp);
      if(!transaction)
        console.error("processEvent - inconsistent transaction, [txHash, timestamp]=" + [eventData.txHash, eventData.timestamp])
      else
        updateTransaction(transaction, eventData, (eventData.eventName == EVENT_NAMES.CANCELED ? STATES.CANCELED : STATES.EXECUTED));
      break;
    case EVENT_NAMES.CLEARED:
      for(const transaction of transactions)
        if(transaction.state == STATES.QUEUED && transaction.txHash == eventData.txHash)
            updateTransaction(transaction, eventData, STATES.CLEARED);
      break;
    case EVENT_NAMES.CLEARED_HASHES:
      for(const transaction of transactions)
        if(transaction.state == STATES.QUEUED && eventData.clearHashes.indexOf(transaction.txHash)!=-1)
            updateTransaction(transaction, eventData, STATES.CLEARED);
      break;
  }
}
function updateTransaction(transaction, eventData, state) {
  transaction.actionDate = eventData.actionDate;
  transaction.realHash = eventData.realHash;
  transaction.state = state;
}
function eventListener(transactions, ...args) {
  const event = args[args.length-1];
  console.log('eventListener - eventName=' + event.event);
  return transactionBuilder(event).then(eventData => {processEvent(transactions, eventData); return eventData;} );
}
function transactionBuilder(event) {
  console.log("transactionBuilder - hash=" + event.transactionHash);
  const p = getEventTime(event).then(actionDate => {
    const res = {eventName: event.event, realHash: event.transactionHash, actionDate, txHash: event.args.txHash};
    if("timestamp" in event.args)   res.timestamp = event.args.timestamp.toNumber();
    return res;
  })
  if(event.event == EVENT_NAMES.QUEUED || event.event == EVENT_NAMES.CLEARED_HASHES || event.event == EVENT_NAMES.CANCELED)
    return Promise.all([p, getTransactionData(event).catch(e => { console.error("getTransactionData", e); return { }; })])
    .then(([eventData, txData]) => ({...eventData, ...txData}));
  return p;
}
export async function getSignersFromSafeTx(txHash) {
  console.log("getSignersFromSafeTx - txHash=" + txHash);
  const tx = await provider.getTransaction(txHash);
  return Promise.all([getSignersFromSafeTx_Helper(tx), getQuorumsFromSafeTx(tx.blockNumber)])
  .then(([signersInfo, quorums])=>({signersInfo, quorums}));
}
function getQuorumsFromSafeTx(blockNumber) {
  return Promise.all([safeContract.getThreshold({ blockTag: blockNumber - 1 }),
    guardContract.quorumCancel({ blockTag: blockNumber - 1 }).catch(() => "?"),
    guardContract.quorumExecute({ blockTag: blockNumber - 1 }).catch(() => "?")])
  .then(([threshold, quorumCancel, quorumExecute])=>({threshold, quorumCancel, quorumExecute}));
}
async function getSignersFromSafeTx_Helper(tx) {
  const nonce = await safeContract.nonce({ blockTag: tx.blockNumber - 1 });
  const iface = new ethers.utils.Interface(safeABI);
  const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });

  const { to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures } = parsedTx.args;

  const txHashToSign = await safeContract.getTransactionHash(
    to, value.toNumber(), data, operation,
    safeTxGas.toNumber(), baseGas.toNumber(), gasPrice.toNumber(),
    gasToken, refundReceiver, nonce.toNumber()
  );

  return parseSafeSignatures(signatures, txHashToSign);
}
function parseSafeSignatures(signatures, txHashToSign) {
  console.log("parseSafeSignatures - txHashToSign=" + txHashToSign + ", signatures=" + signatures);
  const sigs = ethers.utils.arrayify(signatures);
  const signers = [];

  for (let i = 0; i < sigs.length; i += 65) {
    const r = sigs.slice(i, i + 32);
    const s = sigs.slice(i + 32, i + 64);
    let v = sigs[i + 64];

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