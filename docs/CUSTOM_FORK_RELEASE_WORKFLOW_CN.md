# Sub2API Fork 分支同步、发布与生产部署规范

> 适用于基于 `Wei-Shaw/sub2api` 的个人或团队 Fork 仓库。
>
> 本文档的目标是把“本地构建镜像后手工 `docker save` / `docker load`”改造成可追踪、可复现、可回滚的标准流程。
>
> **状态：已补充仓库审查结论的目标规范，尚未全部落地。** 本文区分“已核验现状”“待确认方案”和“待实施要求”；修改文档不代表已经迁移分支、配置保护规则、通过 CI、发布镜像或修改生产配置。
>
> **当前仓库从这里开始：** 第 2.2 节是核验快照，第 2.3 节是首次分支迁移建议（待用户确认），第 5.4～5.6 节是发布前必须补齐的门禁，第 13 节是分阶段落地清单。完成这些前置条件前，不应直接套用日常发布命令。上游通知与 AI 审核流程见第 3.4～3.6 节。

## 1. 总体原则

生产环境必须能够回答以下问题：

1. 当前运行的代码来自哪个 Git commit？
2. 当前运行的版本是什么？
3. 当前运行的镜像从哪里构建？
4. 如何回滚到上一版？
5. 升级前是否完成数据库备份和验证？

推荐流程：

```text
官方仓库发布稳定版本
        ↓
收到 Release 通知（可选：自动建立审核 Issue）
        ↓
用户委托 AI 只读评估差异与风险
        ↓
用户确认同步方案
        ↓
AI 在独立同步分支合并、解决冲突并运行测试
        ↓
通过 PR 和 CI，由用户批准合入自己的 main
        ↓
创建自己的版本 Tag
        ↓
GitHub Actions 构建并推送 Docker 镜像
        ↓
RAK 服务器按固定版本 pull
        ↓
健康检查和版本验证
```

生产环境不应依赖以下方式：

- 直接在生产服务器上构建镜像；
- 直接使用 `latest` 作为生产版本；
- 只通过 `docker save` 文件名判断代码版本；
- 在没有 Git commit、Tag 或镜像 digest 的情况下发布；
- 未备份数据库就直接升级；
- 直接把官方 `main` 强行覆盖自己的代码。

---

## 2. 仓库和远程分支规范

Fork 仓库应配置两个 Git remote：

```bash
git remote -v
```

推荐结构：

```text
origin   -> 自己的 Fork 仓库，用于 push 和发布
upstream -> Wei-Shaw/sub2api 官方仓库，用于同步
```

如果没有配置：

```bash
git remote add upstream git@github.com:Wei-Shaw/sub2api.git
git remote set-url origin 'git@github.com:<自己的账号>/<自己的仓库>.git'
```

以后同步官方代码前执行：

```bash
git fetch upstream --prune --tags
git fetch origin --prune --tags
```

### 2.1 分支命名

| 分支 | 用途 |
|---|---|
| `main` | 自己的生产集成分支，只放已经验证过的代码 |
| `feature/<name>` | 新功能开发 |
| `fix/<name>` | Bug 修复 |
| `sync/upstream-vX.Y.Z` | 同步官方稳定版本 |
| `release/vX.Y.Z-custom.N` | 可选的发布候选分支 |
| `hotfix/<name>` | 生产紧急修复 |

本文使用 `main` 表示自己的生产集成分支。`main` 与 `master` 只是名称差异；以仓库实际设置为准，不需要为了使用本规范改名。

**当前仓库初始化注意事项：** 本次核验 `duanyongcheng/sub2api` 的默认分支为 `main`，没有 `master` 分支。定制修改位于 `custom/v0.2.18`；`origin/main` 已包含官方 `v0.2.18` 之后的其他提交，两条分支已经分叉。因此目前不能把 `main` 当成已经准备好的定制版生产分支，也不能直接合并后就宣称基线仍然只有 `v0.2.18`。

首次整理需由 AI 对比两条分支的差异，列出需要保留的定制功能和额外上游改动，再由用户决定集成范围或选择哪条分支作为长期集成分支。禁止用强制推送、重置或覆盖文件来跳过审查。此后再按本文的 `main` 流程操作。

### 2.2 已核验现状：首次审查快照

以下是本次 Git 历史与 GitHub 只读查询得到的快照，不是实时状态。执行迁移前必须重新核验；若 SHA 或分支关系发生变化，应重新评估，不能继续照搬旧快照。

| 项目 | 核验结果 |
|---|---|
| `origin` | `git@github.com:duanyongcheng/sub2api.git`，配置正确 |
| `upstream` | `git@github.com:Wei-Shaw/sub2api.git`，配置正确 |
| 官方 `v0.2.18` commit / 两条分支共同祖先 | `ac1b8f1271be0d674fa6f074403c1410f30a3a81`，已与官方远端 Tag 的 peeled commit 核对 |
| 当前 `custom/v0.2.18` | `4964bfbcec734ecd1ab290d300a0145e11e89a7d`，与 `origin/custom/v0.2.18` 一致；基线之后有 6 个定制提交 |
| `origin/main` | `ba81c7fd758e425d67f856d601147ef0c5263d3f`；基线之后有另外 10 个提交 |
| 本地 `main` | `37067e8e3`，落后 `origin/main` 7 个提交，不能用它代替远端快照 |
| GitHub 默认分支 / 分支保护 | 默认分支为 `main`；两条分支均未受保护 |
| Issues / Actions | Issues 未开启；Actions 已启用，但未查询到运行记录，不能视为 CI 或发布已验证 |
| Fork 远端 Tag / Release / Actions 变量 | 本次查询均未发现；本地存在官方 Tag，不代表已发布到 Fork |
| 工作区 | 审查开始时 `.gitignore` 与本文已暂存；迁移不得丢弃或擅自提交这些修改 |
| `backend/cmd/server/VERSION` | 为 `0.2.17`；它滞后于真实的 `v0.2.18` 基线，不能作为同步基线依据 |

```text
官方 v0.2.18：ac1b8f127
    ├── 6 个定制提交 → custom/v0.2.18：4964bfbce
    └── 10 个其他提交 → origin/main：ba81c7fd7
```

应保留的定制提交：

| Commit | 内容 |
|---|---|
| `99ccd9133` | V2 可用性监控重构与供应商支持 |
| `a5d0ddde0` | 可用性面板完善、刷新和筛选修复 |
| `41f92f80e` | API Key 自助切换分组 |
| `0502af7c1` | 自助接口限流及跳过分组统计 |
| `0aa182e4f` | 分组可用性详情弹窗 |
| `4964bfbce` | 按供应商组织可用性卡片 |

旧 `origin/main` 的额外范围包括：管理员 API Key 的操作/资源范围授权、多图片计费及修复、版本文件与赞助信息更新。其中包含 `backend/migrations/247_scoped_admin_api_keys.sql` 和 `248_group_image_count_billing.sql` 两项迁移。

相对共同基线，旧 `main` 涉及 142 个文件，定制线涉及 40 个文件。因此直接合并不是“只整理分支”；即使 Git 没有文本冲突，也不代表额外功能、鉴权、计费和数据库行为已经审核通过。

