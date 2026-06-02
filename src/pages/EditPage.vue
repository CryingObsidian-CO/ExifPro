<script setup lang="ts">
import {store} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import {useRouter} from "vue-router";
import {useI18n} from 'vue-i18n';
import {useTauri} from "../composables/tauri.ts";
import WinCard from "../component/WinCard.vue";
import {ExifInfo, Group, GroupType} from "../types/photo.ts";
import {computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect} from "vue";
import {useDialog} from "../composables/dialog.ts";
import {pluginManager} from "../composables/pluginManager.ts";
import type {GroupActionDeclaration, ImageActionDeclaration} from "../types/plugin.ts";
import {formatError} from "../composables/logger";
import IconSave from "../component/icons/IconSave.vue";
import IconUndo from "../component/icons/IconUndo.vue";
import IconPlus from "../component/icons/IconPlus.vue";
import IconMove from "../component/icons/IconMove.vue";
import IconMerge from "../component/icons/IconMerge.vue";
import IconEdit from "../component/icons/IconEdit.vue";
import IconTrash from "../component/icons/IconTrash.vue";
import IconClose from "../component/icons/IconClose.vue";
import IconMinimize from "../component/icons/IconMinimize.vue";
import IconMaximize from "../component/icons/IconMaximize.vue";
import IconImage from "../component/icons/IconImage.vue";
import IconPlugin from "../component/icons/IconPlugin.vue";
import {getCurrentWindow} from '@tauri-apps/api/window';

const router = useRouter();
const tauriImpl = useTauri();
const {showAlert, showConfirm} = useDialog();
const {t} = useI18n();

const appWindow = getCurrentWindow();

const handleMinimize = () => {
  appWindow.minimize();
};

const handleMaximize = () => {
  appWindow.toggleMaximize();
};

const handleClose = () => {
  appWindow.close();
};

const selectedGroupIds = ref<string[]>([]);
const selectedPhotos = ref<ExifInfo[]>([]);
const selectedPhotoKeys = ref<string[]>([]);
const detailPhoto = ref<ExifInfo | null>(null);
const lastAnchorPhotoKey = ref<string | null>(null);
const renamingGroupId = ref<string | null>(null);
const newGroupName = ref('');

const mainContentRef = ref<HTMLElement | null>(null);
const photosGridRef = ref<HTMLElement | null>(null);
const detailDialogRef = ref<HTMLElement | null>(null);
let lastFocusedBeforeDetail: HTMLElement | null = null;
const selectionBox = ref({
  visible: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
});

type DragSelectState = {
  pointerId: number;
  startX: number;
  startY: number;
  additive: boolean;
  baseSelection: Set<string>;
  dragging: boolean;
};

const dragSelectState = ref<DragSelectState | null>(null);

const thumbnailCache = reactive<Record<string, string | null>>({});
const loadingSet = reactive<Set<string>>(new Set());
const detailLoadingSet = reactive<Set<string>>(new Set());
const detailThumbnail = ref<string | null>(null);
let thumbnailObserver: IntersectionObserver | null = null;

const isDetailLoading = computed(() => {
  const key = detailPhoto.value?.file_path;
  return key ? detailLoadingSet.has(key) : false;
});

function setupThumbnailObserver() {
  thumbnailObserver?.disconnect();
  for (const key in thumbnailCache) {
    delete thumbnailCache[key];
  }

  const container = mainContentRef.value;
  if (!container) return;

  thumbnailObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.photoKey;
          if (!key) continue;

          if (entry.isIntersecting) {
            if (!(key in thumbnailCache) && !loadingSet.has(key)) {
              loadThumbnail(key, 'small');
            }
          } else {
            if (key in thumbnailCache && thumbnailCache[key] !== null) {
              delete thumbnailCache[key];
            }
          }
        }
      },
      {
        root: container,
        rootMargin: '300px',
        threshold: 0,
      }
  );

  const grid = photosGridRef.value || container;
  const elements = grid.querySelectorAll<HTMLElement>('.photo-thumb[data-photo-key]');
  for (const el of elements) {
    thumbnailObserver.observe(el);
  }
}

async function loadThumbnail(filePath: string, level: 'small' | 'large') {
  if (loadingSet.has(filePath)) return;
  loadingSet.add(filePath);
  try {
    thumbnailCache[filePath] = await tauriImpl.getThumbnail(filePath, level);
  } catch {
    thumbnailCache[filePath] = null;
  } finally {
    loadingSet.delete(filePath);
  }
}

function getGroupTypeLabel(type: GroupType) {
  const labels: Partial<Record<GroupType, string>> = {
    FocusBracketing: t('edit.group_type.focus_bracket'),
    AEB: t('edit.group_type.aeb'),
    Burst: t('edit.group_type.burst'),
    Single: t('edit.group_type.single'),
  };
  return labels[type] || type;
}

function getGroupTypeColor(type: GroupType) {
  const colors: Record<GroupType, string> = {
    FocusBracketing: 'var(--color-focus-bracketing)',
    AEB: 'var(--color-aeb)',
    Burst: 'var(--color-burst)',
    Single: 'var(--color-single)',
  };
  return colors[type];
}

