<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="close-btn">
        <myTooltip @click="$emit('close')" emoji="x" text="Close"/>
      </div>

      <div v-for="reputation in analysis.reputations" :key="reputation.address">
        <div>Address={{ reputation.address }}</div>
        <div v-for="(alert, i) in reputation.alerts" :key="i">
          {{ alert }}
        </div>
        <br>
      </div>
    </div>
  </div>
</template>

<script setup>
  import myTooltip from './myTooltip.vue';
  const props = defineProps({
    analysis: {
      type: Object,
      required: true
    }
  });

  defineEmits(['close']);

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
</style>
