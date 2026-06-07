<script setup lang="ts">
defineProps({
  title: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="win-card glass-card">
    <div v-if="title" class="card-header">
      <h3>{{ title }}</h3>
      <div class="card-header-extra">
        <slot name="header-extra"></slot>
      </div>
    </div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.win-card {
  overflow: visible;
}

.card-header {
  padding: var(--prim-space-4) var(--prim-space-5);
  border-bottom: 1px solid var(--card-header-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h3 {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
}

.card-header-extra {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
}

.card-content {
  padding: var(--prim-space-5);
}
</style>