<template>
  <div>
    <h2>{{ title }}</h2>

    <form class="queue-form" @submit.prevent="false">
      <div class="form-row">
        <label>To:</label>
        <input :disabled="collectingSignatures" v-model="to" type="text" required class="wide" pattern="^0x[a-fA-F0-9]{40}$" />
      </div>

      <div class="form-row">
        <label>Value (ETH):</label>
        <input :disabled="collectingSignatures" v-model.number="value" type="number" step="any" class="narrow" />
      </div>

      <div class="form-row">
        <label>Data (hex):</label>
        <input :disabled="collectingSignatures" v-model="data" type="text" required class="wide" pattern="^0x(?:[a-fA-F0-9]{2})*$" />
      </div>

      <div class="form-actions">
        <div>
          <button :disabled="collectingSignatures" @click="callQueueTransaction()">Queue</button>
        </div>
        <div v-if="quorumExecute > threshold">
          Execute<br>
          <button :disabled="collectingSignaturesCancel" @click="nbSignatures >= quorumExecute ? callExecuteTransaction() : addSignatureExecute()">{{directExecuteBtnTxt}}</button>
          <myTooltip v-if="collectingSignaturesExecute && nbSignatures" @click="cancelCollectingSignatures()" icon="fa-solid fa-cancel" text="Cancel signature collection"/>
          <br>
          Signatures:
          <myTooltip :emoji="(collectingSignaturesExecute ? nbSignatures : 0)+'/'+quorumExecute" :text="collectingSignaturesExecute ? ownersSignedDisp : null"/>
        </div>
        <div v-if="quorumCancel > threshold">
          Cancel<br>
          <button :disabled="collectingSignaturesExecute || !collectingSignaturesCancel" @click="nbSignatures >= quorumCancel ? callExecuteTransaction() : addSignaturehelper()">{{cancelBtnTxt}}</button>
          <myTooltip v-if="collectingSignaturesCancel && nbSignatures" @click="cancelCollectingSignatures()" icon="fa-solid fa-cancel" text="Cancel signature collection"/>
          <br>
          Signatures:
          <myTooltip :emoji="(collectingSignaturesCancel ? nbSignatures : 0)+'/'+quorumCancel" :text="collectingSignaturesCancel ? ownersSignedDisp : null"/>
        </div>
      </div>
      <span v-if="status">{{ status }}</span>
    </form>
    <br>
  </div>
</template>

<script setup>
import myTooltip from './myTooltip.vue';
import { queueTransaction, buildTxData } from "../composables/useSafe.js"
import { collectSignature, createTransaction, executeTransaction } from "../composables/runTransaction.js"
import { ref, computed, defineExpose } from 'vue'
import { addressDisplay, truncate } from "./utils.js";

const props = defineProps({
  threshold: {
    type: Number,
    required: true
  },
  quorumExecute: {
    type: Number,
    required: true
  },
  quorumCancel: {
    type: Number,
    required: true
  },
  safeAddress: {
    type: String,
    required: true
  },
  owners: {
    type: Array,
    required: true
  }
})

defineExpose( {cancelTransaction} );

const title = computed(() => {
  if(props.quorumExecute > props.threshold && props.quorumCancel > props.threshold)
    return 'Queue, Execute or Cancel Transactions';
  else if(props.quorumExecute > props.threshold)
    return 'Queue or Execute Transactions';
  else if(props.quorumCancel > props.threshold)
    return 'Queue or Cancel Transactions';
  else
    return 'Queue Transactions';
})
const collectingSignatures = computed(() => {
  return collectingSignaturesExecute.value || collectingSignaturesCancel.value;
})
const nbSignatures = computed(() => {
  return (tx.value && tx.value.signatures && tx.value.signatures.size || 0);
})
const directExecuteBtnTxt = computed(() => {
  if(collectingSignaturesCancel.value || nbSignatures.value == 0)
    return "Collect Signatures";
  else if(nbSignatures.value < props.quorumExecute)
    return "Add Signature";
  else
    return 'Send Transaction';
})
const cancelBtnTxt = computed(() => {
  if(collectingSignaturesExecute.value || nbSignatures.value == 0)
    return "Collect Signatures";
  else if(nbSignatures.value < props.quorumCancel)
    return "Add Signature";
  else
    return 'Cancel Transaction';
})
const validateTo = computed(() => {
  return (/^0x[a-fA-F0-9]{40}$/).test(to.value);
})
const validateData = computed(() => {
  return (/^0x(?:[a-fA-F0-9]{2})*$/).test(data.value)
})
const ownersSignedDisp = computed(() => {
  const list = ownersSigned.value.map(o => addressDisplay(o));
  if(list.length == 0) return null;
  else if(list.length == 1) return "Signature:\n" + list[0];
  else {
    let res = 'Signatures:';
    for(const owner of list)
      res = res + "\n" + owner;
    return res;
  }
})

