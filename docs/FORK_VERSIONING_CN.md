# Fork 版本与 upstream 基线

本仓库的发布版本和 upstream 版本使用两套编号：

- `fork_version` 是本仓库自己的产品版本，例如 `1.0.0`、`1.0.1`、`1.1.0`。
- `upstream_tag` 是最近一次完整整合的官方稳定 Tag，例如 `v0.2.19`。

两者不需要使用相同的版本号，也不需要给自己的版本增加 `-custom.N` 后缀。

当前基线记录在 [`upstream-baseline.json`](./upstream-baseline.json)：

```text
自己的版本：1.0.0
upstream Tag：v0.2.19
upstream commit：dece26153621959ccd7635814f4b2d08304e681a
```

每次同步 upstream 时，从自己的 `main` 创建 `sync/upstream-vX.Y.Z` 分支，合并官方 Tag，更新 `upstream-baseline.json`，通过 PR 合入 `main`。不要把抓取到的 upstream Tag 批量推送到自己的仓库。

每次自己的发布只更新 `backend/cmd/server/VERSION`，创建对应的自有 Tag，并让 Release Workflow 构建同名 Docker 版本：

```text
Git Tag：v1.0.0
Docker Tag：1.0.0
upstream 基线：v0.2.19
```

后续自有修复可以发布为 `v1.0.1`，功能版本可以发布为 `v1.1.0`；只有完成新的 upstream 整合时才更新基线文件中的 upstream Tag 和 commit。

更新检查、回滚链接和安装脚本应指向 `duanyongcheng/sub2api`，这样界面展示的“最新版本”来自自己的 Release。生产部署使用自己的精确 Docker Tag 或 digest，不使用 upstream 镜像或 `latest` 作为唯一版本依据。
