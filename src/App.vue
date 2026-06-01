<script setup lang="ts">
import {useRouter, useRoute} from 'vue-router';
import {store} from "./store/store.ts";
import WinDialogHost from "./component/WinDialogHost.vue";
import {onMounted} from 'vue';
import {useTauri} from './composables/tauri';
import {useDialog} from './composables/dialog';
import {formatError} from "./composables/logger";
import IconHome from "./component/icons/IconHome.vue";
import IconSettings from "./component/icons/IconSettings.vue";
import IconSun from "./component/icons/IconSun.vue";
import IconMoon from "./component/icons/IconMoon.vue";
import IconMonitor from "./component/icons/IconMonitor.vue";
import IconBrand from "./component/icons/IconBrand.vue";

const router = useRouter();
const route = useRoute();
const tauriImpl = useTauri();
const {showAlert} = useDialog();

const navItems = [
  {path: '/', name: 'Home', component: IconHome},
  {path: '/settings', name: 'Settings', component: IconSettings},
];

const isEditPage = () => route?.path === '/edit';

const themeIcon = () => {
  switch (store.theme) {
    case 'light':
      return IconSun;
    case 'dark':
      return IconMoon;
    default:
      return IconMonitor;
  }
};

const themeLabel = () => {
  switch (store.theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
};

const cycleTheme = () => {
  store.theme = store.theme === 'light' ? 'dark' : store.theme === 'dark' ? 'system' : 'light';
};

onMounted(async () => {
  if (!store.config) {
    console.info("ui.app.config: load start");
    try {
      store.config = await tauriImpl.loadConfig();
      console.info("ui.app.config: load complete");
    } catch (error) {
      console.error(`ui.app.config: load failed err=${formatError(error)}`);
      store.config = await tauriImpl.resetConfig();
      await showAlert('Configuration file read failed. Restored to default settings.', {
        title: 'Configuration Reset',
        tone: 'warning'
      });
    }
  }

  if (!store.pluginsInitialized) {
    console.info("ui.app.plugins: load start");
    await store.loadPlugins();
    console.info("ui.app.plugins: load complete");
  }
});
</script>

<template>
  <div class="app">
    <div v-if="!isEditPage()" class="nav-bar glass-navbar">
      <div class="nav-brand">
        <IconBrand class="brand-logo"/>
        <span class="brand-name">ExifPro</span>
      </div>
      <nav class="nav-menu">
        <button v-for="item in navItems"
                :key="item.path"
                class="nav-item glass-item"
                :class="{ active: route.path === item.path }"
                @click="router.push(item.path)"
        >
          <component :is="item.component" :size="18"/>
          <span class="nav-text">{{ item.name }}</span>
        </button>
      </nav>
      <div class="nav-spacer"></div>

      <div class="nav-theme">
        <button class="theme-toggle glass-item"
                @click="cycleTheme"
                :title="'Theme: ' + themeLabel()"
        >
          <component :is="themeIcon()" :size="18"/>
        </button>
      </div>
    </div>
    <div class="app-content">
      <router-view></router-view>
    </div>
    <WinDialogHost/>
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
  padding: 0 var(--prim-space-4);
  height: var(--navbar-height);
  flex-shrink: 0;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
  padding-right: var(--prim-space-6);
}

.brand-logo {
  color: var(--color-brand);
}

.brand-name {
  font-size: var(--prim-font-size-lg);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: var(--prim-letter-spacing-tight);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: var(--prim-space-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
  padding: 6px var(--prim-space-3);
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-base);
}

.nav-item.active {
  color: var(--color-brand);
}

.nav-text {
  font-size: var(--prim-font-size-base);
  font-weight: var(--prim-font-weight-medium);
}

.nav-spacer {
  flex: 1;
}

.theme-toggle {
  padding: 6px var(--prim-space-2);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-content {
  flex: 1;
  overflow: hidden;
}
</style>