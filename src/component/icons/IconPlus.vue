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
    <path d="M12 5v14M5 12h14"/>
  </svg>
</template>