<script setup lang="ts">
defineProps({
  title: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="win-card">
    <div v-if="title" class="card-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.win-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  overflow: visible;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.card-content {
  padding: 20px;
}
</style>