function getPluginGroupActions(groupType: GroupType): GroupActionDeclaration[] {
  if (!pluginManager.isInitialized) return [];
  return pluginManager.getGroupActions(groupType);
}

function getPluginImageActions(groupType: GroupType): ImageActionDeclaration[] {
  if (!pluginManager.isInitialized) return [];
  return pluginManager.getImageActions(groupType);
}

async function handlePluginGroupAction(action: GroupActionDeclaration, group: Group) {
  console.info(`ui.edit.plugin_group_action: start id=${action.id} group=${group.id}`);
  try {
    await pluginManager.emitGroupAction(action.id, group);
    console.info(`ui.edit.plugin_group_action: complete id=${action.id} group=${group.id}`);
  } catch (error) {
    console.error(`ui.edit.plugin_group_action: failed id=${action.id} group=${group.id} err=${formatError(error)}`);
    throw error;
  }
}

async function handlePluginImageAction(action: ImageActionDeclaration, photo: ExifInfo) {
  console.info(`ui.edit.plugin_image_action: start id=${action.id} photo=${photo.file_path}`);
  try {
    await pluginManager.emitImageAction(action.id, photo);
    console.info(`ui.edit.plugin_image_action: complete id=${action.id} photo=${photo.file_path}`);
  } catch (error) {
    console.error(`ui.edit.plugin_image_action: failed id=${action.id} photo=${photo.file_path} err=${formatError(error)}`);
    throw error;
  }
}

function toggleGroupSelection(groupId: string) {
  const index = selectedGroupIds.value.indexOf(groupId);
  if (index === -1) {
    selectedGroupIds.value.push(groupId);
  } else {
    selectedGroupIds.value.splice(index, 1);
  }
}

function getPhotoCatalog() {
  const keys: string[] = [];
  const byKey = new Map<string, ExifInfo>();
  for (const group of store.groups) {
    for (const photo of group.photos) {
      keys.push(photo.file_path);
      byKey.set(photo.file_path, photo);
    }
  }
  return {keys, byKey};
}

function applyPhotoSelection(keys: Iterable<string>) {
  const uniqueKeys = Array.from(new Set(keys));
  selectedPhotoKeys.value = uniqueKeys;
  const {byKey} = getPhotoCatalog();
  selectedPhotos.value = uniqueKeys
  .map((key) => byKey.get(key))
  .filter((photo): photo is ExifInfo => Boolean(photo));
}

function clearPhotoSelection() {
  applyPhotoSelection([]);
  lastAnchorPhotoKey.value = null;
}

function isPhotoSelected(photoKey: string) {
  return selectedPhotoKeys.value.includes(photoKey);
}

function stripWrappingQuotes(value: string) {
  let text = value.trim();
  while (
      text.length >= 2
      && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
      ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function toCleanText(value?: string | number) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = stripWrappingQuotes(String(value));
  return text.trim();
}

function displayValue(value?: string | number) {
  const text = toCleanText(value);
  return text.length > 0 ? text : t('common.no_value');
}

function formatWithUnit(value: string | number | undefined, unit: string) {
  const text = toCleanText(value);
  if (!text) {
    return t('common.no_value');
  }
  const lowerText = text.toLowerCase();
  const lowerUnit = unit.toLowerCase();
  if (lowerText.includes(lowerUnit)) {
    return text;
  }
  return `${text} ${unit}`;
}

function formatAperture(value: string | undefined) {
  const text = toCleanText(value);
  if (!text) {
    return t('common.no_value');
  }
  if (/^f\s*\//i.test(text)) {
    return text;
  }
  return `f/${text}`;
}

function formatIso(value: string | undefined) {
  const text = toCleanText(value);
  if (!text) {
    return t('common.no_value');
  }
  if (/^iso\s*/i.test(text)) {
    return text;
  }
  return `ISO ${text}`;
}

function formatExposureMode(value?: number) {
  if (value === undefined || value === null) {
    return t('common.no_value');
  }
  const labels: Record<number, string> = {
    0: t('edit.exposure_mode.auto'),
    1: t('edit.exposure_mode.manual'),
    2: t('edit.exposure_mode.auto_bracket'),
  };
  return labels[value] ?? t('edit.exposure_mode.unknown', {value});
}

function getSubSecondDigits() {
  const raw = store.config?.sub_second_digits;
  const value = Number.isFinite(raw) ? raw as number : 3;
  return Math.min(9, Math.max(0, value));
}

function formatCaptureTime(photo: ExifInfo) {
  const captureTime = toCleanText(photo.capture_time);
  const subSecond = toCleanText(photo.sub_time).replace(/^\.+/, '');
  const offsetTime = toCleanText(photo.offset_time_original);
  if (!captureTime) {
    return t('common.no_value');
  }

  const digits = getSubSecondDigits();
  const normalizedSubSecond = digits > 0 && subSecond
      ? subSecond.padEnd(digits, '0').slice(0, digits)
      : '';
  const withSubSecond = normalizedSubSecond ? `${captureTime}.${normalizedSubSecond}` : captureTime;
  return offsetTime ? `${withSubSecond} ${offsetTime}` : withSubSecond;
}

function openPhotoDetail(photo: ExifInfo) {
  lastFocusedBeforeDetail = document.activeElement as HTMLElement | null;
  detailPhoto.value = photo;
  detailThumbnail.value = null;
  loadDetailThumbnail(photo.file_path);
  nextTick(() => {
    const closeBtn = detailDialogRef.value?.querySelector<HTMLElement>('button');
    closeBtn?.focus();
  });
}

async function loadDetailThumbnail(filePath: string) {
  if (detailLoadingSet.has(filePath)) return;
  detailLoadingSet.add(filePath);
  try {
    const data = await tauriImpl.getThumbnail(filePath, 'large');
    if (detailPhoto.value?.file_path === filePath) {
      detailThumbnail.value = data;
    }
  } catch {
    if (detailPhoto.value?.file_path === filePath) {
      detailThumbnail.value = null;
    }
  } finally {
    detailLoadingSet.delete(filePath);
  }
}

function closePhotoDetail() {
  detailPhoto.value = null;
  detailThumbnail.value = null;
  if (lastFocusedBeforeDetail && typeof lastFocusedBeforeDetail.focus === 'function') {
    lastFocusedBeforeDetail.focus();
  }
  lastFocusedBeforeDetail = null;
}

function handleDetailKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;

  const dialog = detailDialogRef.value;
  if (!dialog) return;

  const selectors = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selectors.join(','))).filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !dialog.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && detailPhoto.value) {
    closePhotoDetail();
  }
}

