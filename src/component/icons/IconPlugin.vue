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
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
</template>