import { ethers } from 'ethers';

const EIP_1967_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const ETHERSCAN_API_URL = "https://api.etherscan.io/v2/api";  // https://docs.etherscan.io/etherscan-v2
const BLACKLIST_URL = 'https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json';

export const SEVERITY = {
  CRITICAL: 100,
  HIGH: 20,
  MEDIUM: 5,
  LOW: 1,
  INFO: 0,
};

// Fetch CryptoscamDB blacklist (cached)
let externalBlacklistCache = null;
let lastBlacklistFetch = 0;
const CACHE_TTL = 1000 * 60 * 60;
async function fetchExternalBlacklist() {
  if (externalBlacklistCache && Date.now() - lastBlacklistFetch < CACHE_TTL)
    return externalBlacklistCache;

  try {
    const res = await fetch(BLACKLIST_URL);
    const data = await res.json();
    const blacklisted = new Set(data.map(x => x.address.toLowerCase()));
    externalBlacklistCache = blacklisted;
    lastBlacklistFetch = Date.now();
    return blacklisted;
  }
  catch (err) {
    console.error('⚠️ Failed to fetch external blacklist:', err.message);
    return new Set();
  }
}

// Analyze an address and return list of alerts
async function checkAddressReputation(trustedAddresses, address, chainId, etherscanApiKey) {
  if(trustedAddresses.includes(address))
    return [{ level: SEVERITY.INFO, reason: 'Address is in trusted addresses list' }];
  const alerts = [];

  const blacklist = await fetchExternalBlacklist();
  if (blacklist.has(address))
    alerts.push({ level: SEVERITY.HIGH, reason: 'Address found in CryptoscamDB blacklist' });

  try {
    const txUrl = new URL(ETHERSCAN_API_URL);
    txUrl.searchParams.append('module', 'account');
    txUrl.searchParams.append('action', 'txlist');
    txUrl.searchParams.append('address', address);
    txUrl.searchParams.append('startblock', '0');
    txUrl.searchParams.append('endblock', '99999999');
    txUrl.searchParams.append('sort', 'asc');
    txUrl.searchParams.append('apikey', etherscanApiKey);
    txUrl.searchParams.append('chainid', chainId);

    const txRes = await fetch(txUrl);
    const txData = await txRes.json();
    const txs = txData.result || [];

    if (txs.length === 0)
      alerts.push({ level: SEVERITY.MEDIUM, reason: 'No transaction history' });
    else {
      const firstTx = txs[0];
      const ageDays = (Date.now() - parseInt(firstTx.timeStamp) * 1000) / (1000 * 60 * 60 * 24);
      if (ageDays < 7)
        alerts.push({ level: SEVERITY.MEDIUM, reason: `New address: created ${Math.round(ageDays)} days ago` });
      if (txs.length < 3)
        alerts.push({ level: SEVERITY.LOW, reason: 'Low transaction count (<3 txs)' });
    }

    const balUrl = new URL(ETHERSCAN_API_URL);
    balUrl.searchParams.append('module', 'account');
    balUrl.searchParams.append('action', 'balance');
    balUrl.searchParams.append('address', address);
    balUrl.searchParams.append('tag', 'latest');
    balUrl.searchParams.append('apikey', etherscanApiKey);
    balUrl.searchParams.append('chainid', chainId);

    const balRes = await fetch(balUrl);
    const balData = await balRes.json();
    if (parseFloat(balData.result) === 0)
      alerts.push({ level: SEVERITY.MEDIUM, reason: 'Zero ETH balance' });
  }
  catch (err) {
    console.error('API error during address analysis:', err.message);
    alerts.push({ level: SEVERITY.HIGH, reason: 'Error during address analysis' });
  }

  return alerts;
}

