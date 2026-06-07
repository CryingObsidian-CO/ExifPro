# ExifPro 项目分支工作流规范

# 版本信息

版本：V1.1

适用项目：ExifPro

# 一、分支定义与生命周期

## 1.1 分支分类及命名规范

| 分支类型       | 命名规则                                                | 核心用途                                            |
|------------|-----------------------------------------------------|-------------------------------------------------|
| 主干分支（永久）   | master                                              | 线上正式生产环境，唯一稳定基准，仅接收release、hotfix分支的合并          |
| 主干分支（永久）   | dev                                                 | 开发集成主干，所有业务功能汇总入口，接收feature、release、hotfix分支的合并 |
| 临时分支（用完即删） | release/v主版本.次版本.修订版本（例：release/v0.1.0）             | 版本预发、测试、线上BUG修复，仅修复BUG，不新增业务功能                  |
| 临时分支（用完即删） | feature/功能名称（例：feature/file-upload）                 | 全新业务功能开发、已合入dev功能的修复/扩充                         |
| 临时分支（用完即删） | fix/问题简述 \| fix/日期（例：fix/fix-crash \| fix/20260509） | 开发过程中修复BUG，不新增业务功能                              |
| 临时分支（用完即删） | hotfix/问题简述（例：hotfix/fix-crash）                     | 线上生产环境紧急BUG修复，优先保证线上稳定                          |
| 临时分支（用完即删） | docs/修改内容（例：docs/update-readme）                     | README、项目文档、CI脚本、开源协议、仓库配置等非业务文件修改              |

## 1.2 分支生命周期规则

- 永久保留分支：master、dev，全程不删除，仅通过合并更新内容

- 用完必删分支：feature/\*、release/\*、fix/\*、hotfix/\*、docs/\*，合并完成后（双向合并全部结束），立即删除本地+远程分支

# 二、全场景合并方式规范

