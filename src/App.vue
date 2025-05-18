<!-- src/App.vue -->
<script setup>
  import QueueTransaction from './components/QueueTransaction.vue';
  import Transactions from './components/Transactions.vue';
  import { getProxyDetails, loadGuardData, getGuardVersion, defineListenersGuard, STATES, EVENT_NAMES_PROXY, initSafe, setConfig, setGuard, defineListenersSafe, upgradeGuard, setProvider } from './composables/useSafe.js';
  import { ref, onMounted, computed  } from 'vue';
  import { version } from "../package.json";

  const safeInfo = ref(null);
  const guardInfo = ref({address: null});
  const guardInfoOld = {};
  const blockexplorer = ref(null);
  const errorConnecting = ref(null);
  const msgConfig = ref(null);
  const errorLoadGuard = ref(null);
  const msgGuard = ref(null);
  const transactions = ref([]);
  const loadingGuard = ref(false);
  const currentTime = ref(Date.now()/1000);
  const showmainnet = ref(false);
  const editingConfig = ref(false);
  const addingGuard = ref(false);
  const settingGuard = ref(false);
  const upgradingGuard = ref(false);
  const settingProvider = ref(false);
  const mewGuardAddress = ref(null);
  const mewGuardImpAddress = ref(null);
  const settingProviderCall = ref(false);
  const userMsgDuration = 10000;
  const connected = computed(() => {
    return Boolean(safeInfo.value && safeInfo.value.safeAddress && guardInfo.value.address && safeInfo.value.provider)
  })
  const issues = computed(() => {
    const res = []
    if(guardInfo.value.safeAddress && guardInfo.value.safeAddress != safeInfo.value.safeAddress)  res.push("Guard not pointing to Safe (points to " + guardInfo.value.safeAddress + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.admin.owner != safeInfo.value.safeAddress) res.push("Guard admin not pointing to Safe (points to " + guardInfo.value.proxyData.admin.owner + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.proxy.admin != guardInfo.value.proxyData.admin.admin) res.push("Mismatch between guard proxy and admin on admin value (proxy=> " + guardInfo.value.proxyData.proxy.admin + "`, admin=> " + guardInfo.value.proxyData.admin.admin + ")");
    if(guardInfo.value.proxyData && guardInfo.value.proxyData.proxy.imp != guardInfo.value.proxyData.admin.imp) res.push("Mismatch between guard proxy and admin on imp value (proxy=> " + guardInfo.value.proxyData.proxy.imp + ", admin=> " + guardInfo.value.proxyData.admin.imp + ")");
    return res;
  })

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
    resetEdit();
    msgConfig.value = "";
    if(editingConfig.value) {
      if(guardInfoOld.throttle != guardInfo.value.throttle 
      || guardInfoOld.limitNoTimelock != guardInfo.value.limitNoTimelock 
      || guardInfoOld.timelockDuration != guardInfo.value.timelockDuration
      || guardInfoOld.quorumCancel != guardInfo.value.quorumCancel
      || guardInfoOld.quorumExecute != guardInfo.value.quorumExecute) {
        console.log('App.edidConfig - new config');
        setConfig(guardInfo.value.timelockDuration, guardInfo.value.throttle, guardInfo.value.limitNoTimelock, guardInfo.value.quorumCancel, guardInfo.value.quorumExecute, 
          arrayUnique((guardInfo.value.timelockDuration == 0 ? transactions.value : transactions.value.filter(t => t.state == STATES.QUEUED && t.value <= guardInfo.value.limitNoTimelock)).map(t => t.txHash))
        )
        .then(() => {
          console.log("App.edidConfig - config set");
          setAndResetMsgConfig("Transaction sent");
        })
        .catch(error =>  {
          console.error("App.edidConfig", guardInfo.value.timelockDuration, guardInfo.value.throttle, guardInfo.value.limitNoTimelock, error);
          msgConfig.value = "Error setting config: " + error.message;
        })
        guardInfo.value.throttle = guardInfoOld.throttle;
        guardInfo.value.limitNoTimelock = guardInfoOld.limitNoTimelock;
        guardInfo.value.timelockDuration = guardInfoOld.timelockDuration;
      }
      else setAndResetMsgConfig("Same config!");
    }
    editingConfig.value = !editingConfig.value;
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
        .then(version => {
          console.log('App.eventListenerProxy - guard version=', version);
          guardInfo.value.version = version;
          setAndResetMsgGuard("Guard implementation upgraded to version " + version + " (contract="+ implementation + ")");
        })
        .catch(error => {
          console.error("App.eventListenerProxy", error);
          errorLoadGuard.value = "Error loading guard data: " + error.message;
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
    console.log('App._loadGuardData - processing promisses');
    return Promise.all([
      p_tx.then(txs => {
        transactions.value = txs;
        console.log('App._loadGuardData - define guard listeners');
        defineListenersGuard(transactions.value, updateConfig);
      }),
      p_config.then(timelockConfig => updateConfig(timelockConfig, true)),
      p_safe.then(safeAddress => {
        guardInfo.value.safeAddress = safeAddress;
        if(safeAddress != safeInfo.value.safeAddress) {
          console.error("App._loadGuardData - guard safe address does not match safe address, [guardInfo.safeAddress, safeInfo.safeAddress]=" + [guardInfo.value.safeAddress, safeInfo.value.safeAddress]);
          errorLoadGuard.value = "Guard address does not match safe address";
        }
      }),
      p_version.then(version => guardInfo.value.version = version),
      p_proxy.then(proxyData => {
        console.log('App._loadGuardData - proxyData=', proxyData);
        guardInfo.value.proxyData = proxyData; 
      })
    ])
    .then(() => {
      resetEdit();
      console.log("App._loadGuardData - done");
    })
    .catch(error => {
      console.error("App._loadGuardData", error);
      errorLoadGuard.value = "Error loading guard data: " + error.message;
    })
    .finally(() => loadingGuard.value = false);
  }
  function updateConfig(timelockConfig, loadGuard) {
    console.log('App.updateConfig - loadGuard=' + loadGuard + ', config loaded=', timelockConfig);
    if(timelockConfig && (timelockConfig.throttle != guardInfo.value.throttle || timelockConfig.limitNoTimelock != guardInfo.value.limitNoTimelock || timelockConfig.timelockDuration != guardInfo.value.timelockDuration)) {
      guardInfoOld.throttle = guardInfo.value.throttle = timelockConfig.throttle;
      guardInfoOld.limitNoTimelock = guardInfo.value.limitNoTimelock = timelockConfig.limitNoTimelock;
      guardInfoOld.timelockDuration = guardInfo.value.timelockDuration = timelockConfig.timelockDuration;
      guardInfoOld.quorumCancel = guardInfo.value.quorumCancel = timelockConfig.quorumCancel;
      guardInfoOld.quorumExecute = guardInfo.value.quorumExecute = timelockConfig.quorumExecute;
      !loadGuard && setAndResetMsgConfig("Config updated");
    }
    else guardInfoOld.throttle = guardInfo.value.throttle = guardInfoOld.limitNoTimelock = guardInfo.value.limitNoTimelock = guardInfoOld.timelockDuration = guardInfo.value.timelockDuration = null;
  }
  function changeGuard(promise) {
    promise.catch(error => {
      console.error("App.changeGuard", error);
      setAndResetMsgGuard("Error changing guard: " + error.message);
    })
  }
  async function callSetProvider(providerURL) {
    console.log('App.callSetProvider - providerURL=' + providerURL);
    settingProviderCall.value = true;
    setProvider(providerURL)
    .then(() => {
      safeInfo.value.provider = "EXTERNAL - " + providerURL.substring(0, 25) + "...";
      if(guardInfo.value.address) {
        console.log('App.setProvider - load guard data');
        _loadGuardData(guardInfo.value.address);
        console.log('App.setProvider - define safe listener');
        defineListenersSafe(guardAddress => _loadGuardData(guardAddress));
      }
    })
    .catch(error => {
      console.error("App.callSetProvider", error);
      setAndResetMsgGuard("Error setting provider: " + error.message);
    })
    .finally(() => settingProviderCall.value = false)
  }
  function resetEdit() {
    console.log('App.resetEdit - reset edit');
    editingConfig.value = false;
    addingGuard.value = false;
    settingGuard.value = false;
    upgradingGuard.value = false;
    settingProvider.value = false;
  }
  onMounted(async () => {
    try {
      console.log('App.onMounted - connecting to Safe');
      const {network, chainId, safeAddress, guardAddress, chainInfoPromise, buildInProvider, version} = await initSafe();
      safeInfo.value = {network, chainId, safeAddress, provider: buildInProvider && "BUILD IN", version};
      
      console.log('App.onMounted - load guard data');
      _loadGuardData(guardAddress);
      
      console.log('App.onMounted - define safe listener');
      defineListenersSafe(guardAddress => _loadGuardData(guardAddress));
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
    <div v-if="errorConnecting">
      {{ errorConnecting }}
    </div>

    <div v-else-if="safeInfo" class="app-container">
      Time: {{ formatDate(currentTime) }}
      <div class="tables-wrapper">
        <table class="status-table">
          <tr>
            <td colspan="2" style="text-align: left;">Safe</td>
            <td>
              <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', safeInfo.safeAddress)">{{ safeInfo.safeAddress}}</a>
              <span v-if="guardInfo.safeAddress">{{guardInfo.safeAddress == safeInfo.safeAddress ?  ' ✅' : ' ⚠️'}}</span>
            </td>
          </tr>
          <tr>
            <td v-if="guardInfo.proxyData" rowspan="3" style="text-align: left;">Guard</td>
            <td v-if="guardInfo.proxyData" style="text-align: left;">Proxy</td>
            <td v-else colspan="2" style="text-align: left;">Guard</td>
            <td v-if="guardInfo.address">
              <span v-if="!addingGuard">
                <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.address)">{{ guardInfo.address }}</a>
                <font-awesome-icon @click="changeGuard(setGuard(true))" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-trash-can" />
                <font-awesome-icon @click="resetEdit();addingGuard=true" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-edit" />
              </span>
              <span v-else>
                <input v-model.lazy="mewGuardAddress" type="text" placeholder="Enter new guard address" style="width: 85%;"/>
                <font-awesome-icon @click="addingGuard=false; changeGuard(setGuard(true, mewGuardAddress))" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-save" />
                <font-awesome-icon @click="addingGuard=false" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-cancel" />
              </span>
            </td>
            <td v-else-if="!settingGuard">
              <span style="color: red;">GUARD NOT SET ⚠️</span>
              <font-awesome-icon @click="resetEdit();settingGuard=true" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-edit" />
            </td>
            <td v-else>
              <input :disabled="addingGuard" v-model.lazy="mewGuardAddress" type="text" placeholder="Enter guard address" style="width: 85%;"/>
              <span v-if="!addingGuard">
                <font-awesome-icon @click="resetEdit();addingGuard=true; changeGuard(setGuard(false, mewGuardAddress))" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-save" />
                <font-awesome-icon @click="resetEdit()" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-cancel" />
              </span>
              <font-awesome-icon v-else @click="addingGuard=false" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-edit" />
            </td>
          </tr>
          <tr v-if="guardInfo.proxyData">
            <td style="text-align: left;">Imp</td>
            <td>
              <a v-if="!upgradingGuard" :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.proxyData.proxy.imp)">{{ guardInfo.proxyData.proxy.imp }}</a>
              <span v-if="guardInfo.proxyData.admin.owner == safeInfo.safeAddress">
                <font-awesome-icon v-if="!upgradingGuard" @click="resetEdit();upgradingGuard=true" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-arrow-up-from-bracket" />
                <span v-else>
                  <input v-model.lazy="mewGuardImpAddress" type="text" placeholder="Enter new implementation address" style="width: 85%;"/>
                  <font-awesome-icon @click="upgradingGuard=false; changeGuard(upgradeGuard(guardInfo.proxyData.proxy.admin, guardInfo.address, mewGuardImpAddress))" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-save" />
                  <font-awesome-icon @click="upgradingGuard=false" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-cancel" />
                </span>
              </span>
              <span v-else> ⚠️</span>
            </td>
          </tr>
          <tr v-if="guardInfo.proxyData">
            <td style="text-align: left;">Admin</td>
            <td>
              <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', guardInfo.proxyData.proxy.admin)">{{ guardInfo.proxyData.proxy.admin }}</a>
              <span>{{guardInfo.proxyData.admin.imp == guardInfo.proxyData.proxy.imp && guardInfo.proxyData.admin.admin == guardInfo.proxyData.proxy.admin ? ' ✅' : ' ⚠️'}}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Versions</td>
            <td>UI v{{version}} - Safe v{{ safeInfo.version }}<span v-if="guardInfo.version"> - Guard v{{ guardInfo.version }}</span></td>
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
              <font-awesome-icon @click="resetEdit();settingProvider=true" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-edit" />
            </td>
            <td v-else>
              <input v-model.lazy="newProvider" type="text" placeholder="Enter provider URL" style="width: 85%;"/>
              <font-awesome-icon @click="settingProvider=false; callSetProvider(newProvider)" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-save" />
              <font-awesome-icon @click="settingProvider=false" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-cancel" />
            </td>
          </tr>
        </table>
        <form @submit.prevent="editConfig()">
          <table v-if="guardInfo.address" class="status-table">
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
              <td ><input :disabled="!editingConfig" v-model.number="guardInfo.quorumCancel" type="number" min="0" step="any" class="narrow"/></td>
            </tr>
            <tr>
              <td style="text-align: left;">Execute</td>
              <td ><input :disabled="!editingConfig" v-model.number="guardInfo.quorumExecute" type="number" min="0" step="any" class="narrow"/></td>
            </tr>
            <tr>
              <td colspan="3">
                <span v-if="loadingGuard">Loading Guard</span>
                <span v-else-if="errorLoadGuard">Issue loading config - check guard address</span>
                <span v-else>
                  <button :disabled="!connected" type="submit">{{editingConfig ? "Save Config" : "Edit Config"}}</button>
                  <button v-if="editingConfig" @click="editingConfig=false">Cancel</button>
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
        <div v-if="safeInfo.chainId==1 && !showmainnet">
          <br>
          YOU ARE ON MAINNET, MAKE SURE YOU KNOW WHAT YOU ARE DOING.<br>
          THIS CODE HAS NOT BEEN AUDITED AND IS STILL IN DEV, YOU PROCEED AT YOUR OWN RISKS<br>
          <button @click="showmainnet=true">SHOW APP ANYWAY</button>
        </div>
        <div v-else>
          <div v-if="loadingGuard">
            Loading transactions
          </div>
          <div v-else-if="errorLoadGuard">
            {{ errorLoadGuard }}
          </div>
          <div v-else class="app-container">
            <QueueTransaction/>
            <Transactions :transactions="transactions.filter(t=>t.state==STATES.QUEUED)" :showAction="true" :disabled="tx => currentTime < (tx.actiondate + guardInfo.timelockDuration)"
              :blockexplorer="blockexplorer" :dateFormater="tx => formatDate(tx.actiondate + guardInfo.timelockDuration)" dateTitle="Execute after" title="Queued Transactions" />
            <Transactions :transactions="transactions.filter(t=>t.state==STATES.CANCELED)"
              :blockexplorer="blockexplorer" :dateFormater="tx => formatDate(tx.actiondate)" dateTitle="Cancelation date" title="Canceled Transactions" />
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