// Fetch ABI from Etherscan
async function fetchAbiFromEtherscan(address, chainId, etherscanApiKey) {
  const url = `${ETHERSCAN_API_URL}?module=contract&action=getabi&chainid=${chainId}&address=${address}&apikey=${etherscanApiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== '1') throw new Error(`Etherscan ABI error: ${json.result}`);
  return JSON.parse(json.result);
}

// Read implementation address from EIP-1967 slot
async function resolveImplementationAddressHelper(provider, proxyAddress, slot) {
  const rawStorage = await provider.getStorageAt(proxyAddress, slot);
  const implHex = '0x' + rawStorage.slice(-40); // last 20 bytes

  if (!ethers.utils.isAddress(implHex) || implHex === ethers.constants.AddressZero) 
    return null;

  return ethers.utils.getAddress(implHex); // checksummed
}

async function resolveImplementationAddress(provider, contractAddress) {
  return await resolveImplementationAddressHelper(provider, contractAddress, EIP_1967_SLOT)   // Try EIP-1967 (OpenZeppelin-style)
    || await resolveImplementationAddressHelper(provider, contractAddress, '0x0');            // Try Gnosis Safe pattern
}

// Attempt to decode calldata using the given ABI
function tryDecodeCalldata(abi, data) {
  try {
    const iface = new ethers.utils.Interface(abi);
    return iface.parseTransaction({ data });
  } catch (e) {
    return null;
  }
}

// MAIN FUNCTION: decode calldata using proxy + implementation fallback
async function decodeTxCalldata(toAddress, data, chainId, etherscanApiKey, provider) {
  console.log("decodeTxCalldata - Step 1: Try with proxy ABI - toAddress=" + toAddress);
  let proxyAbi, parsed, e1;
  try {
    proxyAbi = await fetchAbiFromEtherscan(toAddress, chainId, etherscanApiKey);
    parsed = tryDecodeCalldata(proxyAbi, data);
    if (parsed) {
      console.log("decodeTxCalldata - Step 1 match");
      return parsed;
    }
  } catch (e) {
    e1 = e;
  }

  console.log("decodeTxCalldata - Step 2: Try with implementation ABI (EIP-1967) - toAddress=" + toAddress);
  try {
    const impl = provider && await resolveImplementationAddress(provider, toAddress);
    if (!impl) {
      console.error("decodeTxCalldata - e1=", e1);
      return null; // no valid implementation address found
    }
    console.log("decodeTxCalldata - Step 2: Try with implementation ABI (EIP-1967) - impl=" + impl);

    const implAbi = await fetchAbiFromEtherscan(impl, chainId, etherscanApiKey);
    parsed = tryDecodeCalldata(implAbi, data);
    console.log("decodeTxCalldata - Step 2" + (parsed ? " match" : " no match"));
    return parsed;
  }
  catch (e2) {
    console.error("decodeTxCalldata - e2=", e2);
    return null; // no valid implementation address found
  }
}


// Main function to analyze a transaction
export async function analyzeTransaction(toAddress, calldata, operation, chainId, etherscanApiKey, safeAddress, provider, trustedAddresses) {
  console.log("analyzeTransaction - [toAddress, calldata, operation, chainId, etherscanApiKey, safeAddress]=" + [toAddress, calldata, operation, chainId, etherscanApiKey, safeAddress]);
  toAddress = toAddress.toLowerCase();
  const analysis = {
    toAddress,
    decoded: null,
    reputations: [],
    errors: [],
    nbAlerts: 0,
    totalAlerts: 0
  };
  const promises = [];

  try {
    const addressesToCheck = new Set();
    const alerts = [];

    const parsed = await decodeTxCalldata(toAddress, calldata, chainId, etherscanApiKey, provider);
    console.log("analyzeTransaction - parsed=", parsed);
    if(parsed) {
      if(operation != 0)
        alerts.push({ level: 2*SEVERITY.MEDIUM, reason: 'Delegate call detected' });

      const upgradeFunctionNames = [
        'upgradeTo',
        'upgradeToAndCall',
        'setImplementation',
        'changeMasterCopy',
        'setTarget',
        'initialize',
        'setGuard'
      ];
      if (upgradeFunctionNames.includes(parsed.name))
        alerts.push({ level: SEVERITY.HIGH, reason: `Function ${parsed.name} suggests a possible contract upgrade` });
      if (parsed.name?.toLowerCase().includes('change'))
        alerts.push({ level: SEVERITY.HIGH, reason: `Contract is calling itself using "${parsed.name}" — may indicate self-destruct or upgrade pattern` });
      analysis.decoded = { functionName: parsed.name, signature: parsed.signature, rgs: parsed.args };
      for (const arg of parsed.args)
        if (typeof arg === 'string' && ethers.utils.isAddress(arg) && arg.toLowerCase()!=toAddress)
          addressesToCheck.add(arg.toLowerCase());
    }
    else {
      if(operation == 0)
        alerts.push({ level: SEVERITY.HIGH, reason: 'Unverified contract (no ABI available on Etherscan)' });
      else
        alerts.push({ level: SEVERITY.CRITICAL, reason: 'Unverified contract (no ABI available on Etherscan) and delegate call detected' });
    }
    promises.push(addAlerts(trustedAddresses, analysis, toAddress, chainId, etherscanApiKey, alerts));
    console.log("analyzeTransaction - addressesToCheck=", addressesToCheck);
    for (const address of addressesToCheck)
      promises.push(addAlerts(trustedAddresses, analysis, address, chainId, etherscanApiKey));
  }
  catch (err) {
    console.error('analyzeTransaction - Error during transaction analysis:', err.message);
    analysis.errors.push(`Failed to analyze transaction: ${err.message}`);
  }

  console.log(`analyzeTransaction - analysis result:`, analysis);
  return Promise.all(promises).then(() => analysis);
}
function addAlerts(trustedAddresses, analysis, address, chainId, etherscanApiKey, alerts=[]) {
  return checkAddressReputation(trustedAddresses, address, chainId, etherscanApiKey)
  .then(temp => {
    alerts = [...alerts, ...temp];
    analysis.reputations.push({ address, alerts });
    analysis.totalAlerts += alerts.reduce((sum, alert) => sum + alert.level, 0);
    analysis.nbAlerts += alerts.length;
  })
}