function getRangeSelection(targetKey: string) {
  const {keys} = getPhotoCatalog();
  const anchorKey = lastAnchorPhotoKey.value ?? targetKey;
  const start = keys.indexOf(anchorKey);
  const end = keys.indexOf(targetKey);
  if (start === -1 || end === -1) {
    return [targetKey];
  }

  const [left, right] = start <= end ? [start, end] : [end, start];
  return keys.slice(left, right + 1);
}

function selectPhoto(photo: ExifInfo, isToggle: boolean, isRange: boolean) {
  const key = photo.file_path;

  if (isRange) {
    const rangeKeys = getRangeSelection(key);
    if (isToggle) {
      const merged = new Set([...selectedPhotoKeys.value, ...rangeKeys]);
      applyPhotoSelection(merged);
    } else {
      applyPhotoSelection(rangeKeys);
    }
    lastAnchorPhotoKey.value = key;
    return;
  }

  if (isToggle) {
    const next = new Set(selectedPhotoKeys.value);
    next.has(key) ? next.delete(key) : next.add(key);
    applyPhotoSelection(next);
    lastAnchorPhotoKey.value = key;
    return;
  }
  applyPhotoSelection([key]);
  lastAnchorPhotoKey.value = key;
}

function handlePhotoClick(photo: ExifInfo, event: MouseEvent) {
  const isToggle = event.ctrlKey || event.metaKey;
  const isRange = event.shiftKey;
  selectPhoto(photo, isToggle, isRange);

  // 点击时也将焦点移到该图片，确保键盘导航从正确位置开始
  const target = event.currentTarget as HTMLElement;
  target?.focus();
}

function handlePhotoKeyDown(photo: ExifInfo, event: KeyboardEvent) {
  // NOTE 对于因为系统级快捷键导致的阻挡问题 (ctrl + space) ，可以通过按下其他按键解决，如 (ctrl + alt + space)
  const isToggle = event.ctrlKey || event.metaKey;
  const isRange = event.shiftKey;
  selectPhoto(photo, isToggle, isRange);
}

function rectanglesIntersect(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function getIntersectedPhotoKeys(selectionRect: DOMRect) {
  const root = photosGridRef.value;
  if (!root) {
    return [];
  }

  const elements = root.querySelectorAll<HTMLElement>('.photo-thumb[data-photo-key]');
  const keys: string[] = [];
  for (const element of elements) {
    const key = element.dataset.photoKey;
    if (!key) {
      continue;
    }

    if (rectanglesIntersect(selectionRect, element.getBoundingClientRect())) {
      keys.push(key);
    }
  }
  return keys;
}

function updateSelectionBox(clientX: number, clientY: number) {
  const container = mainContentRef.value;
  if (!container) {
    return;
  }

  const state = dragSelectState.value;
  if (!state) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const left = Math.min(state.startX, clientX);
  const right = Math.max(state.startX, clientX);
  const top = Math.min(state.startY, clientY);
  const bottom = Math.max(state.startY, clientY);

  selectionBox.value = {
    visible: true,
    left: left - containerRect.left + container.scrollLeft,
    top: top - containerRect.top + container.scrollTop,
    width: right - left,
    height: bottom - top,
  };
}

function handleMainContentPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  if ((event.target as HTMLElement)?.closest('.photo-thumb')) {
    return;
  }

  const container = mainContentRef.value;
  if (!container) {
    return;
  }

  dragSelectState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    additive: event.ctrlKey || event.metaKey,
    baseSelection: new Set(selectedPhotoKeys.value),
    dragging: false,
  };

  container.setPointerCapture(event.pointerId);
}

