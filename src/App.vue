<!-- src/App.vue -->
<script setup>
  import myTooltip from './components/myTooltip.vue';
  import TransactionAction from './components/TransactionAction.vue';
  import Transactions from './components/Transactions.vue';
  import { getSignersFromSafeTx, zeroAddress, getProxyDetails, loadGuardData, getGuardVersion, defineListenersGuard, SAFE_EVENT_NAMES, STATES, EVENT_NAMES_PROXY, initSafe, setConfig, setGuard, defineListenersSafe, upgradeGuard, setProvider } from './composables/useSafe.js';
  import { ref, onMounted, computed, useTemplateRef  } from 'vue';
  import { version } from "../package.json";
  import versions from "./composables/versions.json";
  
  const transactionAction = useTemplateRef(null);
  const newProvider = ref(null);
  const safeInfo = ref(null);
  const guardInfo = ref({address: null});
  const guardInfoOld = ref({address: null});
  const blockexplorer = ref(null);
  const errorConnecting = ref(null);
  const msgConfig = ref(null);
  const errorLoadGuard = ref(null);
  const msgGuard = ref(null);
  const transactions = ref([]);
  const loadingGuard = ref(false);
  const currentTime = ref(Date.now()/1000);
  const showMainnet = ref(false);
  const editingConfig = ref(false);
  const addingGuard = ref(false);
  const settingGuard = ref(false);
  const settingProvider = ref(false);
  const mewGuardAddress = ref(null);
  const settingProviderCall = ref(false);
  const userMsgDuration = 10000;
  const lastQueueTime = ref(0);
  const directExecutionEnabled = computed(() => {
    return guardInfoOld.value.quorumExecute > safeInfo.value.threshold;
  })
  const connected = computed(() => {
    return Boolean(safeInfo.value && safeInfo.value.safeAddress && guardInfo.value.address && safeInfo.value.provider)
  })
  const issues = computed(() => {
    const res = []
    if(guardInfo.value.safeAddress && guardInfo.value.safeAddress != safeInfo.value.safeAddress)  res.push("Guard not pointing to Safe (points to " + guardInfo.value.safeAddress + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.admin.owner != safeInfo.value.safeAddress) res.push("Guard admin not pointing to Safe (points to " + guardInfo.value.proxyData.admin.owner + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.proxy.admin != guardInfo.value.proxyData.admin.admin) res.push("Mismatch between Guard proxy and admin on admin value (proxy=> " + guardInfo.value.proxyData.proxy.admin + "`, admin=> " + guardInfo.value.proxyData.admin.admin + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.proxy.imp != guardInfo.value.proxyData.admin.imp) res.push("Mismatch between Guard proxy and admin on imp value (proxy=> " + guardInfo.value.proxyData.proxy.imp + ", admin=> " + guardInfo.value.proxyData.admin.imp + ")");
    return res;
  })
  const compatibleSafeVersion = computed(() => {
    if(!guardInfo.value.testedSafeVersions) return false
    return guardInfo.value.testedSafeVersions.split("|").findIndex(v => safeInfo.value.version.startsWith(v)) != -1; // startsWith because some safe versions have a suffix like "+L2"
  });

  function formatDate(timestamp) {
    if (!timestamp || timestamp === 0) return '—'
    return new Date(timestamp * 1000).toLocaleString()
  }
  function arrayUnique(array) {
    const result = [];
M:  for (let i = 0; i < array.length; i++) {
      const val = array[i];
      for (let i2 = 0; i2 < result.length; i2++)
          if (result[i2] == val)
              continue M;
      result.push(name);
    }
  }
  function setAndResetMsgConfig(text) {
    msgConfig.value = text;
    setTimeout(() => msgConfig.value = "", userMsgDuration);
  }
  function setAndResetMsgGuard(text) {
    msgGuard.value = text;
    setTimeout(() => msgGuard.value = "", userMsgDuration);
  }
  function editConfig() { 
    resetEdit(editingConfig.value);
    msgConfig.value = "";
    if(editingConfig.value) {
      if(guardInfoOld.value.throttle != guardInfo.value.throttle 
        || guardInfoOld.value.limitNoTimelock != guardInfo.value.limitNoTimelock 
        || guardInfoOld.value.timelockDuration != guardInfo.value.timelockDuration
        || guardInfoOld.value.quorumCancel != guardInfo.value.quorumCancel
        || guardInfoOld.value.quorumExecute != guardInfo.value.quorumExecute) {
        console.log('App.editConfig - new config');
        setConfig(guardInfo.value.timelockDuration, guardInfo.value.throttle, guardInfo.value.limitNoTimelock, guardInfo.value.quorumCancel, guardInfo.value.quorumExecute, 
          arrayUnique((guardInfo.value.timelockDuration == 0 ? transactions.value : transactions.value.filter(t => t.state == STATES.QUEUED && t.value <= guardInfo.value.limitNoTimelock)).map(t => t.txHash))
        )
        .then(safeTxHash => {
          console.log("App.editConfig - config sent, safeTxHash=" + safeTxHash);
          setAndResetMsgConfig(safeTxHash ? "Transaction sent" : "Config ready to be queued or executed");
        })
        .catch(error =>  {
          console.error("App.editConfig", guardInfo.value.timelockDuration, guardInfo.value.throttle, guardInfo.value.limitNoTimelock, error);
          msgConfig.value = "Error setting config: " + error.message;
        })
        .finally(() => resetConfig())
      }
      else setAndResetMsgConfig("Same config!");
    }
    editingConfig.value = !(editingConfig.value);
  }
  function resetConfig() {
    guardInfo.value.throttle = guardInfoOld.value.throttle;
    guardInfo.value.limitNoTimelock = guardInfoOld.value.limitNoTimelock;
    guardInfo.value.timelockDuration = guardInfoOld.value.timelockDuration;
    guardInfo.value.quorumCancel = guardInfoOld.value.quorumCancel;
    guardInfo.value.quorumExecute = guardInfoOld.value.quorumExecute;
  }
  function eventListenerProxy(eventName, ...args) {
    console.log('App.eventListenerProxy - eventName=' + eventName + ', args=', args);
    if(!guardInfo.value.proxyData) {
      console.warning("App.eventListenerProxy - no proxy data");
      return;
    }
    switch(eventName) {
      case EVENT_NAMES_PROXY.ADMIN_CHANGED:
        const [previousAdmin, newAdmin] = args;
        console.log('App.eventListenerProxy - call getProxyDetails to renew listener to the admin contract');
        getProxyDetails(guardInfo.value.address, eventListenerProxy)
        .then(proxyData => {
          console.log('App.eventListenerProxy - proxyData=', proxyData);
          guardInfo.value.proxyData = proxyData;
        })
        .catch(error => {
          console.error("App.eventListenerProxy", error);
          setAndResetMsgGuard("Error loading proxy data: " + error.message);
        });
        setAndResetMsgGuard("Guard admin changed from " + previousAdmin + " to " + newAdmin);
        break;
      case EVENT_NAMES_PROXY.UPGRADED:
        const [implementation] = args;
        guardInfo.value.proxyData.proxy.imp = implementation;
        guardInfo.value.proxyData.admin.imp = implementation;
        getGuardVersion(implementation)
        .then(([version, testedSafeVersions]) => {
          console.log('App.eventListenerProxy - [version, testedSafeVersions]=', [version, testedSafeVersions]);
          guardInfo.value.version = version;
          guardInfo.value.testedSafeVersions = testedSafeVersions;
          setAndResetMsgGuard("Guard implementation upgraded to version " + version + " (contract="+ implementation + ")");
        })
        .catch(error => {
          console.error("App.eventListenerProxy", error);
          errorLoadGuard.value = "Error loading Guard data: " + error.message;
        })
        break;
      case EVENT_NAMES_PROXY.OWNERSHIP_TRANSFERRED:
        const [previousOwner, newOwner] = args;
        guardInfo.value.proxyData.admin.owner = newOwner;
        setAndResetMsgGuard("Guard ownership transferred from " + previousOwner + " to " + newOwner);
        break;
    }
  }
  function _loadGuardData(_guardAddress) {
    console.log('App._loadGuardData - _guardAddress=' + _guardAddress);
    guardInfo.value = {address: _guardAddress};
    const ps = loadGuardData(_guardAddress, eventListenerProxy)
    if(ps===null) return;
    const {p_tx, p_version, p_safe, p_config, p_proxy} = ps;
    errorLoadGuard.value = null;
    loadingGuard.value = true;
    console.log('App._loadGuardData - processing promises');
    return Promise.all([
      p_tx.then(txs => {
        console.log('App._loadGuardData - received transactions');
        lastQueueTime.value = Math.max(...txs.map(x=>x.queueDate));
        transactions.value = txs.filter(tx => tx.state == STATES.QUEUED || tx.state == STATES.CANCELED);
        for(const tx of transactions.value)
          getSignersFromSafeTx(tx.realHash).then(signers => tx.signers = signers);
        console.log('App._loadGuardData - define Guard listeners');
        defineListenersGuard(transactions.value, updateConfig,
          eventData => {
            if(eventData.state == STATES.QUEUED || eventData == STATES.CANCELED) {
              if(eventData.state == STATES.QUEUED)
                lastQueueTime.value = eventData.queueDate;
              const tx = transactions.value.find(t => t.realHash == eventData.realHash);
              if(tx)
                getSignersFromSafeTx(tx.realHash).then(signers => tx.signers = signers);
            }
        });
      }),
      p_config.then(timelockConfig => updateConfig(timelockConfig, true)),
      p_safe.then(safeAddress => {
        guardInfo.value.safeAddress = safeAddress;
        if(safeAddress != safeInfo.value.safeAddress) {
          console.error("App._loadGuardData - Guard safe address does not match safe address, [guardInfo.safeAddress, safeInfo.safeAddress]=" + [guardInfo.value.safeAddress, safeInfo.value.safeAddress]);
          errorLoadGuard.value = "Guard address does not match safe address";
        }
      }),
      p_version.then(([version, testedSafeVersions]) => {
        console.log('App._loadGuardData - [version, testedSafeVersions]=', [version, testedSafeVersions]);
        guardInfo.value.version = version;
        guardInfo.value.testedSafeVersions = testedSafeVersions;
      }),
      p_proxy.then(proxyData => {
        console.log('App._loadGuardData - proxyData=', proxyData);
        guardInfo.value.proxyData = proxyData; 
      })
      .catch(error => {
        console.error("App._loadGuardData", error);
        setAndResetMsgGuard("Error loading proxy data: " + error.message);
      })
    ])
    .then(() => {
      resetEdit();
      console.log("App._loadGuardData - done");
    })
    .catch(error => {
      console.error("App._loadGuardData", error);
      errorLoadGuard.value = "Error loading Guard data: " + error.message;
    })
    .finally(() => loadingGuard.value = false);
  }
  function updateConfig(timelockConfig, loadGuard) {
    console.log('App.updateConfig - loadGuard=' + loadGuard + ', config loaded=', timelockConfig);
    if(timelockConfig && (timelockConfig.throttle != guardInfo.value.throttle || timelockConfig.limitNoTimelock != guardInfo.value.limitNoTimelock || timelockConfig.timelockDuration != guardInfo.value.timelockDuration)) {
      guardInfoOld.value.throttle = guardInfo.value.throttle = timelockConfig.throttle;
      guardInfoOld.value.limitNoTimelock = guardInfo.value.limitNoTimelock = timelockConfig.limitNoTimelock;
      guardInfoOld.value.timelockDuration = guardInfo.value.timelockDuration = timelockConfig.timelockDuration;
      guardInfoOld.value.quorumCancel = guardInfo.value.quorumCancel = timelockConfig.quorumCancel;
      guardInfoOld.value.quorumExecute = guardInfo.value.quorumExecute = timelockConfig.quorumExecute;
      !loadGuard && setAndResetMsgConfig("Config updated");
    }
    else guardInfoOld.value.throttle = guardInfo.value.throttle = guardInfoOld.value.limitNoTimelock = guardInfo.value.limitNoTimelock = guardInfoOld.value.timelockDuration = guardInfo.value.timelockDuration = null;
  }
  function changeGuard(promise) {
    promise.catch(error => {
      console.error("App.changeGuard", error);
      setAndResetMsgGuard("Error changing Guard: " + error.message);
    })
  }
  async function callSetProvider(providerURL) {
    console.log('App.callSetProvider - providerURL=' + providerURL);
    settingProviderCall.value = true;
    setProvider(providerURL)
    .then(() => {
      safeInfo.value.provider = "EXTERNAL - " + providerURL.substring(0, 25) + "...";
      if(guardInfo.value.address) {
        console.log('App.setProvider - load Guard data');
        _loadGuardData(guardInfo.value.address);
        console.log('App.setProvider - define safe listener');
        defineListenersSafe((...args) => safeListener(...args));
      }
    })
    .catch(error => {
      console.error("App.callSetProvider", error);
      setAndResetMsgGuard("Error setting provider: " + error.message);
    })
    .finally(() => settingProviderCall.value = false)
  }
  function safeListener(...args) {
    const event = args[args.length-1];
    console.log('safeListener - [eventName, data]=' + [event.event, args[0]]);
    switch(event.event) {
      case SAFE_EVENT_NAMES.CHANGED_GUARD:
        console.log('safeListener - Guard changed, loading new Guard data');
        return _loadGuardData((args[0]==zeroAddress) ? null : args[0]);
      case SAFE_EVENT_NAMES.CHANGED_THRESHOLD:
        console.log('safeListener - Threshold changed, updating Safe info');
        safeInfo.value.threshold = args[0];
        break;
      case SAFE_EVENT_NAMES.ADDED_OWNER:
        console.log('safeListener - Owner added, updating Safe info');
        safeInfo.value.owners.push(args[0]);
        break;
      case SAFE_EVENT_NAMES.REMOVED_OWNER:
        console.log('safeListener - Owner removed, updating Safe info');
        const index = safeInfo.value.owners.indexOf(args[0]);
        if(index != -1)
          safeInfo.value.owners.splice(index, 1);
        else console.error("safeListener - Owner not found in Safe owners list, cannot remove it");
        break;
    }
  }
  function resetEdit(editingConfigV) {
    console.log('App.resetEdit - reset edit');
    editingConfig.value = Boolean(editingConfigV);
    addingGuard.value = false;
    settingGuard.value = false;
    settingProvider.value = false;
  }
  function latestGuardAddress() {
    return versions[versions.length-1].address;
  }
  onMounted(async () => {
    try {
      console.log('App.onMounted - connecting to Safe');
      const {network, chainId, safeAddress, guardAddress, chainInfoPromise, buildInProvider, version, threshold, owners} = await initSafe(
        (to, value, data) => {
          if(directExecutionEnabled.value)
            transactionAction.value.setFields(to, value, data);
          return directExecutionEnabled.value;
      });
      safeInfo.value = {network, chainId, safeAddress, provider: buildInProvider && "BUILD IN", version, threshold, owners};
      
      console.log('App.onMounted - load Guard data');
      _loadGuardData(guardAddress);
      
      console.log('App.setProvider - define safe listener');
      defineListenersSafe((...args) => safeListener(...args));
      console.log('App.onMounted - set time updates');
      setInterval(() => currentTime.value = Date.now()/1000,1000);
      
      console.log('App.onMounted - loading chainInfo');
      chainInfoPromise.then(chainInfo => blockexplorer.value = chainInfo.blockExplorerUriTemplate);
    }
    catch (err) {
      console.error('App.onMounted', err);
      errorConnecting.value = "Error initializing Safe: " + err.message;
    }
  });
