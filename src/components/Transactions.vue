<script setup>
  import myTooltip from './myTooltip.vue';
  import Copy from './Copy.vue';
  import { ref } from 'vue';
  import { executeTransaction, cancelTransaction, removeOwner } from '../composables/useSafe';
  import { addressDisplay, truncate } from "./utils.js";

  const props = defineProps({
    transactions: {
      type: Array,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    showAction: {
      type: Boolean,
      default: false
    },
    dateTitle: {
      type: String,
      required: true
    },
    dateFormatter: {
      type: Function,
      required: true
    },
    blockexplorer: {
      type: Object,
      required: true
    },
    disabled: {
      type: Function,
      default: null
    },
    canCancel: {
      type: Boolean,
      required: true
    },
    buildInProvider: {
      type: Boolean,
      required: true
    },
    owners: {
      type: Array,
      required: true
    },
    threshold: {
      type: Number,
      required: true
    }
  })
  
  const emit = defineEmits(['cancel'])
  const showSigners = ref(-1);

  function cancel(txHash, timestamp) {
    const timestampPos = props.transactions.filter(tx => tx.txHash == txHash).findIndex(tx => tx.actionDate == timestamp)
    if(props.canCancel)
      return cancelTransaction(txHash, timestampPos, timestamp);
    else
      emit('cancel', txHash, timestampPos, timestamp) 
  }
  function execute(tx) {
    return executeTransaction(tx.to, tx.value, tx.data);
  }
  function removeOwnerHelper(owner) {
    console.log("removeOwnerHelper - owner=" + owner);
    const i = props.owners.indexOf(owner);
    return removeOwner(i == 0 ? null : props.owners[i-1], owner, props.threshold);
  }
</script>

<template>
  <div>
    <h2>{{ title }}</h2>

    <div v-if="!transactions || transactions.length == 0">No transactions.</div>
    <table v-else class="transaction-table">
      <thead>
        <tr>
          <th style="white-space: nowrap;">Transaction hash</th>
          <th>To</th>
          <th style="white-space: nowrap;">Value (ETH)</th>
          <th>Data</th>
          <th>{{dateTitle}}</th>
          <th v-if="showAction">Action</th>
          <th style="width: 1%;">Signers</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(tx, txIndex) in transactions" :key="tx.txHash">
          <td style="white-space: nowrap;">
            <a :href="blockexplorer && blockexplorer.txHash.replace('\{\{txHash\}\}', tx.realHash)">{{ addressDisplay(tx.realHash) }}</a>
            <Copy :text="tx.realHash" />
          </td>
          <td style="white-space: nowrap;">
            <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', tx.to)">{{ addressDisplay(tx.to) }}</a>
            <Copy :text="tx.to" />
          </td>
          <td>{{ tx.value }}</td>
          <td style="white-space: nowrap;">{{ truncate(tx.data, 20) }}
            <Copy :text="tx.data" />
          </td>
          <td style="white-space: nowrap;">{{ dateFormatter(tx) }}
            <span v-if="showAction">
              <myTooltip v-if="disabled(tx)" emoji="❌" text="Timelock still active" />
              <myTooltip v-else emoji="✅" text="Timelock completed" />
            </span>
          </td> 
          <td v-if="showAction" style="white-space: nowrap;">
            <button style="padding: .2em" :disabled="disabled(tx)" @click="execute(tx)">Execute</button>
            <button style="padding: .2em" :disabled="!buildInProvider && !canCancel" @click="cancel(tx.txHash, tx.actionDate)">Cancel</button>
          </td>
          <td v-if="tx.signers && tx.signers.signersInfo" style="white-space: nowrap;">
            {{ tx.signers.signersInfo.length + (tx.signers.signersInfo.length>1 ? ' signers': ' signer')}}
            <myTooltip :emoji="'(' + tx.signers.quorums.threshold + '|' + tx.signers.quorums.quorumCancel + '|' + tx.signers.quorums.quorumExecute + ')'" text="(threshold|quorumCancel|quorumExecute)" />
            <myTooltip v-if="showSigners != txIndex" @click="showSigners=txIndex" icon="fa-solid fa-angle-down" text="Show the signers" />
            <myTooltip v-else @click="showSigners=-1" icon="fa-solid fa-angle-up" text="Hide the signers" />
            <span v-if="showSigners == txIndex" >
              <span v-for="{ signer } in tx.signers.signersInfo" :key="signer" :style="!owners.includes(signer) && 'background-color: #474747;' "><br>
                <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', signer)">{{ addressDisplay(signer) }}</a>
                <Copy :text="signer" />
                <myTooltip v-if="owners.includes(signer) && threshold!=owners.length" @click="removeOwnerHelper(signer)" icon="fa-solid fa-trash-can" text="Remove signer with same threshold" />
                <myTooltip v-else-if="owners.includes(signer) && threshold==owners.length" emoji="!" text="Cant remove owner without decreasing threshold - needs manual check" />
                <myTooltip v-else emoji="?" text="Not an owner anymore" />
              </span>
            </span>
          </td>
          <td v-else style="position: relative;">
            <div class="loader" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"/>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.transaction-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}
h2 {
  margin-bottom: 0.25rem;
}
.transaction-table th,
.transaction-table td {
  border: 1px solid #ccc;
  padding: 0.5rem 0.75rem;
  text-align: center;
  vertical-align: middle;
}

.transaction-table thead {
  background-color: #696969;
  font-weight: bold;
}
/* HTML: <div class="loader"></div> */
.loader {
  width: 60px;
  aspect-ratio: 6;
  background: radial-gradient(circle closest-side,#fff 90%,#0000) 0/calc(100%/3) 100% space;
  clip-path: inset(0 100% 0 0);
  animation: l1 1s steps(4) infinite;
}
@keyframes l1 {to{clip-path: inset(0 -34% 0 0)}}
</style>