import {createApp} from "vue";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import './styles/main.css';
import {initFrontendLogger} from "./composables/logger";

initFrontendLogger();

window.confirm = () => {
  const error = new Error("Please use Tauri confirm: import { confirm } from '@tauri-apps/plugin-dialog' \n If you're a user, please report this issue on GitHub and call the developers idiots");
  console.error(error);
  throw error;
};

createApp(App).use(router).use(i18n).mount("#app");