### 2.3 待确认方案：首次分支迁移

**推荐方案 A：归档旧远端 `main`，从定制线建立新的 `main`。此处只是建议，未获得分支写操作授权、也未执行迁移。**

目标结构：

```text
main
  └── 保留 custom/v0.2.18 的全部历史，后续通过 PR 完成发布改造
archive/main-ba81c7fd7
  └── 完整保留旧 origin/main，不自动纳入首次定制发布
custom/v0.2.18
  └── 迁移初期保留，作为原始定制线参考
feature/*、fix/*、sync/upstream-v*
  └── 后续开发、修复和上游同步
```

操作顺序（每一步都应核验结果）：

1. 保留当前未提交/暂存修改，记录远端两条分支完整 SHA；检查未合并 PR、分支保护、工作流和链接对分支名的依赖。若远端已变化，停止并更新方案。
2. 用户确认后，通过 GitHub 分支重命名功能/API，将旧远端 `main` 改名为 `archive/main-ba81c7fd7`。必须保留完整历史，不使用 reset 或 force push 替代归档。
3. 从已核验的 `origin/custom/v0.2.18` commit 创建新的远端 `main`，然后将新的 `main` 设置为默认分支。迁移窗口内暂停合并与发布；核对重命名后的默认分支、PR base 和保护规则，不假定它们自动符合新用途。
4. 确认归档分支指向原 `ba81c7fd7`，新 `main` 初始指向原 `4964bfbce`，且保留全部 6 个定制提交。暂不删除 `custom/v0.2.18`。
5. 整理本地跟踪关系；优先使用独立 worktree，避免切换或污染当前暂存工作区。

以下命令**仅适用于远端步骤已完成**，且当前仍在 `custom/v0.2.18`、本地旧 `main` 未被其他 worktree 使用、目标分支名与目录尚不存在的情况：

```bash
# 先只检查远端结果；若不符合上述预期，停止
git ls-remote --symref origin HEAD \
  refs/heads/main refs/heads/archive/main-ba81c7fd7 refs/heads/custom/v0.2.18
```

确认后再逐步更新本地引用；以下子 shell 在任一步失败时停止，不操作当前暂存文件：

```bash
(
  set -eu
  git fetch origin --prune --no-tags
  test "$(git rev-parse origin/main)" = 4964bfbcec734ecd1ab290d300a0145e11e89a7d
  test "$(git rev-parse origin/archive/main-ba81c7fd7)" = ba81c7fd758e425d67f856d601147ef0c5263d3f
  git branch -m main archive/local-main-before-fork
  git branch --unset-upstream archive/local-main-before-fork
  git remote set-head origin -a
  git worktree add --track -b main ../sub2api-main origin/main
)
```

旧本地 `main` 落后远端，因此 `archive/local-main-before-fork` 只是本地历史副本，**不能代替远端 `archive/main-ba81c7fd7`**。新 `main` 此时只是待验证的集成基线，不代表可以立即上生产。

**备选方案 B：使用长期 `fork/main`。** 从定制线创建 `fork/main` 并设为默认分支，保留旧 `main` 作为明确标注的历史参考；同时将本文命令、PR base、保护规则及安装/文档链接中的集成分支名统一调整。优点是减少重命名；代价是不能继续无条件照抄 `main` 命令。

不推荐为了保留分支名称就直接合并旧 `main`。若确实需要它的管理员 API Key、图片计费等功能，应单独确认范围、审查迁移并通过测试。以后也不要对定制集成分支盲目使用 GitHub 的 Fork Sync 或覆盖操作；上游稳定版本通过同步 PR 引入。

### 2.4 待实施：GitHub 设置

- 对选定的集成分支要求 PR 和必要 CI 检查，禁止强制推送与删除；以实际运行成功的检查名称配置 required checks。
- 保留 merge commit 能力，**不要启用要求线性历史的规则**，否则与上游同步必须保留祖先关系的要求冲突。
- 对自己的发布 Tag 限制创建权限，并禁止更新、删除；不要给 AI 或发布机器人默认绕过权限。
- 单人仓库不强制无法满足的他人审批，但必须由用户审查差异、确认 CI 并决定合并。
- 需要第 3.5 节的审核 Issue 时再启用 Issues；核验 Actions 权限、GHCR 包权限和通知送达，不把“已启用”当成“已验证”。
- 在新集成分支完成发布改造和不发布的 dry run 后，再执行首次正式发布。

---

## 3. 同步官方稳定版本

### 3.1 推荐同步官方 Tag，而不是直接同步官方 main

生产环境默认同步官方已经发布的稳定 Tag：

```text
v0.2.18
v0.2.19
v0.2.20
```

不要默认直接合并 `upstream/main`，因为官方 `main` 可能包含尚未发布、尚未充分验证或存在破坏性变化的代码。

安全漏洞或紧急修复可以提前同步，但必须单独建立同步 PR，并记录原因和测试结果。

### 3.2 标准同步步骤

前提：第 2 节的初始化已完成，目标工作区干净；有未提交修改时使用独立 worktree。假设官方发布了 `v0.2.19`，fetch 后、merge 前应核对 Tag 来源：

```bash
git ls-remote --tags upstream refs/tags/v0.2.19 'refs/tags/v0.2.19^{}'
```

附注 Tag 应比较 `^{}` 对应的 commit；轻量 Tag 比较其直接 SHA。两个 remote 抓取的 Tag 共用本地 `refs/tags` 命名空间，并不天然按来源隔离。将结果与下方 fetch 后的 `git rev-parse 'v0.2.19^{commit}'` 核对并记录；冲突或不一致时停止，不用强制 fetch 覆盖 Tag。

核验后按以下流程整合（执行到 merge 前完成上述比较）：

```bash
git fetch upstream --prune --tags
git fetch origin --prune --tags

git switch main
git pull --ff-only origin main

git switch -c sync/upstream-v0.2.19

git rev-parse 'v0.2.19^{commit}'
# 必须与上面核验的官方 commit 一致，否则停止
git merge --no-ff v0.2.19 -m "sync(upstream): merge v0.2.19"
```

如果出现冲突：

```bash
git status
```

逐个解决冲突后：

```bash
git add '<已解决的文件>'
git commit
```

禁止在冲突未解决时直接执行：

```bash
git push --force
```

### 3.3 同步后的最小验证

以下命令均从仓库根目录执行，不连续使用 `cd backend`、`cd frontend`。Go、Node、pnpm、golangci-lint 版本和集成测试依赖应与仓库 CI 一致。

后端：

```bash
make -C backend test-unit
make -C backend test-integration
(cd backend && golangci-lint run --timeout=30m ./...)
```

