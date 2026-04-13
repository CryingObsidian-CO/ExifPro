<script setup lang="ts">
import {useStore} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import {useRouter} from "vue-router";
import {useTauri} from "../composables/tauri.ts";
import WinCard from "../component/WinCard.vue";
import {ExifInfo, Group, GroupType} from "../types/photo.ts";
import {ref, watchEffect} from "vue";
import {useDialog} from "../composables/dialog.ts";

const router = useRouter();
const store = useStore();
const tauriImpl = useTauri();
const {showAlert, showConfirm} = useDialog();

const selectedGroupIds = ref<string[]>([]);
const selectedPhotos = ref<ExifInfo[]>([]);
const selectedPhotoKeys = ref<string[]>([]);
const lastAnchorPhotoKey = ref<string | null>(null);
const renamingGroupId = ref<string | null>(null);
const newGroupName = ref('');

const mainContentRef = ref<HTMLElement | null>(null);
const photosGridRef = ref<HTMLElement | null>(null);
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

function getGroupTypeLabel(type: GroupType) {
  const labels: Record<GroupType, string> = {
    FocusBracketing: '对焦包围',
    AEB: 'AEB',
    Burst: '连拍',
    Single: '单张',
  };
  return labels[type];
}

// TODO 配置颜色？
function getGroupTypeColor(type: GroupType) {
  const colors: Record<GroupType, string> = {
    FocusBracketing: 'var(--color-focus-bracketing)',
    AEB: 'var(--color-aeb)',
    Burst: 'var(--color-burst)',
    Single: 'var(--color-single)',
  };
  return colors[type];
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
  for (const group of store.getGroups()) {
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

function handlePhotoClick(photo: ExifInfo, event: MouseEvent) {
  const key = photo.file_path;
  const isToggle = event.ctrlKey || event.metaKey;
  const isRange = event.shiftKey;

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
});

function startRenaming(group: Group) {
  renamingGroupId.value = group.id;
  newGroupName.value = group.name;
}

async function handleBlur() {
  if (!renamingGroupId.value) {
    return;
  }

  if (!await showConfirm('确定要保存分组名称吗？', {
    title: '确认重命名',
    tone: 'warning',
    confirmText: '保存',
    cancelText: '取消',
  })) {
    cancelRenaming();
    return;
  }
  finishRenaming();
}

function cancelRenaming() {
  renamingGroupId.value = null;
  newGroupName.value = '';
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

function finishRenaming() {
  if (renamingGroupId.value === 'ungrouped') {
    showAlert('不能重命名未分组', {title: '操作无效', tone: 'warning'});
    return;
  }

  if (renamingGroupId.value && newGroupName.value.trim()) {
    store.updateGroup(renamingGroupId.value, {name: newGroupName.value.trim()});
  }

  renamingGroupId.value = null;
  newGroupName.value = '';
}

async function disbandGroup(groupId: string) {
  if (groupId === 'ungrouped') {
    await showAlert('不能解散未分组', {title: '操作无效', tone: 'warning'});
    return;
  }

  const group = store.findGroup(groupId);
  if (!group) return;

  if (await showConfirm(`确定要解散分组 "${group.name}" 吗？照片将移动到未分组。`, {
    title: '确认解散',
    tone: 'warning',
    confirmText: '确认解散',
    cancelText: '取消',
  })) {
    store.addToUngroupedPhotos(group.photos);
    store.deleteGroup(groupId);
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => id !== groupId);
  }
}

async function createGroupFromSelected() {
  if (selectedPhotos.value.length === 0) {
    await showAlert('请选择照片', {title: '未选择照片', tone: 'warning'});
    return;
  }
  const name = prompt('请输入分组名称:', '新分组');
  if (name) {
    const newGroup = store.createGroup(name);
    store.movePhotoToGroup(selectedPhotos.value, newGroup.id);
    clearPhotoSelection();
  }
}

async function moveSelectedToGroup() {
  if (selectedPhotos.value.length === 0) {
    await showAlert('请先选择照片', {title: '未选择照片', tone: 'warning'});
    return;
  }

  // TODO 提供选择框
  const targetGroupId = prompt('请输入目标分组 ID:');
  if (!targetGroupId) return;

  const targetGroup = store.findGroup(targetGroupId);
  if (!targetGroup) {
    await showAlert('未找到目标分组', {title: '分组不存在', tone: 'error'});
    return;
  }

  store.movePhotoToGroup(selectedPhotos.value, targetGroupId);
  clearPhotoSelection();
}

async function mergeSelectedGroups() {
  if (selectedGroupIds.value.length < 2) {
    await showAlert('请选择至少两个分组', {title: '选择不足', tone: 'warning'});
    return;
  }
  const name = prompt('请输入新分组名称:', '合并分组');
  if (name) {
    let mergedGroup = store.mergeGroups(selectedGroupIds.value, name);
    selectedGroupIds.value = [mergedGroup.id];
  }
}

async function executeOrganize() {
  if (!store.getOutputDirectory()) {
    await showAlert('请先选择输出目录', {title: '缺少输出目录', tone: 'warning'});
    await router.push('/');
    return;
  }

  if (store.getGroupsNumber() === 0) {
    await showAlert('没有可整理的分组', {title: '无可用分组', tone: 'warning'});
    return;
  }

  if (
      !await showConfirm(
          `确定要整理 ${store.getGroupsNumber()} 个分组吗？${
              store.getCopyMode() ? '文件将被复制到输出目录。' : '文件将被移动到输出目录。'
          }`,
          {
            title: '确认整理',
            tone: 'warning',
            confirmText: '开始整理',
            cancelText: '取消',
            closeOnOverlay: false,
          }
      )
  ) {
    return;
  }

  store.setIsOrganizing(true);
  try {
    await tauriImpl.organizeFiles(
        store.getGroups(),
        store.getOutputDirectory(),
        store.getCopyMode(),
        store.getOverwrite());
    await showAlert('整理完成', {title: '整理完成', tone: 'success'});
  } catch (error) {
    await showAlert('整理失败: ' + (error as Error).message, {title: '整理失败', tone: 'error'});
  } finally {
    store.setIsOrganizing(false);
  }
}
</script>

<template>
  <div class="edit-page">
    <div class="page-header">
      <div class="header-left">
        <h1>编辑配置</h1>
        <p>{{ store.getGroupsNumber() }} 个分组，共 {{ store.getPhotosNumber() }} 张照片</p>
      </div>
      <div class="header-actions">
        <WinButton @click="$router.push('/')">返回</WinButton>
        <WinButton variant="primary"
                   :disabled="store.getIsOrganizing()"
                   @click="executeOrganize"
        >
          {{ store.getIsOrganizing() ? '保存中...' : '保存' }}
        </WinButton>
      </div>
    </div>

    <div class="page-content">
      <div class="sidebar">
        <WinCard title="分组操作">
          <div class="action-group">
            <WinButton full-width
                       :disabled="selectedGroupIds.length < 2"
                       @click="mergeSelectedGroups"
            >
              合并选中的分组
            </WinButton>
          </div>
        </WinCard>

        <WinCard title="照片操作">
          <div class="action-group">
            <WinButton
                full-width
                :disabled="selectedPhotos.length === 0"
                @click="createGroupFromSelected"
            >
              从选中创建分组
            </WinButton>
            <WinButton
                full-width
                :disabled="selectedPhotos.length === 0"
                @click="moveSelectedToGroup"
            >
              移动选中到分组
            </WinButton>
          </div>
        </WinCard>

        <div class="group-list">
          <div v-for="group in store.getGroups()"
               :key="group.id"
               class="group-item"
               :class="{ selected: selectedGroupIds.includes(group.id) }"
               @click="toggleGroupSelection(group.id)"
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
              <button v-if="group.id !== 'ungrouped'"
                      class="icon-btn"
                      @click.stop="startRenaming(group)"
                      title="重命名"
              >
                ✏️
              </button>
              <button v-if="group.id !== 'ungrouped'"
                      class="icon-btn"
                      @click.stop="disbandGroup(group.id)"
                      title="解散"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="main-content"
           ref="mainContentRef"
           @pointerdown="handleMainContentPointerDown"
           @pointermove="handleMainContentPointerMove"
           @pointerup="handleMainContentPointerUp"
           @pointercancel="handleMainContentPointerCancel"
           @selectstart.prevent
      >
        <div class="photos-grid" ref="photosGridRef">
          <div
              v-for="group in store.getGroups()"
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
                  @dragstart.prevent
              >
                <div class="thumb-image">
                  <img v-if="photo.thumbnail"
                       :src="photo.thumbnail"
                       :alt="photo.file_name"
                       class="thumb-img"
                       loading="lazy"
                  />
                  <span v-else class="placeholder">🖼️</span>
                </div>
                <div class="thumb-info">
                  <span class="thumb-name">{{ photo.file_name }}</span>
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
  padding: 16px 32px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 2px;
}

