<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="close-btn">
        <myTooltip v-if="isReset" @click="init()" icon="fa-solid fa-trash-can" text="Reset"/>
        <myTooltip @click="$emit('close')" emoji="x" text="Close"/>
      </div>

      <div class="modal-section">
        <h3>1. Choose the configuration</h3>
        <table class="status-table" v-if="config">
          <tr>
            <td colspan="2" style="text-align: left;">Time lock duration</td>
            <td><input :disabled="state != STATES.CONFIG" v-model.number="config.timelockDuration" type="number" min="1" max="1209600" class="narrow"/></td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Throttle</td>
            <td><input :disabled="state != STATES.CONFIG" v-model.number="config.throttle" min="0" max="3600" type="number" class="narrow"/></td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: left;">Timelock limit value</td>
            <td ><input :disabled="state != STATES.CONFIG" v-model.number="config.limitNoTimelock" type="number" min="0" step="any" class="narrow"/></td>
          </tr>
          <tr>
            <td rowspan="2" style="text-align: left;">Min quorum</td>
            <td style="text-align: left;">Cancel</td>
            <td >
              <input :disabled="state != STATES.CONFIG" v-model.number="config.quorumCancel" type="number" min="0" :max="nbOwners" step="1" class="narrow"/>
              <myTooltip emoji="✅" :text="config.quorumCancel > threshold ? 'Cancellation requires ' + config.quorumCancel + ' signers' : 'Cancellation enabled by default'" />
            </td>
          </tr>
          <tr>
            <td style="text-align: left;">Execute</td>
            <td>
              <input :disabled="state != STATES.CONFIG" v-model.number="config.quorumExecute" type="number" min="0" :max="nbOwners" step="1" class="narrow"/>
              <myTooltip v-if="config.quorumExecute > threshold" emoji="✅" text="Direct execution enabled" />
              <myTooltip v-else emoji="⏸️" text="Direct execution disabled" />
            </td>
          </tr>
        </table>
      </div>
      <div class="modal-section">
        <h3>2. Deploy the proxy and proxy admin contract</h3>
        <p>3 transactions
          <br>a) Deploy the proxy admin contract
          <br>b) Set the Safe as the proxy admin owner
          <br>c) Deploy the proxy contract
        </p>
        <button :disabled="state != STATES.CONFIG" @click="deployHelper()">Deploy</button>
        <p>Proxy Admin contract status:<br>
          <span v-html="proxyAdminStatus"/> <!-- eslint-disable-line vue/no-v-html -->
        </p>
        <p>Proxy contract status:<br>
          <span v-html="proxyStatus"/>      <!-- eslint-disable-line vue/no-v-html -->
        </p>
        <p v-if="error">{{ error }}</p>
      </div>
      <div class="modal-section">
        <h3>3. Set the proxy as the guard</h3>
        <button :disabled="state != STATES.GUARD" @click="$emit('close'); $emit('setGuard', proxyAddress)">Set Guard</button>
        <span v-if="state == STATES.GUARD">(You may need to wait a few seconds before executing this transaction)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
  import myTooltip from './myTooltip.vue';
  import { deploy } from "../composables/deploy.js";
  import { ref, computed, onMounted } from 'vue';

const props = defineProps({
    modelValue: {
      type: Boolean,
      required: true
    },
    guardAddress: {
      type: String,
      required: true
    },
    safeAddress: {
      type: String,
      required: true
    },
    threshold: {
      type: Number,
      required: true
    },
    nbOwners: {
      type: Number,
      required: true
    },
    blockexplorer: {
      type: String,
      required: true
    }
  });

  const STATES = {CONFIG: "config", DEPLOY: "deploy", GUARD: "guard"};
  const state = ref(null);
  const error = ref(null);
  const proxyAdminAddress = ref(null);
  const proxyAdminStatus = ref(null);
  const proxyAddress = ref(null);
  const proxyStatus = ref(null);
  const config = ref(null)

  const isReset = computed(() => {
    return proxyAdminAddress.value !== null || proxyAddress.value !== null || state.value !== STATES.CONFIG || error.value !== null
      || proxyAdminStatus.value !== "Not started" || proxyStatus.value !== "Not started"
      || config.value.timelockDuration !== 172800 || config.value.throttle !== 180 || config.value.limitNoTimelock !== 0.1 ||
      config.value.quorumCancel !== defaultQuorum.value.cancel || config.value.quorumExecute !== defaultQuorum.value.execute;
  })
  const defaultQuorum = computed(() => {
    let cancel = props.nbOwners > props.threshold ? props.threshold+1 : 0;
    let execute = props.nbOwners > cancel ? cancel+1 : (cancel > props.threshold ? cancel : 0);
    return {cancel, execute}
  })

  defineEmits(['close', 'setGuard']);

  function init() {
    state.value = STATES.CONFIG;
    error.value = null;
    proxyAdminAddress.value = proxyAddress.value = null;
    proxyAdminStatus.value = proxyStatus.value = "Not started";
    config.value = {timelockDuration: 172800, throttle: 180, limitNoTimelock: 0.1, quorumCancel: defaultQuorum.value.cancel, quorumExecute: defaultQuorum.value.execute };    
  }
  onMounted(async () => {
    init();
  })
  function replaceEthereumAddress(input) {
    const ethAddressRegex = /\b0x[a-fA-F0-9]{40}\b/;
    const match = input.match(ethAddressRegex);
    if (match) {
      const EthereumAddress = match[0];
      const link = props.blockexplorer && props.blockexplorer.address.replace("{{address}}", EthereumAddress);
      const alink = "<a href=" + link + ">" + EthereumAddress + "</a>";
      return input.replace(EthereumAddress, alink);
    }
    return input; // return original string if no address found
  }

  function deployHelper() {
    state.value = STATES.DEPLOY;
    error.value = null;
    deploy(props.guardAddress, props.safeAddress, config.value.timelockDuration, config.value.throttle, config.value.limitNoTimelock, config.value.quorumCancel, config.value.quorumExecute,
      proxyAdminAddress.value, ad => proxyAdminAddress.value = ad,
      proxyAddress.value, ad => proxyAddress.value = ad,
      status => proxyAdminStatus.value = replaceEthereumAddress(status),
      status => proxyStatus.value = replaceEthereumAddress(status) 
    )
    .catch(error => {
      console.error("deployHelper", error);
      const msg = "An error occurred: " + error.message.substring(0, 100);
      if(proxyAdminAddress.value && !proxyAddress.value)
        proxyStatus.value = msg;
      else if(!proxyAdminAddress.value)
        proxyAdminStatus.value = msg;
      else
        error.value = msg;
    })
    .finally(() => state.value = proxyAdminAddress.value && proxyAddress.value ? STATES.GUARD : STATES.CONFIG)
  }
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #4f4f4f;
  padding: 1.5rem;
  border-radius: 8px;
  position: relative;
  max-width: 500px;
  width: 100%;
}

.close-btn {
  position: absolute;
  top: 0;
  right: 0.3em;
}

.modal-section + .modal-section {
  margin-top: 1rem;
}
.status-table {
  border-collapse: collapse;
  margin: 1rem auto; /* auto centers it horizontally */
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
  width: 100px;           /* fixed width for all inputs */
  box-sizing: border-box; /* ensures padding/border don't affect width */
  text-align: right;      /* align text inside inputs */
}
</style>
