<script setup lang="ts">
defineProps<{ size?: number }>();
</script>

<template>
  <svg
      :width="size || 24"
      :height="size || 24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</template>