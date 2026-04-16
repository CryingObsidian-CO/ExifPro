<script setup lang="ts">
import {useRouter, useRoute} from 'vue-router';
import {store} from "./store/store.ts";
import WinDialogHost from "./component/WinDialogHost.vue";


const router = useRouter();
const route = useRoute();

const navItems = [
  {path: '/', name: '首页', icon: '🏠'},
  {path: '/settings', name: '设置', icon: '⚙️'},
];

const isEditPage = () => route?.path === '/edit';
</script>

<template>
  <div class="app">
    <div v-if="!isEditPage()" class="nav-bar">
      <div class="nav-brand">
        <span class="brand-icon">📸</span>
        <span class="brand-name">ExifPro</span>
      </div>
      <nav class="nav-menu">
        <button v-for="item in navItems"
                :key="item.path"
                class="nav-item"
                :class="{ active: route.path === item.path }"
                @click="router.push(item.path)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.name }}</span>
        </button>
      </nav>
      <div class="nav-spacer"></div>

      <div class="nav-theme">
        <button class="theme-toggle"
                @click="store.theme = store.theme === 'light' ? 'dark' : store.theme === 'dark' ? 'system' : 'light'"
                :title="'当前主题: ' + store.theme"
        >
          {{ store.theme === 'light' ? '☀️' : store.theme === 'dark' ? '🌙' : '💻' }}
        </button>
      </div>
    </div>
    <div class="app-content">
      <router-view></router-view>
    </div>
    <WinDialogHost />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-bar {
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 50px;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 24px;
}

.brand-icon {
  font-size: 20px;
}

.brand-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--border-radius);
  background-color: transparent;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.nav-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.nav-item.active {
  background-color: var(--color-accent-light);
  color: var(--color-accent);
}

.nav-icon {
  font-size: 16px;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

.nav-spacer {
  flex: 1;
}

.theme-toggle {
  padding: 8px 12px;
  border-radius: var(--border-radius);
  background-color: transparent;
  font-size: 18px;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  background-color: var(--color-bg-tertiary);
}

.app-content {
  flex: 1;
  overflow: hidden;
}
</style>