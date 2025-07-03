<template>
  <div class="tooltip" :style="'margin-left: ' + margin + ';' + (hasClick && 'cursor: pointer;')">
    <font-awesome-icon v-if="icon" :icon="icon" />
    <span v-else>{{ emoji }}</span>
    <span v-if="forcetext || text" :style="forcetext && 'visibility: visible;'" class="tooltiptext">{{ forcetext || text }}</span>
  </div>
</template>

<script setup>  
  import { onMounted, getCurrentInstance, ref } from 'vue';

  const hasClick = ref(false);

  onMounted(() => {
    const instance = getCurrentInstance();
    hasClick.value = !!instance?.vnode?.props?.onClick;
  });

  const props = defineProps({
    margin: {
      type: String,
      default: '3px'
    },
    icon: {
      type: String,
      default: null
    },
    emoji: {
      type: String,
      default: null
    },
    text: {
      type: String,
      required: true
    },
    forcetext: {
      type: String,
      default: null
    }
  })
</script>

<style>
/* Tooltip container */
.tooltip {
  position: relative;
  display: inline-block;
}

/* Tooltip text */
.tooltip .tooltiptext {
  visibility: hidden;
  background-color: black;
  color: #fff;
  text-align: center;
  padding: 2px 5px;
  border-radius: 6px;
  white-space: normal;
 
  /* Position the tooltip text */
  width: max-content;
  max-width: 150px;
  bottom: 90%; /* above the icon */
  left: 50%;
  transform: translateX(-50%);
  position: absolute;
  z-index: 1;
}

/* Show the tooltip text when you mouse over the tooltip container */
.tooltip:hover .tooltiptext {
  visibility: visible;
}
</style>