前端：

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run lint:check
pnpm --dir frontend run typecheck
pnpm --dir frontend run test:run
pnpm --dir frontend run build
```

项目级检查：

```bash
git diff --check
git diff --cached --check
bash -n .github/release-tools/release-images.sh
python3 -m unittest discover -s .github/release-tools -p 'test_release_matrix.py'
```

发布工具测试需先在隔离的 Python 环境安装 `.github/release-tools/requirements-release.txt` 中的依赖。以上不能替代 CI 中的部署脚本检查等其他 required checks；无法运行或失败的项目必须明确记录，不能作为通过处理。定制前端回归测试接入要求见第 5.6 节。

验证通过后：

```bash
git push -u origin sync/upstream-v0.2.19
```

通过 GitHub Pull Request 将 `sync/upstream-v0.2.19` 合并到自己的 `main`。不要未经测试直接把同步分支用于生产。

**同步 PR 使用保留历史的 merge commit，不做 squash merge 或 rebase merge。** 必须保留上游提交的祖先关系，方便下一次同步正确计算差异。普通自定义功能 PR 可以另行选择合并策略。

如果只引入个别紧急修复，使用独立 backport 分支，审查依赖后 `git cherry-pick -x <commit>` 并记录来源。部分 backport 不等于完整升级到该上游 Tag，不应修改完整同步基线。

### 3.4 上游发版通知与订阅区别

**GitHub Pro 不等于 GitHub Copilot Pro。** 前者属于 GitHub 账号的托管、管理和计算资源权益；Copilot 的 AI 能力、可用模型、使用额度及计费需单独确认。不要因为账号显示 Pro 就假定已拥有云端 AI 编码代理。具体以账户 Billing、Copilot 设置和 GitHub 官方说明为准。

#### 立即可用：只订阅 Releases

1. 打开 <https://github.com/Wei-Shaw/sub2api>。
2. 右上角选择 **Watch → Custom → Releases → Apply**（按钮名称可能随界面调整）。
3. 在 <https://github.com/settings/notifications> 检查 Watching 通知的 **On GitHub** 和 **Email** 设置。
4. 上游发版后，从 GitHub 通知或邮件打开对应 Release，再委托 AI 审核。

此功能无需 Pro，也不需要运行工作流。不要选择所有仓库活动，否则大量 Issue 和 PR 通知会淹没发版消息。Releases 订阅不等于只订阅稳定版本，收到通知后仍需核验是否为预发布。

可以继续使用当前 AI 工具完成审核。若另外具备支持云端 agent 的 Copilot 套餐，并且仓库允许使用，可在 GitHub 的 Copilot/Agents 入口提供 Issue、目标仓库和分支，让它产出审核报告或 PR；仅请求一次 PR code review 不等于已经完成上游同步。

### 3.5 可选：检测上游发版并自动创建审核 Issue

当需要长期跟踪“哪些版本待审核、跳过了哪些版本、为何合并”时，建议新增独立工作流（**待实现**）：

```text
.github/workflows/upstream-release-watch.yml
```

设计要求：

- 用 `schedule` 每 6 小时检查一次，并支持 `workflow_dispatch` 手动补查；错开整点运行。
- 读取 `Wei-Shaw/sub2api` 的公开 Releases API，分页检查候选版本，过滤 draft/prerelease；不能只读取一个 latest 结果而遗漏间隔内的其他发布。
- 在自己的 Fork 建立 Issue，例如 `[Upstream] v0.2.19 待审核`，链接原 Release，记录发布时间、Tag、解析到的 commit SHA 和当前已整合基线。
- 使用上游仓库与 release ID 作为稳定去重标识，检查打开和关闭的 Issue，并串行执行；关闭代表已处理或主动跳过，不应重复创建。
- 第一次运行需明确起始基线或时间，不要为所有历史版本刷屏；“已通知”与“已合并”分别记录。
- 若同一 Tag 的 commit 后续发生变化，标记异常并重新审核，不能静默信任被移动的 Tag。
- Fork 要启用 Issues；创建的 Issue 分配或明确提及维护者，并配置相应通知。工作流成功本身不保证发版信息送达用户。
- 最小权限为 `contents: read` 和 `issues: write`，通常可用本仓库 `GITHUB_TOKEN`；不需要生产 SSH 密钥、镜像推送凭据或 AI API Key。
- 通知工作流只读上游元数据，不执行上游代码、不自动合并、不自动打 Tag，也不自动部署 RAK。Release 文本与 Issue 内容只能作为数据，不能插入可执行脚本或当成 AI 的授权指令。

**触发与可靠性限制：**

- Fork 中的 `on: release` 只接收本仓库的 Release 事件，不会自动接收 upstream 的发版。
- 没有上游管理权限时，不依赖在上游安装 webhook；使用定时轮询即可。
- 定时工作流必须存在于默认分支，并确认 Fork 的 Actions 已启用；仅放在 `custom/v0.2.18` 不会按默认分支的定时事件运行。
- GitHub 定时任务可能延迟或遗漏；公开仓库连续 60 天无活动时可能自动停用。保留 Watch Releases 作为另一通知渠道，提供手动补查，并检查失败或停用状态。

示例审核 Issue：

```text
标题：[Upstream] v0.2.19 待审核
上游：Wei-Shaw/sub2api
Release：<官方发布链接>
上游目标 Tag / commit：<tag> / <解析后的 SHA>
本地已完整合并基线：<tag> / <SHA>
Fork 目标分支：main
状态：待用户委托 AI

待审核：
- 新功能、重要修复、安全更新和破坏性变化
- 对 Fork 定制功能的影响
- 数据库迁移与回滚约束
- 推荐完整合并 / 单独 backport / 暂缓
- 测试计划与需要用户决定的冲突
```

### 3.6 AI 审核与合并的权限边界

#### 第一步：用户委托，只读评估

收到通知后，把以下模板和具体 Release 链接交给 AI：

```text
请审核 Wei-Shaw/sub2api 的 <上游 Tag> 是否适合整合到
我的 duanyongcheng/sub2api 的 <目标分支>。
先只读审查，不修改文件、切换我的工作区、提交、push、合并或发布。

1. 核验 origin/upstream、实际目标分支、工作区状态、目标 Tag 的 commit SHA。
   如果定制修改不在目标分支，先指出问题，不要假设 main/master 已包含它们。
2. 确认上次完整同步的上游 Tag/SHA 和已有 backport；不能只根据 VERSION
   文件或最近的 git describe 推断基线。基线不明确时暂停并询问。
3. 阅读 Release Notes 以及实际 commit/file diff，区分
   “上次基线 → 上游新版本”和“上次基线 → 我的定制修改”。
4. 逐项评估需要保留的定制功能，重点包括 V2 可用性监控、API Key 自助切组。
5. 检查鉴权、限流、计费、流式请求、数据迁移、配置、依赖、前后端接口，
   以及 Dockerfile、Actions、安装脚本、镜像地址和应用内更新逻辑。
6. 给出完整 merge / 个别修复 backport / 暂缓的推荐，并说明依赖和风险。
   不要用 git merge -s ours 或整文件覆盖来假装完成整合。
7. 输出：变更摘要、文件/提交依据、冲突处理建议、测试计划、升级及回滚方案，
   将无法验证的项目和需要我决定的项目单独列出，然后等待确认。