</script>

<template>
  <div>
    <h1>Safe Timelock</h1>
    <a href="https://github.com/L1b3rtyy/safe-timelock-ui"><font-awesome-icon icon="fa-brands fa-github" style="color: white"/></a>
    <div v-if="errorConnecting">
      {{ errorConnecting }}
    </div>

    <div v-else-if="safeInfo" class="app-container">
      <table style="border:none;">
        <tr>
          <td style="padding-right: 1rem;">Time:</td>
          <td style="text-align: left">{{ formatDate(currentTime) }}</td>
        </tr>
        <tr v-if="guardInfoOld.throttle && lastQueueTime">
          <td style="padding-right: 1rem;">Last Queue Time:</td>
          <td style="text-align: left">
            {{formatDate(lastQueueTime)}}
            <myTooltip v-if="currentTime > lastQueueTime + guardInfoOld.throttle" emoji="✅" text="Throttle time passed"/>
            <myTooltip v-else emoji="⏳" text="Within throttle time"/>
          </td>
        </tr>
      </table>
      <div class="tables-wrapper">
        <table class="status-table">
          <tr>
            <td colspan="2" style="text-align: left;">Safe</td>
            <td>
              <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', safeInfo.safeAddress)">{{ safeInfo.safeAddress}}</a>
              <span v-if="guardInfo.safeAddress">
                <myTooltip v-if="guardInfo.safeAddress == safeInfo.safeAddress" emoji="✅" text="Guard points to the Safe"/>
                <myTooltip v-else emoji="⚠️" :text="'Guard not pointing to the Safe (points to ' + guardInfo.safeAddress + ')'"/>
              </span>
            </td>
          </tr>
          <tr>
            <td v-if="guardInfo.proxyData" rowspan="3" style="text-align: left;">Guard</td>
            <td v-if="guardInfo.proxyData" style="text-align: left;">Proxy</td>
            <td v-else colspan="2" style="text-align: left;">Guard</td>
            <td v-if="guardInfo.address">
              <span v-if="!addingGuard">
                <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.address)">{{ guardInfo.address }}</a>
                <myTooltip @click="changeGuard(setGuard(true))" icon="fa-solid fa-trash-can" text="Remove Guard"/>
                <myTooltip @click="resetEdit();addingGuard=true" icon="fa-solid fa-edit" text="Change Guard"/>
              </span>
              <span v-else>
                <input v-model.lazy="mewGuardAddress" type="text" placeholder="Enter new Guard address" style="width: 85%;"/>
                <myTooltip @click="addingGuard=false; changeGuard(setGuard(true, mewGuardAddress))" icon="fa-solid fa-save" text="Set Guard to this one"/>
                <myTooltip @click="addingGuard=false" icon="fa-solid fa-cancel" text="Cancel"/>
              </span>
            </td>
            <td v-else-if="!settingGuard">
              <span style="color: red;">GUARD NOT SET ⚠️</span>
              <myTooltip @click="resetEdit();settingGuard=true" icon="fa-solid fa-edit" text="Set Guard"/>
            </td>
            <td v-else>
              <input :disabled="addingGuard" v-model.lazy="mewGuardAddress" type="text" placeholder="Enter Guard address" style="width: 85%;"/>
              <span v-if="!addingGuard">
                <myTooltip @click="resetEdit();addingGuard=true; changeGuard(setGuard(false, mewGuardAddress))" icon="fa-solid fa-save" text="Set Guard to this one"/>
                <myTooltip @click="resetEdit()" icon="fa-solid fa-cancel" text="Cancel"/>
              </span>
              <myTooltip v-else @click="addingGuard=false" icon="fa-solid fa-edit" text="Edit again"/>
            </td>
          </tr>
          <tr v-if="guardInfo.proxyData">
            <td style="text-align: left;">Imp</td>
            <td>
              <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.proxyData.proxy.imp)">{{ guardInfo.proxyData.proxy.imp }}</a>
              <myTooltip v-if="versions.find(v => v.address == guardInfo.proxyData.proxy.imp)==-1" emoji="⁉️" text="Unknown version"/>
              <span v-if="guardInfo.proxyData.admin.owner == safeInfo.safeAddress">
                <myTooltip v-if="guardInfo.proxyData.proxy.imp == latestGuardAddress()" emoji="✅" text="Implementation is the latest version"/>
                <myTooltip v-else @click="resetEdit(); changeGuard(upgradeGuard(guardInfo.proxyData.proxy.admin, guardInfo.address, latestGuardAddress()))" icon="fa-solid fa-arrow-up-from-bracket" text="Upgrade Guard to latest version"/>
              </span>
              <myTooltip v-else emoji="⚠️" :text="'Guard owner is not the Safe (is ' + guardInfo.safeAddress + ')'"/>
            </td>
          </tr>
          <tr v-if="guardInfo.proxyData">
            <td style="text-align: left;">Admin</td>
            <td>
              <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.proxyData.proxy.admin)">{{ guardInfo.proxyData.proxy.admin }}</a>
              <myTooltip v-if="guardInfo.proxyData.admin.imp == guardInfo.proxyData.proxy.imp && guardInfo.proxyData.admin.admin == guardInfo.proxyData.proxy.admin" emoji="✅" text="Proxy and Proxy Admin match"/>
              <myTooltip v-else emoji="⚠️" text="Mismatch between Proxy and Proxy Admin"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Versions</td>
            <td>UI v{{version}}<span v-if="guardInfo.version"> - Guard v{{ guardInfo.version }}</span></td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Network</td>
            <td>{{ safeInfo.network }}</td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">ChainId</td>
            <td>{{ safeInfo.chainId }}</td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Provider</td>
            <td v-if="safeInfo.provider">{{ safeInfo.provider }}</td>
            <td v-else-if="!settingProvider">
              <span v-if="!settingProviderCall" style="color: red;">NO PROVIDER ⚠️</span>
              <span v-else>IN PROGRESS...</span>
              <myTooltip @click="resetEdit();settingProvider=true" icon="fa-solid fa-edit" text="Set provider"/>
            </td>
            <td v-else>
              <input v-model.lazy="newProvider" type="text" placeholder="Enter provider URL" style="width: 85%;"/>
              <myTooltip @click="settingProvider=false; callSetProvider(newProvider)" icon="fa-solid fa-save" text="Set to this provider"/>
              <myTooltip @click="settingProvider=false" icon="fa-solid fa-cancel" text="Cancel"/>
            </td>
          </tr>
        </table>
        <form @submit.prevent="editConfig()">
          <table v-if="guardInfo.address" class="status-table">
            <tr>
              <td colspan="3" style="text-align: center;">
                Safe {{safeInfo.threshold + "/" + safeInfo.owners.length}} v{{ safeInfo.version }}
                <span v-if="guardInfo.testedSafeVersions">
                  <myTooltip v-if="compatibleSafeVersion" emoji="✅" text="Guard was tested for this Safe's version"/>
                  <myTooltip v-else emoji="⚠️" :text="'Guard not tested on this Safe\'s version (tested on ' + guardInfo.testedSafeVersions + ')'"/> 
                </span>
              </td>
            </tr>
            <tr>
              <td colspan="3" style="text-align: left; border-left: none; border-right: none;"/>
            </tr>
            <tr>
              <td colspan="2" style="text-align: left;">Time lock duration</td>
              <td><input :disabled="!editingConfig" v-model.number="guardInfo.timelockDuration" type="number" min="1" max="1209600" class="narrow"/></td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: left;">Throttle</td>
              <td><input :disabled="!editingConfig" v-model.number="guardInfo.throttle" min="0" max="3600" type="number" class="narrow"/></td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: left;">Timelock limit value</td>
              <td ><input :disabled="!editingConfig" v-model.number="guardInfo.limitNoTimelock" type="number" min="0" step="any" class="narrow"/></td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align: left;">Min quorum</td>
              <td style="text-align: left;">Cancel</td>
              <td >
                <input :disabled="!editingConfig" v-model.number="guardInfo.quorumCancel" type="number" min="0" step="any" class="narrow"/>
                <myTooltip emoji="✅" :text="guardInfoOld.quorumCancel > safeInfo.threshold ? 'Cancellation requires ' + guardInfoOld.quorumCancel + ' signers' : 'Cancellation enabled by default'" />
              </td>
            </tr>
            <tr>
              <td style="text-align: left;">Execute</td>
              <td>
                <input :disabled="!editingConfig" v-model.number="guardInfo.quorumExecute" type="number" min="0" step="any" class="narrow"/>
                <myTooltip v-if="directExecutionEnabled" emoji="✅" text="Direct execution enabled" />
                <myTooltip v-else emoji="⏸️" text="Direct execution disabled" />
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span v-if="loadingGuard">Loading Guard</span>
                <span v-else-if="errorLoadGuard">Issue loading config - check Guard address</span>
                <span v-else>
                  <button :disabled="!connected" type="submit">{{editingConfig ? "Save Config" : "Edit Config"}}</button>
                  <button v-if="editingConfig" @click="editingConfig=false; resetConfig()">Cancel</button>
                  <div v-if="msgConfig">{{ msgConfig }}</div>
                </span>
              </td>
            </tr>
          </table>
        </form>
      </div>
      <div v-if="issues.length">
        <span v-for="(index, issue) in issues" :key="index">{{ issue }}<br></span>
      </div>
      <div v-if="msgGuard">{{ msgGuard }}</div>
      <div v-if="connected">
        <div v-if="safeInfo.chainId==1 && !showMainnet">
          <br>
          YOU ARE ON MAINNET, MAKE SURE YOU KNOW WHAT YOU ARE DOING.<br>
          THIS CODE HAS NOT BEEN AUDITED AND IS STILL IN DEV, YOU PROCEED AT YOUR OWN RISKS<br>
          <button @click="showMainnet=true">SHOW APP ANYWAY</button>
        </div>
        <div v-else>
          <div v-if="loadingGuard">
            Loading transactions
          </div>
          <div v-else-if="errorLoadGuard">
            {{ errorLoadGuard }}
          </div>
          <div v-else class="app-container">
            <TransactionAction :threshold="safeInfo.threshold" :quorumExecute="guardInfoOld.quorumExecute" :quorumCancel="guardInfoOld.quorumCancel" :safeAddress="safeInfo.safeAddress" :owners="safeInfo.owners" ref="transactionAction"/>
            <Transactions :transactions="transactions.filter(t=>t.state==STATES.QUEUED)" :canCancel="guardInfoOld.quorumCancel <= safeInfo.threshold" :showAction="true" :disabled="tx => currentTime < (tx.actionDate + guardInfo.timelockDuration)"
              :blockexplorer="blockexplorer" :dateFormatter="tx => formatDate(tx.actionDate + guardInfo.timelockDuration)" dateTitle="Execute after" title="Queued Transactions" :owners="safeInfo.owners" :threshold="safeInfo.threshold"
              @cancel="(txHash, timestampPos, timestamp) => transactionAction.cancelTransaction(guardInfo.address, txHash, timestampPos, timestamp)"/>
            <Transactions :transactions="transactions.filter(t=>t.state==STATES.CANCELED)" :owners="safeInfo.owners" :threshold="safeInfo.threshold"
              :blockexplorer="blockexplorer" :dateFormatter="tx => formatDate(tx.actionDate)" dateTitle="Cancellation date" title="Canceled Transactions" />
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      Connecting to Safe...
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tables-wrapper {
  display: flex;              /* Flexbox layout for horizontal alignment */
  flex-direction: row;        /* Explicit for clarity */
  gap: 20px;                  /* Optional spacing between tables */
}
.status-table {
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.95rem;
}

.status-table th,
.status-table td {
  border: 1px solid #ccc;
  padding: 0.3rem;
  text-align: center;
  vertical-align: middle;
}
.narrow {
  width: 120px;
}

</style>