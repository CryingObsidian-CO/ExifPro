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
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <rect x="7" y="7" width="4" height="4" rx="0.5"/>
    <rect x="13" y="7" width="4" height="4" rx="0.5"/>
    <rect x="7" y="13" width="4" height="4" rx="0.5"/>
    <rect x="13" y="13" width="4" height="4" rx="0.5"/>
  </svg>
</template>