```

AI 必须检查真实差异，不能仅复述更新日志；Git 无冲突也不代表行为兼容。发现未知迁移或安全风险时，应暂停而不是默认接受上游。

#### 第二步：用户确认后，在同步分支执行

确认方案后再授权 AI：

```text
按已确认方案，在独立 worktree/同步分支整合 <上游 Tag>。
保留现有未提交或暂存修改，不修改生产配置。
解决冲突，补齐定制功能的回归测试，执行 CI 所需检查。
提交并推送同步分支，创建 base=<目标分支> 的 Draft PR，关联审核 Issue。
PR 列明上游基线和目标 SHA、冲突处理、测试结果、迁移风险及未验证项。
完成后等待我审查；不要自行合并 PR、打发布 Tag、发布镜像或部署 RAK。
```

只有确认需要上述 Git 写操作后才执行。PR 必须明确指向自己的 Fork，避免默认向官方仓库提交。

对目标分支启用 PR 和必要的 CI 检查、禁止强制推送与删除；多人维护时要求另一位人类批准。单人仓库不要配置只有自己却无法满足的外部审批门槛，但仍应由用户亲自检查差异和 CI 后点击合并。AI review 不能替代人类批准或绿色 CI。

| 阶段 | 自动化 / AI 可做 | 仍需用户确认 |
|---|---|---|
| 通知 | 检查 Releases、创建审核 Issue | 是否启动审核 |
| 评估 | 阅读差异、产出建议 | 同步范围和冲突策略 |
| 整合 | 授权后创建同步分支、修复、测试、提交 PR | 是否合入集成分支 |
| 发布 | 另行授权的 Tag 触发构建 | 是否发布自己的版本 |
| 部署 | 按固定版本拉取和验证 | 是否升级 RAK、何时回滚 |

**已合并基线的记录规则：** 在同步 PR/关联 Issue 中记录上游 Tag 和 SHA，只有 PR 真正合入集成分支后才标记为“已整合”。可额外维护机器可读的基线文件，但不能在仅收到通知时就更新它。发布后另记录 Fork Tag、commit 和镜像 digest。不得运行 `git push --tags` 批量推送抓取的上游 Tag，避免误触发当前 `v*` 发布工作流。

官方参考：

- [通知配置](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)
- [GitHub 套餐](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- [GitHub 网页与移动端的 Copilot](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)
- [Actions 的 release / schedule 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

---

## 4. 自定义版本号规范

自己的代码包含官方代码之外的修改，因此不能重复使用官方版本 Tag。

推荐格式：

```text
v0.2.18-custom.1
v0.2.18-custom.2
v0.2.19-custom.1
```

版本含义：

```text
v0.2.19-custom.1
│        │      │
│        │      └─ 基于该官方版本的第 1 个自定义发布
│        └──────── 自定义版本标识
└───────────────── 官方基线版本
```

也可以使用自己的品牌标识，例如：

```text
v0.2.19-bmai.1
```

版本规则：

- 已发布的 Tag 永远不修改、不覆盖、不复用；
- 发现问题时创建新版本，例如 `custom.2`；
- Git Tag 与 GitHub Release Tag 使用 `v0.2.18-custom.1`；Docker Tag 与程序版本使用去掉 `v` 的 `0.2.18-custom.1`，含义一致但字符串不完全相同；
- 生产部署记录 Git Tag、commit SHA 和镜像 digest；
- 生产 Compose 不使用 `latest` 作为唯一版本依据。

### 4.1 定制版本与预发布语义

`0.2.18-custom.1` 在 SemVer 中是 prerelease，并不只是品牌后缀。当前 `.goreleaser.yaml` 和 `.goreleaser.simple.yaml` 均配置 `prerelease: auto`，会将这类版本标记为 GitHub 预发布，通常不会由 `releases/latest` 返回。

首次发布前必须落实通道策略：

- 可以保留 `custom.N` 作为定制发布序列，但不能因此假设现有工具把它视为稳定版本。
- 若希望正式定制版显示为 GitHub 正式 Release，应在仅接受正式定制 Tag 的发布路径中显式设置 `prerelease: false`；这不会改变 SemVer 的排序语义，也不能代替镜像通道策略。
- 候选构建优先使用不发布的 dry run。若需要公开 RC，先定义独立命名、筛选和发布规则；未定义的候选 Tag 不得进入正式发布路径。
- 生产按已批准的精确 Tag/digest 部署，不依赖 GitHub `latest` 或通用 SemVer 排序自动选择版本。
- 应用内更新器目前会忽略 `-` 后缀，无法区分 `custom.1` 与 `custom.2`；不能只改仓库地址就启用它，见第 10 节。

### 4.2 创建发布 Tag

前提：分支初始化及第 5.4～5.6 节门禁已完成，目标 commit 已经通过 PR 合入自己的集成分支，并且**该确切 SHA** 的必要检查已通过、用户已批准发布。以下模板不能代替这些远端检查。

示例使用未来已完整合入的 `v0.2.19` 基线；当前若仍基于 `v0.2.18`，首版应使用 `v0.2.18-custom.1`，不能仅为版本号更新而宣称升级了基线。

```bash
# 从仓库内执行；子 shell 确保任一步失败就停止后续发布操作
(
  set -eu
  tag=v0.2.19-custom.1

  test -z "$(git status --porcelain)" || {
    echo "工作区或暂存区不干净，停止发布" >&2
    exit 1
  }
  git fetch origin --prune --no-tags
  git switch main
  git pull --ff-only origin main
  test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" || {
    echo "本地 HEAD 与远端集成分支不同，停止发布" >&2
    exit 1
  }
  if git show-ref --verify --quiet "refs/tags/$tag"; then
    echo "本地 Tag 已存在，停止；不要删除、移动或覆盖" >&2
    exit 1
  fi
  remote_tag=$(git ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}")
  test -z "$remote_tag" || {
    echo "远端 Tag 已存在，停止发布" >&2
    exit 1
  }
  git rev-parse HEAD

  # 编辑器中填写主题、空行及正文：上游 Tag/SHA、定制变化、迁移与回滚说明
  git tag -a "$tag"
  test "$(git rev-parse HEAD)" = "$(git rev-parse "$tag^{commit}")"
  git -c push.followTags=false push origin "refs/tags/$tag:refs/tags/$tag"
)
```

发布只推送这一枚明确 Tag，不在此阶段执行 `git push origin main`、`git push --tags` 或隐式批量推送。若失败后本地 Tag 已创建，先核对远端和工作流是否已触发，再决定如何恢复；不要重新打同名 Tag。

`git tag -a` 创建的是附注 Tag，直接 `git rev-parse <tag>` 返回 Tag 对象而非 commit，需用 `^{commit}` 解析。当前 Release 工作流读取 `%(contents:body)`；只写一行 `-m "release: ..."` 会缺少正文，因此必须提供实际 Release Notes，或先改造工作流读取方式。

---

## 5. CI/CD 发布规范

### 5.1 构建位置

正式版本由 GitHub Actions 构建，不在个人电脑或 RAK 生产服务器上构建。

CI 至少应完成：

- 后端单元测试；
- 后端集成测试；
- 前端类型检查和构建；
- lint 或静态检查；
- Docker 镜像构建；
- 默认发布 amd64 / arm64 多架构镜像；若明确仅支持单架构，必须记录部署架构并同步调整验证清单；
- 镜像版本、commit 和源仓库标签；
- 发布产物和镜像来源可追踪。

本仓库已有：

```text
.github/workflows/backend-ci.yml
.github/workflows/release.yml
.github/release-tools/release_matrix.py
.github/release-tools/release-images.sh
```

Fork 后必须审查发布配置，仅修改仍不符合自身用途的部分，特别是：

- Docker Hub 镜像名称；
- GHCR 镜像名称；
- GitHub Release 所属仓库；
- Docker 镜像 `org.opencontainers.image.source`；
- 通知内容中的仓库地址；
- 更新检查指向的仓库。

**已具备的能力：** 当前主发布路径的 GHCR owner、GitHub Release owner/repo、通知链接和镜像 source label 已动态使用 Fork 信息；`release-images.sh` 会覆盖 Dockerfile 中的 source label。当前仓库名仍为 `sub2api` 时，不需要为这些字段另写一套发布系统。若改仓库/包名，需另查脚本中固定的 `sub2api` 镜像名称。

不要全局替换所有 `Wei-Shaw`：上游署名、许可证、Go module/import 身份不应作为发布地址批量改写。其他直接使用 Dockerfile 的构建路径仍需分别核验标签。

### 5.2 推荐镜像仓库

优先使用 GHCR：

```text
ghcr.io/<github用户名或组织名>/sub2api:0.2.19-custom.1
```

也可以使用 Docker Hub：

```text
<dockerhub用户名>/sub2api:0.2.19-custom.1
```

当前 Fork 对应的默认 GHCR 镜像路径为 `ghcr.io/duanyongcheng/sub2api`。公开 GitHub 仓库不代表首次发布的 GHCR 包自动公开；需确认包可见性，或为生产服务器配置最小只读拉取凭据。正式发布前验证 Actions 的 `packages: write` 和包访问关系。

生产环境只需要 pull 自己的镜像，不需要保存项目源码。默认支持 amd64/arm64；现有 `SIMPLE_RELEASE=true` 或手动 `simple_release=true` 只产出 linux/amd64 镜像，不满足双架构要求，且不提供完整二进制资产。必须先确认 RAK 架构和实际分发范围再选择模式。

### 5.3 精确版本与浮动标签策略

当前 `.github/release-tools/release-images.sh` 在简单模式自动更新 `latest`，完整模式还会自动更新主/次版本标签，例如 `0`、`0.2`，没有排除 `-custom.N`。因此不能只检查 `latest`。

待实施要求：

- 每个版本发布精确 Tag，例如 `0.2.19-custom.1`，已发布的精确版本及其架构子标签不得重建覆盖。
- 定制版/候选版默认只推精确 Tag，不自动修改 `latest`、主版本或次版本标签。
- 若需要稳定浮动通道，应在验证后单独批准，将通道指向已经验证的 digest，而不是重新构建同一版本。
- 生产 Compose 使用精确版本，优先固定已记录的 digest；不得仅依赖浮动标签。
- 发布前检查同名 Release/镜像是否存在；部分发布失败时先核对已上传产物。禁止通过覆盖旧镜像让重试“看起来成功”。无法安全复用已验证产物时使用新版本号。

### 5.4 待实施：发布资格、校验与失败行为

**已核验缺口：** `release.yml` 接受全部 `v*` Tag；`release_matrix.py` 只校验版本和 Tag/checkout SHA。发布 job 依赖构建 job，不依赖独立的 `backend-ci.yml` 结果。两个工作流同时触发不构成发布门禁，CI 失败时当前实现仍可能发布镜像。

**适用入口与输入契约：** Tag push 和 `workflow_dispatch` 的非 dry-run 发布必须走同一校验。输入至少包含目标 Tag、解析后的 commit SHA、明确配置的集成分支、构建架构和发布模式；发布期间所有 checkout、版本、校验记录与产物必须绑定同一 SHA。

- 触发器可先限定 `v*-custom.*`，脚本仍需严格校验正式格式 `vX.Y.Z-custom.N`：`X/Y/Z` 为合法 SemVer 数字，`N` 为从 1 开始、无前导零的整数。使用其他品牌时统一修改规则，不能只改触发器。
- 目标 commit 必须属于用户批准的集成历史；日常新版本默认使用最新 `origin/main`。仅仅“是祖先”不能代替审批和测试。
- 在发布路径内执行复用的必要测试，或以最小只读权限核验该**确切 SHA** 的可信 CI 结果。不能拿另一分支、旧 SHA 或 PR 临时合并 SHA 的绿色结果替代。
- `dry_run=true` 可接受分支/ref，但不得推镜像、创建 Release、移动通道或写默认分支。当前 dry run 的版本来自所选源码 `VERSION`，不能单独证明真实 Tag 的版本解析和通道逻辑正确，还需覆盖相应测试。
- 首次实际上传前必须完成以上校验；发布凭据只在需要发布的 job 使用。

| 场景 / 校验结果 | 必须采取的行为 |
|---|---|
| 新正式定制 Tag，获批集成 commit，确切 SHA 检查全通过 | 允许构建并发布精确版本，记录 digest |
| 官方 `v0.2.18`、格式不合法或未定义的 RC Tag | 拒绝定制正式发布，不上传任何产物 |
| Tag 与 checkout 不一致、commit 不属于获批集成历史 | 立即失败，不通过切换引用“自动修正” |
| 检查失败、未完成、缺失或无法读取 | 阻止发布，不能默认放行 |
| 同名 Release/精确镜像已存在 | 停止并核验是否为部分发布；禁止静默覆盖 |
| dry run | 可以构建/测试；所有外部发布和版本写回均为零 |

**必要回归断言：** 同时覆盖 Tag push/手动入口、正常正式版本、未定义/非法 Tag、错误 SHA、CI 缺失/失败、重复版本、简单/完整架构和 dry run 零发布副作用。候选版不能更新浮动标签，正式版也只能按批准的通道策略更新。

错误做法是“CI 另起一个工作流，所以 release 已受保护”；正确做法是“发布动作在同一 SHA 的必要检查全部通过后才能执行”。

### 5.5 待实施：移除直接写默认分支的版本回写

当前 `release.yml` 的 `sync-version-file` 会在镜像/Release 发布后直接修改并 push 默认分支。默认分支与发布源码不一致时会写错分支；启用 PR 保护后可能被拒绝，形成“产物已发布但工作流红灯”的部分成功状态。

推荐删除直接写回 job，不给机器人绕过分支保护的权限。`release_matrix.py` 已将 Tag 去掉 `v` 后的版本写入构建用 `VERSION` 并交给二进制构建，发布产物不依赖事后修改源码。若需要同步源码中的 `VERSION`，另开受保护、经过检查的 PR，不移动发布 Tag。

### 5.6 待实施：定制回归与 CI 对齐

当前前端 CI 执行根目录的 `make test-frontend`，它只运行 `FRONTEND_CRITICAL_VITEST` 指定的测试。下列定制测试尚未加入该清单：

```text
frontend/src/features/channel-monitor-v2/__tests__/AvailabilityBoard.spec.ts
frontend/src/features/channel-monitor-v2/__tests__/MonitorSettingsPanel.spec.ts
frontend/src/views/user/__tests__/ChannelStatusV2View.availability.spec.ts
```

必须将它们纳入 required checks，或改为运行完整前端测试；同时在 PR 阶段验证前端生产构建。后端继续覆盖 API Key 自助切组、身份隔离、限流与分组选择回归。发布工具的版本/通道/门禁测试、部署脚本检查也应纳入 CI。

只有实际执行到这些断言，才能声称“CI 已验证定制功能”；新增测试文件本身不代表 CI 会运行它。

---

## 6. 生产 Compose 规范

推荐单独维护生产文件：

```text
deploy/docker-compose.prod.yml
```

生产 Compose 的镜像必须通过环境变量控制：

```yaml
services:
  sub2api:
    image: ${SUB2API_IMAGE:?set SUB2API_IMAGE}:${SUB2API_VERSION:?set SUB2API_VERSION}
