<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted, watch, nextTick} from 'vue';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  default?: boolean;
}

const props = defineProps<{
  modelValue: string;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const panelRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const activeIdx = ref(-1);
const hasDefaulted = ref(false);

const uid = `ws-${Math.random().toString(36).slice(2, 9)}`;
const panelId = `${uid}-panel`;
const getOptionId = (idx: number) => `${uid}-opt-${idx}`;

const activeDescendantId = computed(() => {
  if (!open.value || activeIdx.value < 0) return undefined;
  return getOptionId(activeIdx.value);
});

const selectedLabel = computed(() => {
  const found = props.options.find(o => o.value === props.modelValue);
  return found ? found.label : '';
});

const clampActive = (idx: number) => {
  const opts = props.options;
  const len = opts.length;
  if (len === 0) return -1;
  let clamped = Math.max(0, Math.min(idx, len - 1));
  if (opts[clamped]?.disabled) {
    const dir = idx >= (activeIdx.value >= 0 ? activeIdx.value : 0) ? 1 : -1;
    let found = -1;
    for (let i = clamped; i >= 0 && i < len; i += dir) {
      if (!opts[i].disabled) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      const rev = dir === 1 ? -1 : 1;
      for (let i = clamped; i >= 0 && i < len; i += rev) {
        if (!opts[i].disabled) {
          found = i;
          break;
        }
      }
    }
    clamped = Math.max(0, found);
  }
  return clamped;
};

const toggle = () => {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    activeIdx.value = clampActive(props.options.findIndex(o => o.value === props.modelValue));
  }
};

const select = (value: string) => {
  emit('update:modelValue', value);
  open.value = false;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.disabled) return;
  const opts = props.options;
  const len = opts.length;

  if (!open.value) {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      open.value = true;
      activeIdx.value = clampActive(opts.findIndex(o => o.value === props.modelValue));
    }
    return;
  }

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      open.value = false;
      break;
    case 'ArrowDown':
      e.preventDefault();
      activeIdx.value = clampActive(activeIdx.value + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIdx.value = clampActive(activeIdx.value - 1);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (activeIdx.value >= 0 && activeIdx.value < len && !opts[activeIdx.value].disabled) {
        select(opts[activeIdx.value].value);
      }
      break;
    case 'Tab':
      open.value = false;
      break;
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (!open.value) return;
  const target = e.target as Node;
  const trigger = triggerRef.value;
  const panel = panelRef.value;
  if (trigger && panel && !trigger.contains(target) && !panel.contains(target)) {
    open.value = false;
  }
};

const handleFocusOut = (e: FocusEvent) => {
  if (!open.value) return;
  const related = e.relatedTarget as Node | null;
  if (related && triggerRef.value?.contains(related)) return;
  open.value = false;
};

watch(() => props.disabled, (val) => {
  if (val) open.value = false;
});

watch(() => props.options, (opts) => {
  if (open.value && props.modelValue) {
    activeIdx.value = opts.findIndex(o => o.value === props.modelValue);
  }
  if (!hasDefaulted.value && opts.length > 0) {
    hasDefaulted.value = true;
    if (props.placeholder) {
      if (props.modelValue) {
        nextTick(() => emit('update:modelValue', ''));
      }
    } else {
      const def = opts.find(o => o.default && !o.disabled);
      const val = (def ?? opts.find(o => !o.disabled) ?? opts[0]).value;
      if (val !== props.modelValue) {
        nextTick(() => emit('update:modelValue', val));
      }
    }
  }
}, {immediate: true});

watch(activeIdx, (idx) => {
  nextTick(() => {
    if (idx >= 0 && open.value) {
      document.getElementById(getOptionId(idx))?.scrollIntoView({block: 'nearest'});
    }
  });
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
});
</script>

<template>
  <div
      ref="triggerRef"
      class="win-select"
      :class="{ open, disabled }"
      :tabindex="disabled ? -1 : 0"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :aria-activedescendant="activeDescendantId"
      :aria-disabled="disabled"
      @click="toggle"
      @keydown="handleKeydown"
      @focusout="handleFocusOut"
  >
    <div class="select-trigger">
      <span
          class="select-text"
          :class="{ placeholder: !selectedLabel }"
      >
        {{ selectedLabel || placeholder }}
      </span>
      <svg
          class="select-arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>

    <Transition name="dropdown">
      <div v-if="open" ref="panelRef" :id="panelId" role="listbox" class="select-panel">
        <button
            v-for="(opt, idx) in options"
            :key="opt.value"
            :id="getOptionId(idx)"
            role="option"
            class="select-option"
            :class="{
            selected: opt.value === modelValue && !opt.disabled,
            active: idx === activeIdx,
            placeholder: opt.disabled
          }"
            :disabled="opt.disabled"
            :tabindex="-1"
            :aria-selected="opt.value === modelValue && !opt.disabled"
            :aria-disabled="opt.disabled"
            @click.stop="!opt.disabled && select(opt.value)"
            @mouseenter="activeIdx = idx"
            type="button"
        >
          <span class="option-check">
            <svg v-if="opt.value === modelValue && !opt.disabled"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="3"
                 stroke-linecap="round"
                 stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <span class="option-label">{{ opt.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.win-select {
  position: relative;
  cursor: pointer;
  outline: none;
  user-select: none;
}

.win-select.disabled {
  opacity: var(--prim-opacity-40);
  pointer-events: none;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--prim-space-2);
  padding: 7px var(--prim-space-3);
  border-radius: var(--prim-radius-md);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--input-text);
  font-size: var(--prim-font-size-base);
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
}

.win-select:not(.disabled):hover .select-trigger {
  border-color: var(--input-border-hover);
  background: var(--input-bg-focus);
}

.win-select:not(.disabled).open .select-trigger {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}

.win-select:focus-visible .select-trigger {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}

.select-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-text.placeholder {
  color: var(--input-placeholder);
}

.select-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: transform var(--prim-duration-fast) var(--prim-ease-out);
}

.open .select-arrow {
  transform: rotate(180deg);
}

.select-panel {
  position: absolute;
  top: calc(100% + var(--prim-space-1));
  left: 0;
  right: 0;
  z-index: var(--prim-z-dropdown);
  background: var(--color-bg-surface-raised);
  border: 1px solid var(--color-border-default);
  border-radius: var(--prim-radius-md);
  box-shadow: var(--prim-shadow-lg);
  padding: var(--prim-space-1);
  max-height: 240px;
  overflow-y: auto;
  backdrop-filter: blur(var(--prim-glass-blur-md));
  -webkit-backdrop-filter: blur(var(--prim-glass-blur-md));
}

.select-option {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
  width: 100%;
  padding: 6px var(--prim-space-3);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--prim-font-size-base);
  border-radius: var(--prim-radius-sm);
  cursor: pointer;
  text-align: left;
  transition: background var(--prim-duration-fast) var(--prim-ease-out);
}

.select-option:hover,
.select-option.active {
  background: var(--color-brand-light);
}

.select-option.selected {
  color: var(--color-brand);
  font-weight: var(--prim-font-weight-medium);
}

.select-option.placeholder {
  color: var(--color-text-tertiary);
  font-style: italic;
  cursor: default;
  opacity: var(--prim-opacity-62);
}

.select-option.placeholder:hover {
  background: transparent;
}

.option-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-brand);
}

.option-check svg {
  width: 100%;
  height: 100%;
}

.option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--prim-duration-fast) var(--prim-ease-out), transform var(--prim-duration-fast) var(--prim-ease-out);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>