function handleMainContentPointerMove(event: PointerEvent) {
  const state = dragSelectState.value;
  if (!state || event.pointerId !== state.pointerId) {
    return;
  }

  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  if (!state.dragging && Math.hypot(dx, dy) < 4) {
    return;
  }

  state.dragging = true;
  updateSelectionBox(event.clientX, event.clientY);

  const selectionRect = new DOMRect(
      Math.min(state.startX, event.clientX),
      Math.min(state.startY, event.clientY),
      Math.abs(event.clientX - state.startX),
      Math.abs(event.clientY - state.startY)
  );
  const intersected = getIntersectedPhotoKeys(selectionRect);
  const selection = state.additive
      ? new Set([...state.baseSelection, ...intersected])
      : intersected;
  applyPhotoSelection(selection);
}

function finishDragSelection(pointerId: number) {
  const state = dragSelectState.value;
  if (!state || state.pointerId !== pointerId) {
    return;
  }

  if (state.dragging && selectedPhotoKeys.value.length > 0) {
    lastAnchorPhotoKey.value = selectedPhotoKeys.value[selectedPhotoKeys.value.length - 1];
  }

  const container = mainContentRef.value;
  if (container?.hasPointerCapture(pointerId)) {
    container.releasePointerCapture(pointerId);
  }

  dragSelectState.value = null;
  selectionBox.value.visible = false;
}

function handleMainContentPointerUp(event: PointerEvent) {
  finishDragSelection(event.pointerId);
}

function handleMainContentPointerCancel(event: PointerEvent) {
  finishDragSelection(event.pointerId);
}

watch(() => store.groups.length, () => {
  const groupIds = new Set(store.groups.map((group) => group.id));
  const filtered = selectedGroupIds.value.filter((id) => groupIds.has(id));
  if (filtered.length !== selectedGroupIds.value.length) {
    selectedGroupIds.value = filtered;
  }
  if (renamingGroupId.value && !groupIds.has(renamingGroupId.value)) {
    renamingGroupId.value = null;
    newGroupName.value = '';
  }
});

watchEffect(() => {
  const {keys} = getPhotoCatalog();
  const validKeys = new Set(keys);
  const filtered = selectedPhotoKeys.value.filter((key) => validKeys.has(key));
  if (filtered.length !== selectedPhotoKeys.value.length) {
    applyPhotoSelection(filtered);
  }
  if (lastAnchorPhotoKey.value && !validKeys.has(lastAnchorPhotoKey.value)) {
    lastAnchorPhotoKey.value = null;
  }
  if (detailPhoto.value && !validKeys.has(detailPhoto.value.file_path)) {
    detailPhoto.value = null;
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown);
  nextTick(() => setupThumbnailObserver());
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
  thumbnailObserver?.disconnect();
});

watch(
    () => store.groups,
    () => nextTick(() => setupThumbnailObserver()),
    {deep: true}
);

function startRenaming(group: Group) {
  console.info(`ui.edit.rename: start group=${group.id}`);
  renamingGroupId.value = group.id;
  newGroupName.value = group.name;
}

async function handleBlur() {
  if (!renamingGroupId.value) {
    return;
  }

  if (!await showConfirm(t('edit.save_group_name'), {
    title: t('edit.confirm_rename'),
    tone: 'warning',
    confirmText: t('edit.confirm_save'),
    cancelText: t('common.cancel'),
  })) {
    cancelRenaming();
    return;
  }
  finishRenaming();
}