```

`${变量:?错误信息}` 用于在缺失镜像或版本时直接报错，避免误用空值。生产服务器的 `.env` 示例：

```dotenv
SUB2API_IMAGE=ghcr.io/<自己的账号>/sub2api
SUB2API_VERSION=0.2.19-custom.1
```

不要在生产配置中直接写：

```yaml
image: weishaw/sub2api:latest
```

也不要把开发配置中的 `build:` 用法当作生产部署方式。

生产服务器只保存：

- `docker-compose.prod.yml`；
- `.env`；
- 数据目录或 Docker volume；
- 必要的配置文件；
- 备份脚本和运维脚本。

下文的 `docker compose` 命令假设已选择正确的生产文件。若文件名是 `docker-compose.prod.yml`，需在同目录 `.env` 设置：

```dotenv
COMPOSE_FILE=docker-compose.prod.yml
```

或每条命令显式使用 `docker compose -f docker-compose.prod.yml ...`。Docker Compose 不会自动发现这个自定义文件名。首次整理不能直接搬动现有数据目录或改变 Compose project name/卷名，应先确认挂载仍指向原有数据。

生产服务器不需要保存：

- 完整 Git 源码；
- `node_modules`；
- Go 编译缓存；
- 本地 Docker build context。

---

## 7. RAK 服务器升级流程

假设生产目录为：

```text
/opt/sub2api/deploy
```

升级前先确认当前状态：

```bash
cd /opt/sub2api/deploy