.header-left p {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.page-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.group-item {
  padding: 12px;
  border-radius: var(--border-radius);
  margin-bottom: 8px;
  background-color: var(--color-bg-secondary);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.group-item:hover {
  background-color: var(--color-bg-tertiary);
}

.group-item.selected {
  border-color: var(--color-accent);
  background-color: var(--color-accent-light);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.group-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name-text {
  font-weight: 500;
  font-size: 14px;
}

.group-count {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.rename-input input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}

.group-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.group-type {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: white;
  font-weight: 500;
}

.group-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.icon-btn {
  padding: 6px 10px;
  border-radius: var(--border-radius-sm);
  background-color: transparent;
  transition: all var(--transition-fast);
  font-size: 14px;
}

.icon-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.photos-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group-section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text);
}

.group-section-count {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.photo-thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.photo-thumb {
  border-radius: var(--border-radius);
  overflow: hidden;
  background-color: var(--color-bg-secondary);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.selection-box {
  position: absolute;
  border: 1px solid var(--color-accent);
  background-color: var(--color-accent-light);
  opacity: 0.5;
  pointer-events: none;
  z-index: 10;
}

.photo-thumb:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.photo-thumb.selected {
  border-color: var(--color-accent);
}

.thumb-image {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  overflow: hidden;
}

.thumb-image .thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-image .placeholder {
  font-size: 48px;
  opacity: 0.5;
}

.thumb-info {
  padding: 8px;
}

.thumb-name {
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
</style>