| 合并流向                     | 合并方式              | 操作命令（可选）                                                        | 操作要求                                                       |
|--------------------------|-------------------|-----------------------------------------------------------------|------------------------------------------------------------|
| feature/* \| fix/* → dev | Squash 压缩合并       | git merge --squash feature/xxx \| fix/xxx（仅在PR审核通过后执行，禁止本地直接合并） | 将分支所有提交压缩为 1 条提交，保持 dev 主干整洁                               |
| release/* → master       | 普通Merge（--no-ff）  | git merge --no-ff release/vx.y.z（仅在PR审核通过后执行，禁止本地直接合并）          | 完整保留 release 分支的 BUG 修复记录，生成合并节点，便于线上溯源                    |
| hotfix/* → master        | 普通Merge（--no-ff）  | git merge --no-ff hotfix/xxx（仅在PR审核通过后执行，禁止本地直接合并）              | 保留紧急修复完整记录，快速上线修复，便于故障溯源                                   |
| docs/* → master          | 普通Merge（--no-ff）  | git merge --no-ff docs/xxx（仅在PR审核通过后执行，禁止本地直接合并）                | 留存文档、配置修改记录，便于回滚仓库配置，修改后即时生效                               |
| master → dev（自动同步）       | 自动 PR（Auto-Merge） | 由 `sync.yml` 自动创建 PR（master → dev），无冲突时自动合并                     | 同步所有 master 变更至 dev（含 release/hotfix/docs）；遇冲突则保留 PR 待人工处理 |

# 三、全分支双向推拉操作流程

## 3.1 通用操作前提

- 所有临时分支创建前，必须拉取对应源头分支的最新代码，避免代码滞后

- 开发过程中，定期拉取源头分支最新代码，及时解决代码冲突

- 所有分支推送前，必须本地测试无误，提交信息规范（格式：类型: 描述，例：feat: 新增文件上传功能）

- 所有临时分支→主干的合并，必须提交 PR，经审核通过后方可执行，禁止直接使用 merge 命令合并

## 3.2 新功能开发流程（feature/*）

1. 拉取dev最新代码：
   ``` 
   git checkout dev
   git pull origin dev
   ```

2. 创建feature分支：
   ```
   git checkout -b feature/功能名称
   ```

3. 开发过程中，定期同步dev最新代码（解决冲突）：
   ```
   git pull origin dev
   ```

4. 开发完成后，提交并推送分支：
   ```
   git add .
   git commit -m "feat: 功能描述"
   git push origin feature/功能名称
   ```

5. 提交PR，选择Squash压缩合并至dev，审核通过后执行合并

6. 合并完成后，删除本地及远程feature分支：
   ```
   # 删除本地分支
   git checkout dev
   git branch -d feature/功能名称
   
   # 删除远程分支
   git push origin --delete feature/功能名称
   ```

## 3.3 修复BUG流程（fix/*）

1. 拉取dev最新代码：
   ``` 
   git checkout dev
   git pull origin dev
   ```

2. 创建fix分支：
   ```
   git checkout -b fix/问题简述
   ```

3. 开发过程中，定期同步dev最新代码（解决冲突）：
   ```
   git pull origin dev
   ```

4. 修复完成，提交并推送分支：
   ```
   git add .
   git commit -m "fix: 修复xxx问题"
   git push origin fix/问题简述
   ```

5. 提交PR，选择Squash压缩合并至dev，审核通过后执行合并

6. 合并完成后，删除本地及远程fix分支：
   ```
   # 删除本地分支
   git checkout dev
   git branch -d fix/问题简述
   
   # 删除远程分支
   git push origin --delete fix/问题简述
   ```

## 3.4 版本发布流程（release/*）

### 3.4.1 版本号规则（SemVer）

版本格式：`v主版本\.次版本\.修订号`（例：v1\.0\.0、v1\.0\.1）

- **主版本 X**：重大重构、破坏性更新、架构升级

- **次版本 Y**：新增业务功能、模块升级

- **修订号 Z**：仅 BUG 修复、性能优化、无功能变化

### 3.4.2 Prerelease 预发布版本规则

- **未发布到 master 的测试迭代**：只升级预发布后缀，不升修订号

    - 格式：`vx.y.z-rc.1` → `vx.y.z-rc.2` → `...`

- **已上线正式版的线上补丁**：必须升级修订号 Z

    - 格式：`vx.y.(z+1)-rc.1` → 验证通过 → 正式版 `vx.y.(z+1)`

### 3.4.3 发布前置条件

1. dev 分支已完成功能开发、单元测试、回归测试

2. release 分支**只允许修复 BUG，禁止新增任何业务功能**

3. 版本号由负责人确认，不允许随意命名

4. 确保 master 为最新稳定版本

### 3.4.4 标准发布流程

1. 从dev拉出release分支（确保dev为最新代码）：
   ```
   git checkout dev
   git pull origin dev
   git checkout -b release/vx.y.z
   ```

2. 仅在release分支提交BUG修复，禁止新增任何业务功能，提交规范：
   ```
   git add .
   git commit -m "fix: 修复xxx问题"
   git push origin release/vx.y.z
   ```

3. 每次推送自动触发 CI，生成 **Prerelease 草稿**：
    - 命名格式：`vx.y.z-rc.构建号`
    - 仅用于测试，不升级正式版本号

4. 测试无误后，提交 PR（release → master），审核通过后合并至master，执行命令：
   ```
   git checkout master
   git pull origin master
   git merge --no-ff release/vx.y.z
   git push origin master
   ```

5. CI 会自动生成 **正式发布草稿**，并**自动生成正式版本 Tag**，再通过 `sync.yml` 自动同步至 dev

6. 同步完成后，删除本地及远程release分支：
   ```
   # 删除本地分支
   git checkout dev
   git branch -d release/vx.y.z
   
   # 删除远程分支
   git push origin --delete release/vx.y.z
   ```

7. 若需终止当前release发布，将已修复代码合并回dev后，直接删除release分支，无需合并至master。

## 3.5 线上紧急修复流程（hotfix/*）

### 3.5.0 重要说明：同一小版本支持多个 Bug 修复

- **一个 hotfix 分支可修复多个线上问题**，最终只产生**一个新版本号 (Z+1)**
- 多个 Bug 只需合并一次到 master（即使用一个分支修复所有问题，CI 只打一个 Tag）
- 示例：线上版本 v1.0.0 → 修复 A/B/C 三个问题 → 发布 v1.0.1
- 禁止为每个 Bug 单独创建 hotfix 分支、单独升级版本号

### 3.5.1 hotfix 版本号强制规则

- **hotfix 只允许升级修订号 (Z)**，禁止升级主版本、次版本
- 示例：线上版本 v1.0.0 → 修复后 → v1.0.1
- **Tag 由 CI 自动创建，无需人工打标签**

### 3.5.2 操作流程

1. 拉取master最新代码（线上稳定版本）：
   ```
   git checkout master
   git pull origin master
   ```

2. 创建hotfix分支：
   ```
   git checkout -b hotfix/问题简述
   ```

3. 完成BUG修复，提交并推送：
   ```
   git add .
   git commit -m "fix: 紧急修复线上问题A"
   git commit -m "fix: 紧急修复线上问题B"
   git push origin hotfix/问题简述
   ```

4. 提交PR（hotfix → master），审核通过后合并至master快速上线，执行命令：
   ```
   git checkout master
   git pull origin master
   git merge --no-ff hotfix/问题简述
   git push origin master
   ```

5. CI 自动执行：
    - 升级修订号 Z（`vX.Y.(Z+1)`）
    - 运行全部测试
    - 提交版本 bump 到 master
    - **自动创建正式 Release & Tag**
    - 触发 `sync.yml` 工作流同步至 dev 分支

6. 同步完成后，删除本地及远程hotfix分支：
   ```
   git checkout dev
   git branch -d hotfix/问题简述
   git push origin --delete hotfix/问题简述
   ```

### 3.5.3 与 dev 同步说明

- hotfix 合并到 master 后，由 `sync.yml` 自动创建 PR（master → dev）
- 若无冲突则自动合并；若有冲突，需人工解决 PR 中的冲突后手动合并
- 开发者**无需**手动执行 `git merge hotfix/*` 到 dev

## 3.6 文档/配置变更流程（docs/*）

适用于 README、CI 脚本、开源协议、仓库配置等**非业务代码**的修改。

### 3.6.1 规则要点

- docs 分支**只允许修改非业务文件**（`.md`、`.github/`、配置文件等）
- 合并目标为 **master**（非 dev）
- 合并方式：`--no-ff` 保留完整记录
- 不需要经历 release 发布流程，合入 master 后即时生效

### 3.6.2 操作流程

1. 拉取master最新代码：
   ```
   git checkout master
   git pull origin master
   ```

2. 创建docs分支：
   ```
   git checkout -b docs/修改内容
   ```

3. 完成文档或配置修改，提交并推送：
   ```
   git add .
   git commit -m "docs: 更新xxx文档"
   git push origin docs/修改内容
   ```

4. 提交 PR（docs → master），审核通过后合并：
   ```
   git checkout master
   git pull origin master
   git merge --no-ff docs/修改内容
   git push origin master
   ```

5. 合并后由 `sync.yml` 自动同步至 dev，确保开发环境文档一致

6. 删除本地及远程docs分支：
   ```
   git branch -d docs/修改内容
   git push origin --delete docs/修改内容
   ```

## 3.7 版本号与 Tag 自动生成规则（CI 统一管理）

1. release 合并到 master
    - CI 自动打正式 Tag：vX.Y.Z
    - 自动生成正式 Release

2. hotfix 合并到 master
    - CI 自动升级修订号 Z
    - 自动打 Tag：vX.Y.(Z+1)

3. release 分支推送
    - CI 自动生成 Prerelease：vX.Y.Z-rc.序号

4. 所有 Tag 均不由人工创建，统一由 CI 自动生成，保证版本唯一、不冲突、可追溯。

# 四、手动操作 vs CI 自动操作责任矩阵

## 4.1 职责总览

| 阶段                  | 开发者手动操作                                        | CI 自动完成                                                                  |
|---------------------|------------------------------------------------|--------------------------------------------------------------------------|
| **创建分支**            | 从目标分支拉取最新代码 → `git checkout -b`                | —                                                                        |
| **日常开发**            | 编码、本地测试、定期 `git pull` 同步源分支                    | —                                                                        |
| **代码提交**            | `git add` / `git commit` / `git push`          | —                                                                        |
| **代码质量**            | 本地运行 `cargo test` / `vitest run` / `cargo fmt` | `ci.yml`：vue-tsc 类型检查、Vitest 测试、Rust fmt + clippy + cargo test           |
| **提交流程**            | 创建 PR、填写描述、指定审核人                               | —                                                                        |
| **代码审核**            | 人工 Review、讨论、修改                                | —                                                                        |
| **合并操作**            | 审核通过后点击 Merge / 执行合并命令                         | —                                                                        |
| **预发布构建**           | —                                              | `release.yml`（prerelease job）：跨平台构建 Tauri 应用，产出 `.deb/.rpm/.msi/.nsis`   |
| **Tag 管理**          | —                                              | 自动打 Tag：`vX.Y.Z`（release）、`vX.Y.Z-rc.N`（prerelease）、`vX.Y.(Z+1)`（hotfix） |
| **正式发布**            | —                                              | `release.yml`（formal-release）：创建正式 Release 草稿                            |
| **Hotfix 版本 bump**  | —                                              | `hotfix.yml`：自动读取版本号、升级修订号、更新 Cargo.toml + tauri.conf.json               |
| **master → dev 同步** | 仅在冲突时介入解决                                      | `sync.yml`：自动创建 PR（master→dev），无冲突自动合并                                   |
| **删除临时分支**          | 本地 + 远程分支删除                                    | —                                                                        |

## 4.2 各分支角色速查

| 分支类型         | 谁创建 | CI 触发                    | 合并目标   | 合并方式      | 合并后 CI 动作                             |
|--------------|-----|--------------------------|--------|-----------|---------------------------------------|
| `feature/*`  | 开发者 | `ci.yml`                 | dev    | Squash    | 无                                     |
| `fix/*`      | 开发者 | `ci.yml`                 | dev    | Squash    | 无                                     |
| `release/v*` | 开发者 | `ci.yml` + `release.yml` | master | `--no-ff` | 预发布构建 → 正式 Release + Tag → 同步 dev     |
| `hotfix/*`   | 开发者 | `ci.yml`                 | master | `--no-ff` | 版本 bump → 测试 → Release + Tag → 同步 dev |
| `docs/*`     | 开发者 | `ci.yml`                 | master | `--no-ff` | 同步 dev                                |

## 4.3 CI 工作流文件说明

| 文件                                 | 触发条件                                                              | 核心职责                          |
|------------------------------------|-------------------------------------------------------------------|-------------------------------|
| `.github/workflows/ci.yml`         | `workflow_call`（被 pr/release/hotfix 调用）；`workflow_dispatch`（手动触发） | 类型检查、Lint、构建验证、单元测试           |
| `.github/workflows/pr.yml`         | PR 到 dev、master                                                   | 调用 `ci.yml`，作为 PR 门禁          |
| `.github/workflows/release.yml`    | push release/v*（预发布）；PR merged→master（正式发布）                       | 调用 `ci.yml` → 跨平台 Tauri 构建、打 Tag、创建 Release |
| `.github/workflows/hotfix.yml`     | PR hotfix/* merged→master                                         | 调用 `ci.yml` → 版本 bump → 跨平台构建 → 打 Tag、创建 Release |
| `.github/workflows/sync.yml`       | push master；Release/Hotfix 完成                                     | 自动创建 PR（master→dev），同步变更      |
| `.github/workflows/label-sync.yml` | push .github/labels.yml；workflow_dispatch                         | 同步 GitHub Issue 标签            |