docker compose ps
docker compose images

docker compose logs --tail=100 sub2api
```

### 7.1 升级前检查

1. 阅读本次 Release Notes，记录当前和目标的版本、commit、镜像 digest；
2. 核验当前数据库迁移记录与目标代码的兼容性，不能只看程序版本文本；
3. 备份 PostgreSQL，记录备份时间、位置与校验结果，并在隔离环境验证可恢复；
4. 确认上一版本镜像仍可拉取，并明确它能否使用升级后的数据库；
5. 确认目标镜像已推送、部署架构与 GHCR 拉取权限正确；
6. 在测试环境运行目标版本，准备维护窗口、停写方案与失败处置。

**首次迁移特别限制：** 本次仓库审查没有访问 RAK，尚未核验其实际镜像与数据库。如果生产已经执行过旧 `main` 的 `247/248` 迁移，再部署仅基于 `v0.2.18` 的代码可能是降级，必须单独评估；分支整理不构成生产升级授权。

### 7.2 更新版本

修改 `.env`：

```dotenv
SUB2API_VERSION=0.2.19-custom.1
```

然后逐条执行并确认成功；拉取失败时停止，不继续重建旧缓存镜像：

```bash
docker compose pull sub2api
docker compose up -d --no-deps --force-recreate sub2api
```

`--no-deps` 仅适用于应用镜像独立升级。若本次还要求调整 PostgreSQL、Redis、网络或配置，必须另写协调升级方案；不能通过此命令跳过依赖升级。保持原 Compose project name、数据挂载和凭据不变。

### 7.3 更新后验证

```bash
docker compose ps
docker compose logs --tail=200 sub2api
docker compose exec -T sub2api /app/sub2api --version
curl --fail --silent --show-error --connect-timeout 2 --max-time 5 \
  --retry 20 --retry-delay 3 --retry-max-time 90 --retry-connrefused \
  http://127.0.0.1:8080/health
```

健康检查应在有限重试后明确失败，不能无限等待或忽略退出码。宿主机端口以实际配置为准。当前 `backend/internal/server/routes/common.go` 的 `/health` 直接返回 `status: ok`，**只能证明 HTTP 进程存活，不能证明 PostgreSQL、Redis 或业务就绪**。

还应检查：

- 页面可以打开；
- 管理员可以登录；
- 数据库连接正常；
- Redis 连接正常；
- API 请求正常；
- V2 可用性面板、筛选/刷新、分组详情与 API Key 自助切组/限流正常；
- 容器没有持续重启；
- 任一关键项失败则停止放量，按预先确认的兼容性与数据恢复方案处置，不盲目重复重启。

不要只执行：

```bash
docker compose restart
```

因为它只会重启旧容器，不会保证拉取并使用新镜像。升级时应使用：

```bash
docker compose pull sub2api
docker compose up -d --no-deps --force-recreate sub2api
```

---

## 8. 回滚规范

### 8.1 镜像回滚

将 `.env` 改回上一版本：

```dotenv
SUB2API_VERSION=0.2.18-custom.1
```

先按第 8.2 节确认数据库兼容或完成恢复，再执行；命令逐步核验，任一步失败就停止：

```bash
docker compose pull sub2api
docker compose up -d --no-deps --force-recreate sub2api
docker compose exec -T sub2api /app/sub2api --version
curl --fail --silent --show-error --connect-timeout 2 --max-time 5 \
  --retry 20 --retry-delay 3 --retry-max-time 90 --retry-connrefused \
  http://127.0.0.1:8080/health
```

回滚后同样执行第 7.3 节的依赖与业务验证，不能只检查 HTTP 存活。

### 8.2 数据库回滚注意事项

本项目数据库迁移是前向迁移。新版本启动后，可能已经执行数据库结构升级；旧版本不一定能够直接使用新结构。

因此：

- 镜像回滚不等于数据库回滚；
- 有数据库迁移的版本必须先做备份；
- 生产升级前必须阅读迁移说明；
- 需要恢复备份时，先进入维护状态并停止应用及其他写入方，保留故障现场/当前数据快照，再按已演练方案恢复；
- 恢复升级前备份会丢失该备份之后的写入，必须事先确认可接受的数据损失范围和补偿方案；若不能接受，应评估前向修复或经验证的时间点恢复方案；
- 备份文件存在不等于能恢复；必须核验完整性、恢复过程及恢复后的业务数据；
- 禁止把 `docker compose down -v` 当作普通回滚命令。

特别注意：

```bash
docker compose down -v
```

可能删除数据库卷，生产环境禁止随意执行。

---

## 9. 镜像版本、commit 和 digest 验证

容器内版本：

```bash
docker compose exec -T sub2api /app/sub2api --version
```

镜像信息：

```bash
docker image inspect '<镜像名>:<版本>' \
  --format '{{json .Config.Labels}}'