function cancelRenaming() {
  console.info("ui.edit.rename: cancel");
  renamingGroupId.value = null;
  newGroupName.value = '';
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

function finishRenaming() {
  if (renamingGroupId.value === 'ungrouped') {
    console.warn("ui.edit.rename: rejected reason=ungrouped");
    showAlert(t('edit.cannot_rename_ungrouped'), {
      title: t('edit.invalid_operation'),
      tone: 'warning'
    });
    return;
  }

  if (renamingGroupId.value && newGroupName.value.trim()) {
    console.info(`ui.edit.rename: complete group=${renamingGroupId.value} name=${newGroupName.value.trim()}`);
    store.updateGroup(renamingGroupId.value, {name: newGroupName.value.trim()});
  }

  renamingGroupId.value = null;
  newGroupName.value = '';
}

async function disbandGroup(groupId: string) {
  if (groupId === 'ungrouped') {
    console.warn("ui.edit.disband_group: rejected reason=ungrouped");
    await showAlert(t('edit.cannot_disband_ungrouped'), {
      title: t('edit.invalid_operation'),
      tone: 'warning'
    });
    return;
  }

  const group = store.findGroup(groupId);
  if (!group) return;

  if (await showConfirm(t('edit.disband_confirm', {name: group.name}), {
    title: t('edit.confirm_disband'),
    tone: 'warning',
    confirmText: t('edit.confirm_disband_btn'),
    cancelText: 'Cancel',
  })) {
    console.info(`ui.edit.disband_group: confirmed group=${group.id} name=${group.name}`);
    if (!store.disbandGroup(groupId)) {
      await showAlert(t('edit.disband_failed'), {title: t('edit.operation_failed'), tone: 'error'});
      return;
    }
    clearPhotoSelection();
  } else {
    console.info(`ui.edit.disband_group: canceled group=${group.id}`);
  }
}

async function createGroupFromSelected() {
  if (selectedPhotos.value.length === 0) {
    console.warn("ui.edit.create_group: rejected reason=no_selection");
    await showAlert(t('edit.select_photos_first'), {
      title: t('edit.no_photos_selected'),
      tone: 'warning'
    });
    return;
  }
  const name = prompt(t('edit.group_name_prompt'), t('edit.new_group_default'));
  if (name) {
    console.info(`ui.edit.create_group: confirmed name=${name} photos=${selectedPhotos.value.length}`);
    const newGroup = store.createGroup(name);
    if (!newGroup) {
      await showAlert(t('edit.create_group_failed'), {
        title: t('edit.operation_failed'),
        tone: 'error'
      });
      return;
    }
    store.movePhotoToGroup(selectedPhotos.value, newGroup.id);
    clearPhotoSelection();
  } else {
    console.info("ui.edit.create_group: canceled");
  }
}

async function moveSelectedToGroup() {
  if (selectedPhotos.value.length === 0) {
    console.warn("ui.edit.move_photos: rejected reason=no_selection");
    await showAlert(t('edit.select_photos_first'), {
      title: t('edit.no_photos_selected'),
      tone: 'warning'
    });
    return;
  }

  const targetGroupId = prompt(t('edit.target_group_id'));
  if (!targetGroupId) {
    console.info("ui.edit.move_photos: canceled");
    return;
  }

  const targetGroup = store.findGroup(targetGroupId);
  if (!targetGroup) {
    console.warn(`ui.edit.move_photos: rejected reason=group_not_found id=${targetGroupId}`);
    await showAlert(t('edit.target_group_not_found'), {
      title: t('edit.group_not_found'),
      tone: 'error'
    });
    return;
  }

  console.info(`ui.edit.move_photos: start photos=${selectedPhotos.value.length} target=${targetGroupId}`);
  store.movePhotoToGroup(selectedPhotos.value, targetGroupId);
  clearPhotoSelection();
}

async function mergeSelectedGroups() {
  if (selectedGroupIds.value.length < 2) {
    console.warn("ui.edit.merge_groups: rejected reason=insufficient_selection");
    await showAlert(t('edit.select_two_groups'), {
      title: t('edit.insufficient_selection'),
      tone: 'warning'
    });
    return;
  }

  if (selectedGroupIds.value.includes('ungrouped')) {
    console.warn("ui.edit.merge_groups: rejected reason=includes_ungrouped");
    await showAlert(t('edit.cannot_merge_ungrouped'), {
      title: t('edit.invalid_operation'),
      tone: 'warning'
    });
    return;
  }

  const name = prompt(t('edit.new_group_name_prompt'), t('edit.merged_group_default'));
  if (name) {
    console.info(`ui.edit.merge_groups: confirmed name=${name} groups=${selectedGroupIds.value.length}`);
    let mergedGroup = store.mergeGroups(selectedGroupIds.value, name);
    if (!mergedGroup) {
      await showAlert(t('edit.merge_failed'), {title: t('edit.operation_failed'), tone: 'error'});
      return;
    }
  } else {
    console.info("ui.edit.merge_groups: canceled");
  }
}

async function executeOrganize() {
  if (!store.outputDirectory) {
    console.warn("ui.edit.organize: rejected reason=missing_output_dir");
    await showAlert(t('edit.missing_output_dir'), {
      title: t('edit.missing_output_title'),
      tone: 'warning'
    });
    await router.push('/');
    return;
  }

  if (store.groupsNumber === 0) {
    console.warn("ui.edit.organize: rejected reason=no_groups");
    await showAlert(t('edit.no_groups'), {title: t('edit.no_groups_title'), tone: 'warning'});
    return;
  }

  if (
      !await showConfirm(
          t('edit.organize_confirm', {
            count: store.groupsNumber,
            mode: store.copyMode ? t('edit.organize_copy') : t('edit.organize_move')
          }),
          {
            title: t('edit.confirm_organization'),
            tone: 'warning',
            confirmText: t('edit.confirm_organize'),
            cancelText: 'Cancel',
            closeOnOverlay: false,
          }
      )
  ) {
    console.info("ui.edit.organize: canceled");
    return;
  }

  console.info(
      `ui.edit.organize: start groups=${store.groupsNumber} output_dir=${store.outputDirectory}`
  );
  store.isOrganizing = true;
  try {
    await tauriImpl.organizeFiles(
        store.groups,
        store.outputDirectory,
        store.copyMode,
        store.overwrite);
    console.info("ui.edit.organize: complete");
    await showAlert(t('edit.organization_complete'), {title: t('edit.complete'), tone: 'success'});
  } catch (error) {
    console.error(`ui.edit.organize: failed err=${formatError(error)}`);
    await showAlert(t('edit.organization_failed', {message: (error as Error).message}), {
      title: t('edit.failed'),
      tone: 'error'
    });
  } finally {
    store.isOrganizing = false;
  }
}
</script>

<template>
  <div class="edit-page">
    <div class="page-header glass-navbar" data-tauri-drag-region>
      <div class="header-left">
        <h1>{{ t('edit.title') }}</h1>
        <p>{{ t('edit.summary', {groups: store.groupsNumber, photos: store.photosNumber}) }}</p>
      </div>
      <div class="header-actions">
        <WinButton @click="$router.push('/')">
          <IconUndo :size="16"/>
          {{ t('edit.back') }}
        </WinButton>
        <WinButton variant="primary"
                   :disabled="store.isOrganizing"
                   @click="executeOrganize"
        >
          <IconSave :size="16"/>
          {{ store.isOrganizing ? t('edit.saving') : t('edit.save') }}
        </WinButton>
      </div>
      <div class="nav-window-controls">
        <button class="win-btn glass-item"
                @click="handleMinimize"
                :title="t('app.window.minimize')"
        >
          <IconMinimize :size="24"/>
        </button>
        <button class="win-btn glass-item"
                @click="handleMaximize"
                :title="t('app.window.maximize')"
        >
          <IconMaximize :size="24"/>
        </button>
        <button class="win-btn win-btn-close glass-item"
                @click="handleClose"
                :title="t('app.window.close')"
        >
          <IconClose :size="24"/>
        </button>
      </div>
    </div>

    <div class="page-content">
      <div class="sidebar glass-sidebar">
        <WinCard :title="t('edit.group_operations')">
          <div class="action-group">
            <WinButton full-width
                       :disabled="selectedGroupIds.length < 2"
                       @click="mergeSelectedGroups"
            >
              <IconMerge :size="16"/>
              {{ t('edit.merge_selected_groups') }}
            </WinButton>
          </div>
        </WinCard>

        <WinCard :title="t('edit.photo_operations')">
          <div class="action-group">
            <WinButton
                full-width
                :disabled="selectedPhotos.length === 0"
                @click="createGroupFromSelected"
            >
              <IconPlus :size="16"/>
              {{ t('edit.create_group_from_selection') }}
            </WinButton>
            <WinButton
                full-width
                :disabled="selectedPhotos.length === 0"
                @click="moveSelectedToGroup"
            >
              <IconMove :size="16"/>
              {{ t('edit.move_selection_to_group') }}
            </WinButton>
          </div>
        </WinCard>

        <div class="group-list glass-scrollbar">
          <div v-for="group in store.groups"
               :key="group.id"
               class="group-item glass-item"
               :class="{ selected: selectedGroupIds.includes(group.id) }"
               @click="toggleGroupSelection(group.id)"
               tabindex="0"
               @keydown.enter.prevent="toggleGroupSelection(group.id)"
               @keydown.space.prevent="toggleGroupSelection(group.id)"
          >
            <div class="group-header">
              <div v-if="renamingGroupId === group.id" class="rename-input">
                <input type="text"
                       v-model="newGroupName"
                       @blur="handleBlur"
                       @keyup.enter="finishRenaming"
                       @keyup.esc="cancelRenaming"
                       ref="renameInput"
                       @focus="(e) => (e.target as HTMLInputElement).select()"
                       class="glass-input"
                />
              </div>
              <div v-else class="group-name">
                <span class="group-name-text">{{ group.name }}</span>
                <span class="group-count">{{ group.photos.length }}</span>
              </div>
            </div>
            <div class="group-meta">
              <span class="group-type"
                    :style="{ backgroundColor: getGroupTypeColor(group.group_type) }"
              >
                {{ getGroupTypeLabel(group.group_type) }}
              </span>
            </div>
            <div class="group-actions">
              <template v-for="action in getPluginGroupActions(group.group_type)" :key="action.id">
                <button
                    class="icon-btn plugin-action-btn"
                    @click.stop="handlePluginGroupAction(action, group)"
                    :title="action.label"
                >
                  <IconPlugin :size="14"/>
                </button>
              </template>
              <button v-if="group.id !== 'ungrouped'"
                      class="icon-btn"
                      @click.stop="startRenaming(group)"
                      :title="t('edit.rename')"
              >
                <IconEdit :size="14"/>
              </button>
              <button v-if="group.id !== 'ungrouped'"
                      class="icon-btn"
                      @click.stop="disbandGroup(group.id)"
                      :title="t('edit.disband')"
              >
                <IconTrash :size="14"/>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="main-content glass-scrollbar"
           ref="mainContentRef"
           @pointerdown="handleMainContentPointerDown"
           @pointermove="handleMainContentPointerMove"
           @pointerup="handleMainContentPointerUp"
           @pointercancel="handleMainContentPointerCancel"
           @selectstart.prevent
      >
        <div class="photos-grid" ref="photosGridRef">
          <div
              v-for="group in store.groups"
              :key="group.id"
              class="photo-group-section"
          >
            <h3 class="group-section-title">
              {{ group.name }}
              <span class="group-section-count">({{ group.photos.length }})</span>
            </h3>
            <div class="photo-thumbs">
              <div
                  v-for="photo in group.photos"
                  :key="photo.file_path"
                  class="photo-thumb"
                  :data-photo-key="photo.file_path"
                  :class="{ selected: isPhotoSelected(photo.file_path) }"
                  @click="handlePhotoClick(photo, $event)"
                  @dblclick.stop="openPhotoDetail(photo)"
                  @keydown.enter.prevent="openPhotoDetail(photo)"
                  @keydown.space.prevent="handlePhotoKeyDown(photo, $event)"
                  @dragstart.prevent
                  tabindex="0"
              >
                <div class="thumb-image">
                  <img v-if="thumbnailCache[photo.file_path]"
                       :src="thumbnailCache[photo.file_path]|| ''"
                       :alt="photo.file_name"
                       class="thumb-img"
                  />
                  <IconImage v-else :size="36" class="placeholder-icon"/>
                </div>
                <div class="thumb-info">
                  <span class="thumb-name">{{ photo.file_name }}</span>
                </div>
                <div v-if="getPluginImageActions(group.group_type).length" class="photo-actions">
                  <template v-for="action in getPluginImageActions(group.group_type)"
                            :key="action.id">
                    <button
                        class="icon-btn plugin-action-btn"
                        @click.stop="handlePluginImageAction(action, photo)"
                        :title="action.label"
                    >
                      <IconPlugin :size="14"/>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectionBox.visible"
             class="selection-box"
             :style="{
               left: `${selectionBox.left}px`,
               top: `${selectionBox.top}px`,
               width: `${selectionBox.width}px`,
               height: `${selectionBox.height}px`
             }"
        />
      </div>

      <div v-if="detailPhoto" class="photo-detail-overlay glass-overlay"
           @click.self="closePhotoDetail">
        <div class="photo-detail-dialog glass-dialog anim-scale-in"
             role="dialog"
             aria-modal="true"
             ref="detailDialogRef"
             @keydown="handleDetailKeydown">
          <div class="photo-detail-header">
            <h3>{{ t('edit.photo_details') }}</h3>
            <WinButton variant="secondary" size="small" @click="closePhotoDetail">
              <IconClose :size="16"/>
            </WinButton>
          </div>

          <div class="photo-detail-body">
            <div class="photo-detail-preview">
              <img v-if="detailThumbnail"
                   :src="detailThumbnail"
                   :alt="detailPhoto.file_name"
                   class="photo-detail-image"
              />
              <div v-else-if="isDetailLoading" class="photo-detail-placeholder">{{
                  t('edit.loading')
                }}
              </div>
              <div v-else class="photo-detail-placeholder">{{ t('edit.no_preview') }}</div>
            </div>

            <div class="photo-detail-grid">
              <div class="detail-item">
                <span>{{
                    t('edit.detail.file_name')
                  }}</span><strong>{{ displayValue(detailPhoto.file_name) }}</strong>
              </div>
              <div class="detail-item">
                <span>{{
                    t('edit.detail.file_path')
                  }}</span><strong>{{ displayValue(detailPhoto.file_path) }}</strong>
              </div>
              <div class="detail-item">
                <span>{{
                    t('edit.detail.capture_time')
                  }}</span><strong>{{ formatCaptureTime(detailPhoto) }}</strong>
              </div>
              <div class="detail-item">
                <span>{{ t('edit.detail.shutter_speed') }}</span><strong>{{
                  formatWithUnit(detailPhoto.shutter_speed, 's')
                }}</strong>
              </div>
              <div class="detail-item">
                <span>{{
                    t('edit.detail.aperture')
                  }}</span><strong>{{ formatAperture(detailPhoto.aperture) }}</strong>
              </div>
              <div class="detail-item"><span>{{ t('edit.detail.iso') }}</span><strong>{{
                  formatIso(detailPhoto.iso)
                }}</strong></div>
              <div class="detail-item"><span>{{ t('edit.detail.exposure_comp') }}</span><strong>{{
                  formatWithUnit(detailPhoto.exposure_compensation, 'EV')
                }}</strong></div>
              <div class="detail-item">
                <span>{{ t('edit.detail.exposure_mode') }}</span><strong>{{
                  formatExposureMode(detailPhoto.exposure_mode)
                }}</strong>
              </div>
              <div class="detail-item">
                <span>{{ t('edit.detail.focal_length') }}</span><strong>{{
                  formatWithUnit(detailPhoto.focal_length, 'mm')
                }}</strong></div>
              <div class="detail-item">
                <span>{{ t('edit.detail.focus_distance') }}</span><strong>{{
                  formatWithUnit(detailPhoto.focus_distance, 'm')
                }}</strong>
              </div>
              <div class="detail-item">
                <span>{{
                    t('edit.detail.camera_make')
                  }}</span><strong>{{ displayValue(detailPhoto.camera_make) }}</strong>
              </div>
              <div class="detail-item">
                <span>{{ t('edit.detail.camera_model') }}</span><strong>{{
                  displayValue(detailPhoto.camera_model)
                }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: 0 var(--prim-space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  flex-shrink: 0;
}

.header-left h1 {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
  margin-bottom: 0;
  line-height: 1;
}

.header-left p {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-xs);
  line-height: 1;
}

