<script setup>
  import myTooltip from './myTooltip.vue';
  import Copy from './Copy.vue';
  import { ref } from 'vue';
  import { executeTransaction, cancelTransaction } from '../composables/useSafe';
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
      default: false
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
            <button style="padding: .2em" @click="cancel(tx.txHash, tx.actionDate)">Cancel</button>
          </td>
          <td v-if="tx.signers && tx.signers.signersInfo" style="white-space: nowrap;">
            {{ tx.signers.signersInfo.length + (tx.signers.signersInfo.length>1 ? ' signers': ' signer')}}
            <myTooltip :emoji="'(' + tx.signers.quorums.threshold + '|' + tx.signers.quorums.quorumCancel + '|' + tx.signers.quorums.quorumExecute + ')'" text="(threshold|quorumCancel|quorumExecute)" />
            <myTooltip v-if="showSigners != txIndex" @click="showSigners=txIndex" icon="fa-solid fa-angle-down" text="Show the signers" />
            <myTooltip v-else @click="showSigners=-1" icon="fa-solid fa-angle-up" text="Hide the signers" />
            <span v-if="showSigners == txIndex" >
              <span v-for="{ signer } in tx.signers.signersInfo" :key="signer"><br>
                <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', signer)">{{ addressDisplay(signer) }}</a>
                <Copy :text="signer" />
              </span>
            </span>
          </td>
          <td v-else>...</td>
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
</style>