```

重点检查：

```text
org.opencontainers.image.version
org.opencontainers.image.revision
org.opencontainers.image.source
```

查看镜像 digest：

```bash
docker image inspect '<镜像名>:<版本>' \
  --format '{{index .RepoDigests 0}}'
```

更严格的生产部署可以在 `.env` 中固定 digest：

```dotenv
SUB2API_IMAGE=ghcr.io/<自己的账号>/sub2api
SUB2API_VERSION=0.2.19-custom.1@sha256:<digest>
```

固定 digest 可以避免同一个 Tag 被重新推送后，服务器拉到不同内容。CI 发布后应输出并记录 registry 返回的 manifest/index digest，部署时与拉取结果核对；多架构 index digest、平台 manifest digest 和本地 image ID 不是同一概念，不要拿 image ID 代替可拉取的 digest。

同时通过 `docker compose ps -q sub2api` 获取运行容器，再用 `docker inspect <容器ID>` 核对其镜像引用和 image ID。只检查本地某个 Tag 的 labels，不足以证明运行中的容器已经切换到该镜像。

---

## 10. 禁止容器内部自动替换二进制

本项目的后台更新功能原本面向官方发布的二进制版本，并且代码中存在官方仓库地址配置，例如：

```text
backend/internal/service/update_service.go
frontend/src/components/common/VersionBadge.vue
```

Fork 后必须选择一种策略：

### 推荐策略：Docker 部署禁用应用内更新

Docker 环境统一通过：

```bash
docker compose pull
docker compose up -d --force-recreate
```

进行升级。

应用内“更新/回滚”容易出现以下问题：

- 下载官方仓库而不是自己的 Fork；
- 替换容器内二进制，但容器重建后丢失；
- 应用显示版本与镜像版本不一致；
- 破坏容器不可变部署原则。

待实施要求：明确容器部署模式/能力开关，前端隐藏或禁用二进制更新和回滚按钮，**后端也必须拒绝对应写操作**，覆盖 `PerformUpdate`、`Rollback`、`RollbackToVersion` 及其 HTTP 入口。只隐藏 UI 或约定“不点击”不是执行边界；必须有直接调用接口仍被拒绝、二进制未改动的回归测试。

当前服务仍指向官方仓库，且没有满足上述要求的容器专用拦截；在完成改造前只能视为已知风险，不能宣称应用内更新已经禁用。

### 备选策略：改成自己的仓库

如果确实需要应用内更新，必须同步修改：

- 更新检查仓库；
- Release 下载地址；
- 回滚版本列表，以及 GitHub prerelease / latest 的筛选策略；
- 定制版本比较：当前 `parseVersion` 去掉 `-` 后缀，导致 `custom.1` 和 `custom.2` 被视为相同版本，现有回滚候选还会过滤 prerelease；
- 允许下载的域名和资产校验；
- Docker 部署下的更新行为；
- 前端文案和仓库链接。

在没有完成上述改造前，生产 Docker 环境不要使用应用内更新按钮。

**安装脚本也在审查范围内：** `.goreleaser.yaml` 的 Release 文案虽然链接到 Fork 的 `main/deploy/install.sh`，但该脚本内部 `GITHUB_REPO` 仍是 `Wei-Shaw/sub2api`，版本提取还会截断定制后缀。因此“从 Fork 下载脚本”不等于“安装 Fork 版本”。Docker-only 发行应删除不受支持的一键二进制安装说明；若保留，则需完整适配下载源、版本、校验、升级/回滚及分支链接并测试，不能只改 URL。

---

## 11. 发布前检查清单

### 代码和分支

- [ ] 当前工作在自己的 Fork 仓库；
- [ ] `origin` 指向自己的仓库；
- [ ] `upstream` 指向官方仓库；
- [ ] 官方更新通过 `sync/upstream-vX.Y.Z` 合并；
- [ ] 已完成第 2 节的集成分支选择和初始化，定制历史完整保留；
- [ ] 自定义修改已经合并到自己的 `main`（或已明确选定的集成分支）；
- [ ] 集成分支及发布 Tag 的保护规则生效，未要求线性历史；
- [ ] 工作区干净；
- [ ] 没有把 `.env`、密码、Token 提交到 Git；
- [ ] `git diff --check` 通过。

### 版本

- [ ] 使用新的自定义版本号；
- [ ] Tag 没有重复；
- [ ] Tag 指向已批准集成 commit，且该确切 SHA 的必要检查全部通过；
- [ ] `backend/cmd/server/VERSION` 与发布版本一致，或发布流程明确注入 Tag 派生的构建版本；
- [ ] 版本号不会误覆盖官方 Tag；
- [ ] GitHub prerelease 状态与正式/候选通道策略明确；
- [ ] 已移除直接写默认分支的版本回写；
- [ ] Tag 正文包含上游基线、定制变更、迁移与回滚说明。

### 测试

- [ ] 后端单元测试通过；
- [ ] 后端集成测试通过；
- [ ] 前端 typecheck 通过；
- [ ] 前端测试通过，且 CI 实际运行了定制监控回归用例；
- [ ] 前端生产构建通过；
- [ ] 发布门禁、版本/通道和 dry run 零发布副作用测试通过；
- [ ] Docker 模式直接调用应用更新/回滚接口也被拒绝；
- [ ] Docker 镜像构建成功；
- [ ] 测试镜像启动成功；
- [ ] `/health` 检查通过；
- [ ] 关键业务流程验证完成。

### 发布

- [ ] GitHub Actions 成功；
- [ ] GHCR 或 Docker Hub 中存在目标 Tag；
- [ ] amd64 / arm64 镜像存在；若批准单架构发布，已明确记录限制并核验生产架构；
- [ ] 镜像 labels 中的 version、revision、source 正确；
- [ ] GitHub Release 已生成；
- [ ] Release Notes 已检查；
- [ ] 记录镜像 digest，精确版本未被覆盖、浮动通道未被未经批准地更新；
- [ ] 生产服务器能以预期权限拉取自己的镜像。

### 生产升级

- [ ] 数据库已经备份，且已验证可恢复、明确恢复后的数据损失范围；
- [ ] 已核验生产迁移记录与目标代码兼容，尤其是首次迁移的 `247/248` 风险；
- [ ] 当前版本和目标版本已记录；
- [ ] 回滚版本仍然可用；
- [ ] `.env` 只修改了目标版本；
- [ ] 使用 `docker compose pull`；
- [ ] 使用 `--force-recreate`；
- [ ] 升级后检查运行容器的镜像身份、日志、版本和有限重试的健康接口；
- [ ] 额外完成数据库、Redis 和定制业务冒烟检查，而非仅凭 `/health` 判定成功；
- [ ] 升级结果已记录。

---

## 12. 推荐的日常操作模板

这些模板仅用于首次迁移和发布改造完成之后。先确认目标分支、干净工作区和操作授权；有未提交修改时使用独立 worktree。发布与生产变更不因完成文档或 PR 而自动获准。所有 `<…>`、`X.Y.Z`、`N` 都是待替换占位符，不应原样执行；命令按顺序逐条核验，任一步失败就停止。

### 同步官方版本

```bash
git fetch upstream --prune --tags
git fetch origin --prune --tags
# 按第 3.2 节核验官方目标 Tag 的 commit 来源，冲突时停止
git switch main
git pull --ff-only origin main
git switch -c sync/upstream-vX.Y.Z
git merge --no-ff vX.Y.Z -m "sync(upstream): merge vX.Y.Z"
# 解决冲突并测试
git push -u origin sync/upstream-vX.Y.Z
# GitHub PR 合并到 main
```

### 开发自定义功能

```bash
git switch main
git pull --ff-only origin main
git switch -c 'feature/<功能名>'
# 开发、测试、提交
git push -u origin 'feature/<功能名>'
# GitHub PR 合并到 main
```

### 发布自定义版本

统一使用第 4.2 节的完整模板，不维护省略门禁的简化版：

1. 确认已完成第 5.4～5.6 节改造，目标基线/版本正确；
2. 确认集成 commit 的确切 SHA 检查通过，并获得发布批准；
3. 核验干净工作区、本地与远端一致、Tag 未使用；
4. 创建带完整正文的附注 Tag，只推送这一枚 Tag；
5. 等待发布成功，核对版本、架构、labels、Release Notes 和 digest。

发布阶段不执行主分支 push；分支变更必须事先通过 PR 完成。

### RAK 生产升级

先完成第 7.1 节检查；逐条执行并确认成功，失败时停止，不整段忽略错误继续运行。

```bash
cd /opt/sub2api/deploy
# 修改 .env 中的 SUB2API_VERSION
docker compose pull sub2api
docker compose up -d --no-deps --force-recreate sub2api
docker compose exec -T sub2api /app/sub2api --version
curl --fail --silent --show-error --connect-timeout 2 --max-time 5 \
  --retry 20 --retry-delay 3 --retry-max-time 90 --retry-connrefused \
  http://127.0.0.1:8080/health
