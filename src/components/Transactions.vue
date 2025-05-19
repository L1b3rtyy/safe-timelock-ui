<script setup>
  import myTooltip from './myTooltip.vue';
  import Copy from './Copy.vue';
  import { executeTransaction, cancelTransaction } from '../composables/useSafe';

  const props = defineProps({
    transactions: Array,
    title: String,
    showAction: String,
    dateTitle: String,
    dateFormater: Function,
    blockexplorer: Object,
    disabled: Function
  })
  
  function cancel(txHash, timestamp) {
    const timestampPos = props.transactions.filter(tx => tx.txHash == txHash).findIndex(tx => tx.actiondate == timestamp)
    return cancelTransaction(txHash, timestampPos, timestamp);
  }
  function execute(tx) {
    return executeTransaction(tx.to, tx.value, tx.data);
  }
  function truncate(str, length) {
    return str && (str.length < length + 3 ? str : str.substring(0,length) + "...");
  }
  function shorten(str, length) {
    return str && (str.length < 2*length + 5 ? str : str.substring(0,length+2) + "..." + str.substring(str.length-length,str.length));
  }
</script>

<template>
  <div>
    <h2>{{ title }}</h2>

    <div v-if="!transactions || transactions.length == 0">No transactions.</div>
    <table v-else class="transaction-table">
      <thead>
        <tr>
          <th>Transaction hash</th>
          <th>To</th>
          <th>Value (ETH)</th>
          <th>Data</th>
          <th>{{dateTitle}}</th>
          <th v-if="showAction">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tx in transactions" :key="tx.txHash">
          <td>
            <a :href="blockexplorer && blockexplorer.txHash.replace('\{\{txHash\}\}', tx.realHash)">{{ shorten(tx.realHash, 8) }}</a>
            <Copy :text="tx.realHash" />
          </td>
          <td>
            <a :href="blockexplorer && blockexplorer.address.replace('\{\{address\}\}', tx.to)">{{ shorten(tx.to, 8) }}</a>
            <Copy :text="tx.to" />
          </td>
          <td>{{ tx.value }}</td>
          <td>{{ truncate(tx.data, 20) }}
            <Copy :text="tx.data" />
          </td>
          <td>{{ dateFormater(tx) }}
            <span v-if="showAction">
              <myTooltip v-if="disabled(tx)" emoji="❌" text="Timelock still active" />
              <myTooltip v-else emoji="✅" text="Timelock completed" />
            </span>
          </td> 
          <td v-if="showAction">
            <button style="padding: .2em" :disabled="disabled(tx)" @click="execute(tx)">Execute</button>
            <button style="padding: .2em" @click="cancel(tx.txHash, tx.actiondate)">Cancel</button>
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
</style>