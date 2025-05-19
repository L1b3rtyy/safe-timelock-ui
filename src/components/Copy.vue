<template>
  <myTooltip @click="copy()" icon="fa-solid fa-copy" text="Copy" :forcetext="copyTooltip"/>
</template>

<script setup>
  import { ref} from 'vue';
  import myTooltip from './myTooltip.vue';
  
  const props = defineProps({
    text: String
  })
  
  const copyTooltip = ref(null);
  
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
      copyTooltip.value = (successful ? "Copied": "Copy failed");
      setTimeout(() => copyTooltip.value = null, 1000);
      console.log('Copying text command was ' + (successful ? 'successful' : 'unsuccessful'));
    }
    catch (err) {
      console.error('Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  }
</script>