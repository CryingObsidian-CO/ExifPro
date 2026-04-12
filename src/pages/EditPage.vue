<script setup lang="ts">
import {useStore} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import {useRouter} from "vue-router";
import {useTauri} from "../composables/tauri.ts";
import WinCard from "../component/WinCard.vue";
import {ExifInfo, Group, GroupType} from "../types/photo.ts";
import {ref} from "vue";
import {confirm} from '@tauri-apps/plugin-dialog'

const router = useRouter();
const store = useStore();
const tauriImpl = useTauri();

const selectedGroupIds = ref<string[]>([]);
const selectedPhotos = ref<ExifInfo[]>([]);
const renamingGroupId = ref<string | null>(null);
const newGroupName = ref('');

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

function togglePhotoSelection(photo: ExifInfo) {
  const index = selectedPhotos.value.findIndex((p) => p.file_path === photo.file_path);
  if (index === -1) {
    selectedPhotos.value.push(photo);
  } else {
    selectedPhotos.value.splice(index, 1);
  }
}

function startRenaming(group: Group) {
  renamingGroupId.value = group.id;
  newGroupName.value = group.name;
}

async function handleBlur() {
  if (!await confirm('确定要保存吗？')) {
    return;
  }
  finishRenaming();
}

function finishRenaming() {
  if (renamingGroupId.value === 'ungrouped') {
    alert('不能重命名未分组');
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
    alert('不能解散未分组');
    return;
  }

  const group = store.findGroup(groupId);
  if (!group) return;

  if (await confirm(`确定要解散分组 "${group.name}" 吗？照片将移动到未分组。`)) {
    store.addToUngroupedPhotos(group.photos);
  }
  store.deleteGroup(groupId);
  selectedGroupIds.value = selectedGroupIds.value.filter((id) => id !== groupId);
}

async function createGroupFromSelected() {
  if (selectedPhotos.value.length === 0) {
    alert('请选择照片');
    return;
  }
  const name = prompt('请输入分组名称:', '新分组');
  if (name) {
    const newGroup = store.createGroup(name);
    store.movePhotoToGroup(selectedPhotos.value, newGroup.id);
    selectedPhotos.value = [];
  }
}

function moveSelectedToGroup() {
  if (selectedPhotos.value.length === 0) {
    alert('请先选择照片');
    return;
  }

  // TODO 提供选择框
  const targetGroupId = prompt('请输入目标分组 ID:');
  if (!targetGroupId) return;

  const targetGroup = store.findGroup(targetGroupId);
  if (!targetGroup) {
    alert('未找到目标分组');
    return;
  }

  store.movePhotoToGroup(selectedPhotos.value, targetGroupId);
  selectedPhotos.value = [];
}

function mergeSelectedGroups() {
  if (selectedGroupIds.value.length < 2) {
    alert('请选择至少两个分组');
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
    alert('请先选择输出目录');
    await router.push('/');
    return;
  }

  if (store.getGroupsNumber() === 0) {
    alert('没有可整理的分组');
    return;
  }

  if (
      !await confirm(
          `确定要整理 ${store.getGroupsNumber()} 个分组吗？${
              store.getCopyMode() ? '文件将被复制到输出目录。' : '文件将被移动到输出目录。'
          }`
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
    alert('整理完成');
  } catch (error) {
    alert('整理失败: ' + (error as Error).message);
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
      <div class="main-content">
        <div class="photos-grid">
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
                  :class="{ selected: selectedPhotos.some((p) => p.file_path === photo.file_path) }"
                  @click="togglePhotoSelection(photo)"
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