<script setup lang="ts">
import {useI18n} from 'vue-i18n';

const {t} = useI18n();

const props = defineProps<{
  activeTab: string;
  counts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', v: string): void;
}>();

const tabs = [
  {key: 'all', icon: '⊞'},
  {key: 'passed', icon: '✓'},
  {key: 'eliminated', icon: '✗'},
  {key: 'unrated', icon: '☆'},
];
</script>

<template>
  <div class="selection-tabs">
    <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="emit('update:activeTab', tab.key)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ t('selection.tab_' + tab.key) }}</span>
      <span class="tab-count">{{ counts[tab.key] ?? 0 }}</span>
    </button>
  </div>
</template>

<style scoped>
.selection-tabs {
  display: flex;
  gap: var(--prim-space-1);
  padding: var(--prim-space-2);
  background: var(--color-glass-bg);
  border-radius: var(--prim-radius-md);
  border: 1px solid var(--card-header-border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--prim-space-1);
  padding: var(--prim-space-1) var(--prim-space-3);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: var(--prim-radius-sm);
  font-size: var(--prim-font-size-sm);
  cursor: pointer;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  white-space: nowrap;
}

.tab-btn:hover {
  background: var(--color-glass-bg-hover);
  color: var(--color-text-primary);
}

.tab-btn.active {
  background: var(--color-brand);
  color: var(--color-text-inverse);
}

.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
}

.tab-icon {
  font-size: var(--prim-font-size-sm);
  line-height: 1;
}

.tab-label {
  font-weight: var(--prim-font-weight-medium);
}

.tab-count {
  font-size: var(--prim-font-size-xs);
  font-variant-numeric: tabular-nums;
  background: var(--color-border-default);
  color: var(--color-text-tertiary);
  padding: var(--prim-space-0) var(--prim-space-1);
  border-radius: var(--prim-radius-xs);
  min-width: 18px;
  text-align: center;
  line-height: var(--prim-line-height-relaxed);
}
</style>