const to = ref('')
const value = ref(0)
const data = ref('0x')
const status = ref(null)
const tx = ref(null);
const collectingSignaturesExecute = ref(false);
const collectingSignaturesCancel = ref(false);
const ownersSigned = ref([]);

function isFormValid() {
  if(!validateTo.value || !validateData.value || value.value < 0)  // Error messages are handled by the form input validation
    throw new Error("Form is not valid");
  else if(value.value == 0 && data.value === '0x') {
    status.value= "Form is not valid";
    setTimeout(() => status.value = '', 5000);
    throw new Error("Form is not valid - advanced");
  }
}
async function addSignatureExecute() {
  await addSignaturehelper();
  collectingSignaturesExecute.value = true;
}
async function addSignaturehelper() {
  isFormValid();
  status.value = 'Adding signature...'
  try {
    const {safeTx, signer} = tx.value==null ?
      await createTransaction(props.safeAddress, to.value, value.value, data.value) :
      await collectSignature(props.safeAddress, tx.value, props.owners);
    tx.value = safeTx;
    ownersSigned.value.push(signer);
    status.value = 'Signature added';
  }
  catch(e) {
    console.error("addSignaturehelper", e);
    status.value = 'Failed to add signature: ' + truncate(e.message, 200);
  }
  finally {
    setTimeout(() => status.value = '', 10000);
  }
}
function cancelCollectingSignatures() {
  collectingSignaturesExecute.value = false;
  collectingSignaturesCancel.value = false;
  tx.value = null;
  ownersSigned.value = [];
}
async function cancelTransaction(guardAddress, txHash, timestampPos, timestamp) {
  to.value = guardAddress;
  value.value = 0;
  data.value = buildTxData('function cancelTransaction(bytes32 txHash, uint256 timestampPos, uint256 timestamp)', "cancelTransaction", [txHash, timestampPos, timestamp])
  await addSignaturehelper();
  collectingSignaturesCancel.value = true;
}
function callExecuteTransaction() {
  isFormValid();
  return sendTransaction(
    'Sending transaction...',
    'Transaction sent successfully',
    'Failed to send transaction',
    () => executeTransaction(props.safeAddress, tx.value).then(res => { cancelCollectingSignatures(); return res; })
  )
}
function callQueueTransaction() {
  isFormValid();
  return sendTransaction(
    'Queuing transaction...',
    'Transaction queued successfully',
    'Failed to queue transaction',
    () => queueTransaction(to.value, value.value, data.value)
  );
}
function sendTransaction(preStatus, postStatus, errorStatus, func) {
  status.value = preStatus;
  return func()
  .then(res => {
    console.log("sendTransaction res=", res);
    status.value = postStatus;
    to.value = '';
    value.value = 0;
    data.value = '0x';
  })
  .catch(e => {
    console.error("sendTransaction", e);
    status.value = errorStatus + ': ' + truncate(e.message, 200);
  })
  .finally(() => {
    setTimeout(() => status.value = '', 10000);
  })
}
</script>

<style scoped>
.queue-form {
  max-width: 520px;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.9rem;
  background: #000000;
}
h2 {
  margin-bottom: 0.25rem;
}
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.form-row label {
  width: 120px;
  font-weight: 500;
  margin-right: 0.5rem;
}

.form-row input,
.form-row select {
  width: 280px;
  padding: 4px 6px;
  font-size: 0.9rem;
}

.form-actions {
  text-align: center;
  align-items: center;
  margin-top: 1rem;
  display: flex;              /* Flexbox layout for horizontal alignment */
  justify-content: center;
  flex-direction: row;        /* Explicit for clarity */
  gap: 20px;                  /* Optional spacing between tables */
}

button {
  padding: 6px 16px;
  font-weight: 600;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.status {
  font-size: 0.85rem;
  color: #333;
}
</style>