.header-actions {
  display: flex;
  gap: var(--prim-space-2);
}

.nav-window-controls {
  display: flex;
  align-items: center;
  gap: var(--prim-space-1);
  margin-left: var(--prim-space-2);
}

.win-btn {
  padding: 6px var(--prim-space-2);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.win-btn-close:hover {
  color: var(--color-danger);
}

.page-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-2);
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--prim-space-3);
}

.group-item {
  padding: var(--prim-space-3);
  margin-bottom: var(--prim-space-2);
  border: 1px solid transparent;
  cursor: pointer;
}

.group-item.selected {
  border-color: var(--color-brand);
  background: var(--sidebar-item-active);
}

.group-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-border-focus);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--prim-space-2);
}

.group-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
}

.group-name-text {
  font-weight: var(--prim-font-weight-medium);
  font-size: var(--prim-font-size-md);
}

.group-count {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-sm);
}

.rename-input input {
  width: 100%;
  padding: 4px var(--prim-space-2);
  border-radius: var(--prim-radius-sm);
  font-size: var(--prim-font-size-md);
}

.group-meta {
  display: flex;
  gap: var(--prim-space-2);
  align-items: center;
}

.group-type {
  padding: 2px var(--prim-space-2);
  border-radius: var(--prim-radius-full);
  font-size: var(--prim-font-size-xs);
  color: var(--prim-neutral-0);
  font-weight: var(--prim-font-weight-medium);
}

