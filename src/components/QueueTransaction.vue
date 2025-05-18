<template>
  <div>
    <h2>Queue Transaction</h2>

    <form class="queue-form" @submit.prevent="callQueueTransaction()">
      <div class="form-row">
        <label>To:</label>
        <input v-model="to" type="text" required class="wide" />
      </div>

      <div class="form-row">
        <label>Value (ETH):</label>
        <input v-model.number="value" type="number" step="any" class="narrow" />
      </div>

      <div class="form-row">
        <label>Data (hex):</label>
        <input v-model="data" type="text" required class="wide" />
      </div>

      <div class="form-actions">
        <button type="submit">Queue</button>
      </div>
      <span v-if="status">{{ status }}</span>
    </form>
  </div>
</template>

<script setup>
import { queueTransaction } from "../composables/useSafe.js"
import { ref } from 'vue'

const to = ref('')
const value = ref(0)
const data = ref('0x')
const status = ref(null)

function callQueueTransaction() {
  status.value = 'Preparing transaction...'
  return queueTransaction(to.value, value.value, data.value)
  .then(hash => {
    status.value = "Transaction submitted: " + hash;
    setTimeout(() => status.value = '', 10000);
  })
  .catch(e => {
    console.error("callQueueTransaction", e);
    status.value = 'Failed to queue transaction: ' + e.message;
  })
  .finally(() => {
    to.value = '';
    value.value = 0;
    data.value = '0x';
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
  margin-top: 1rem;
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
