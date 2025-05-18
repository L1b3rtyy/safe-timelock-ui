<template>
  <div class="tooltip">
    <font-awesome-icon @click="copy()" style="margin-left: 5px; cursor: pointer;" icon="fa-solid fa-copy" />
    <span class="tooltiptext" :style="'visibility:' + (copyTooltip ?  'visible;' : 'hidden;')">Copied</span>
  </div>
</template>

<script setup>
  import { ref} from 'vue';
  
  const props = defineProps({
    text: String
  })
  
  const copyTooltip = ref(false);
  
  function copy() {
    const textArea = document.createElement("textarea");
    textArea.value = props.text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      copyTooltip.value = true;
      setTimeout(() => copyTooltip.value = false, 500);
      console.log('Copying text command was ' + (successful ? 'successful' : 'unsuccessful'));
    }
    catch (err) {
      console.error('Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  }
</script>

<style scoped>
  .tooltip {
    position: relative;
    display: inline-block;
  }

  .tooltip .tooltiptext {
    position: absolute;
    z-index: 1;
    top: -17px;
    left: -10px;
    background: black;
  }
</style>