docker compose logs --tail=200 sub2api
```

还需完成第 7.3 节的数据库、Redis 与定制业务验证，以及第 9 节的运行容器身份核验。

### RAK 生产回滚

必须先按第 8.2 节确认数据库兼容性或完成恢复；逐条执行并核验结果。

```bash
cd /opt/sub2api/deploy
# 将 .env 中的 SUB2API_VERSION 改回上一版本
docker compose pull sub2api
docker compose up -d --no-deps --force-recreate sub2api
docker compose exec -T sub2api /app/sub2api --version
curl --fail --silent --show-error --connect-timeout 2 --max-time 5 \
  --retry 20 --retry-delay 3 --retry-max-time 90 --retry-connrefused \
  http://127.0.0.1:8080/health
```

回滚后同样执行依赖、业务与镜像身份核验。

---

## 13. 当前仓库的待改造项

以下都是**待实施/待验证事项**，不能因本文已更新就标记完成。优先顺序是“确定集成分支 → 发布改造 → CI/演练 → 正式发布 → 生产迁移”，不是先打 Tag 再修工作流。

### 13.1 改造文件范围

优先审查下列文件，仅修改实际不符合目标契约的部分：

```text
.github/workflows/backend-ci.yml
.github/workflows/release.yml
.github/release-tools/release-images.sh
.github/release-tools/release_matrix.py
.github/release-tools/test_release_matrix.py
.goreleaser.yaml
.goreleaser.simple.yaml
Makefile
Dockerfile
Dockerfile.goreleaser
deploy/Dockerfile
deploy/docker-compose.yml
deploy/docker-compose.local.yml
deploy/docker-compose.standalone.yml
deploy/.env.example
deploy/DOCKER.md
deploy/install.sh
backend/internal/service/update_service.go
backend/internal/handler/admin/system_handler.go
backend/internal/server/routes/admin.go
frontend/src/components/common/VersionBadge.vue
README.md
README_CN.md
DEV_GUIDE.md
```

按需新增 `deploy/docker-compose.prod.yml`、发布门禁/镜像标签测试和上游通知工作流；实际生产 `.env`、凭据与备份不进入 Git。新文件不因出现在规划中就视为存在。

### 13.2 分阶段落地与验收

| 阶段 | 主要工作 | 完成条件 |
|---|---|---|
| 1. 方案确认与分支初始化 | 用户选择第 2.3 节方案；保留暂存修改、旧远端历史及 6 个定制提交，设定默认分支 | 核验分支 SHA、跟踪关系、PR base；没有强推或未经批准引入 `247/248` |
| 2. 发布基础设施 PR | 自定义 Tag/确切 SHA 的 CI 门禁、移除版本直接回写、精确镜像与通道策略、定制前端测试/构建 | 第 5.4 节失败矩阵和 CI 检查有实际测试证据；不可绕过测试发布 |
| 3. 部署与更新安全 PR | 自己的生产 Compose、镜像/版本必填、容器内更新/回滚的服务端限制、安装脚本说明清理 | 拒绝接口测试、Compose 检查、版本/labels/架构验证通过；保留现有数据挂载 |
| 4. 仓库设置与演练 | 分支/Tag 保护、GHCR 权限、需要时启用 Issues；不发布的 dry run | required checks 名称正确，能构建并验证目标架构，无外部发布或默认分支写回 |
| 5. 首次正式发布 | 用户另行批准后创建新的定制 Tag；仍基于 `v0.2.18` 时使用 `v0.2.18-custom.1` | 镜像和 Release 可追溯、精确 Tag 未覆盖、digest 已记录；版本发布失败不自动重发覆盖 |
| 6. RAK 生产迁移 | 核验现有代码与数据库、演练备份恢复、按精确版本/digest 拉取 | 生产授权明确；迁移兼容，健康/依赖/业务检查通过，回滚方案可执行 |

### 13.3 后续同步时必须保留的 Fork 契约

- 在同步 PR/关联记录中保存官方基线 Tag/SHA、已有 backport 和定制功能清单；机器可读基线文件若新增，也必须跟随实际合并更新。
- 每次同步都复查发布门禁、浮动标签策略、版本注入、更新器限制和定制测试，避免上游改动重新打开风险。
- 保持 `SUB2API_IMAGE` / `SUB2API_VERSION`（可带 digest）的部署契约，生产不回到官方 `latest` 或常规 `docker save` / `docker load` 流程。
- 默认集成分支不是上游镜像分支，不用无审查的 Fork Sync 覆盖它。
- 仓库分支与 CI 核验不能证明 RAK 实际状态；未访问的生产、未执行的构建/测试必须如实标记为未验证。

---

## 14. 结论

推荐的最终生产模式是：

```text
Fork 仓库
  + upstream 官方仓库
  + sync/upstream-vX.Y.Z 同步分支
  + main 生产集成分支
  + feature/fix 开发分支
  + vX.Y.Z-custom.N 自定义发布 Tag
  + GitHub Actions 自动构建镜像
  + GHCR 或自己的 Docker Hub
  + RAK 服务器固定版本 pull
  + 数据库备份、健康检查和可回滚
```

最重要的三条规则：

1. **不要在生产服务器手工构建并复制镜像作为常规流程。**
2. **不要用 `latest` 作为生产版本。**
3. **每次生产部署必须能关联到明确的 Git Tag、commit SHA 和镜像 digest。**