.group-actions {
  display: flex;
  gap: var(--prim-space-1);
  margin-top: var(--prim-space-2);
}

.icon-btn {
  padding: 4px 6px;
  border-radius: var(--prim-radius-sm);
  background: transparent;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--color-glass-bg-hover);
  color: var(--color-text-primary);
}

.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-border-focus);
}

.plugin-action-btn {
  color: var(--color-brand);
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: var(--prim-space-5);
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.photos-grid {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-6);
}

.group-section-title {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
  margin-bottom: var(--prim-space-3);
  color: var(--color-text-primary);
}

.group-section-count {
  color: var(--color-text-secondary);
  font-weight: var(--prim-font-weight-normal);
}

.photo-thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--prim-space-3);
}

.photo-thumb {
  border-radius: var(--prim-radius-md);
  overflow: hidden;
  background: var(--color-glass-bg);
  border: 1px solid var(--color-glass-border);
  cursor: pointer;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
}

.photo-thumb:hover {
  box-shadow: var(--prim-shadow-md);
  border-color: var(--color-border-strong);
}

.photo-thumb:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-border-focus), 0 0 12px rgba(var(--prim-cyan-400-rgb), 0.3);
}

.photo-thumb.selected {
  border-color: var(--prim-success-400);
  background-color: rgba(var(--prim-success-400-rgb), 0.12);
  box-shadow: inset 0 0 0 1px var(--prim-success-400);
}

