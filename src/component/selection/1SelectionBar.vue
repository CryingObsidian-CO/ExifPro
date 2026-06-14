<script setup lang="ts">
import {useI18n} from 'vue-i18n';

defineProps<{
  dirPath: string;
}>();

const {t} = useI18n();
</script>

<template>
  <div class="selection-bar glass-card">
    <span class="bar-title">{{ t('selection.title') }}</span>
    <span v-if="dirPath" class="bar-dir">{{ dirPath }}</span>
  </div>
</template>

<style scoped>
.selection-bar {
  display: flex;
  align-items: center;
  gap: var(--prim-space-3);
  padding: 0 var(--prim-space-4);
  height: 40px;
  border-radius: 0;
  border-bottom: 1px solid var(--card-header-border);
  flex-shrink: 0;
  z-index: 10;
}

.bar-title {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.bar-dir {
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