.photo-thumb.selected:focus-visible {
  box-shadow: 0 0 0 3px var(--color-border-focus),
  0 0 12px rgba(var(--prim-cyan-400-rgb), 0.3),
  inset 0 0 0 1px var(--prim-success-400);
}

.selection-box {
  position: absolute;
  border: 1px solid var(--color-brand);
  background: var(--color-brand-light);
  opacity: 0.4;
  pointer-events: none;
  z-index: var(--prim-z-overlay);
  border-radius: var(--prim-radius-xs);
}

.photo-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--prim-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--prim-space-4);
}

.photo-detail-dialog {
  width: min(900px, 100%);
  max-height: min(85vh, 820px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.photo-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--prim-space-3) var(--prim-space-4);
  border-bottom: 1px solid var(--color-glass-border);
}

.photo-detail-header h3 {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
}

.photo-detail-body {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 1fr);
  gap: var(--prim-space-4);
  padding: var(--prim-space-4);
  overflow: auto;
}

.photo-detail-preview {
  background: var(--color-glass-bg);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--prim-radius-sm);
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.photo-detail-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.photo-detail-placeholder {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-base);
}

.photo-detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--prim-space-3);
}

.detail-item {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: var(--prim-space-2);
  align-items: start;
}

.detail-item span {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-sm);
}

.detail-item strong {
  color: var(--color-text-primary);
  font-size: var(--prim-font-size-base);
  line-height: var(--prim-line-height-normal);
  font-weight: var(--prim-font-weight-medium);
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .photo-detail-body {
    grid-template-columns: 1fr;
  }

  .photo-detail-preview {
    min-height: 220px;
  }
}

.thumb-image {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-glass-bg);
  overflow: hidden;
}

.thumb-image .thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-icon {
  opacity: 0.35;
  color: var(--color-text-tertiary);
}

.thumb-info {
  padding: var(--prim-space-2);
}

.thumb-name {
  font-size: var(--prim-font-size-xs);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.photo-actions {
  display: flex;
  gap: 2px;
  padding: 0 var(--prim-space-2) var(--prim-space-2);
  justify-content: flex-start;
}

.photo-actions .icon-btn {
  padding: 3px 5px;
}
</style>