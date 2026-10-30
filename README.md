<div align="center">

<img src="assets/logo.svg" alt="Sub2API Logo" width="128" />

# Sub2API

**由 [duanyongcheng](https://github.com/duanyongcheng) 持续维护的 AI API 网关**

多模型接入 · 渠道监控 · API Key 管理 · 用量与计费

[项目仓库](https://github.com/duanyongcheng/sub2api) · [变更与贡献](https://github.com/duanyongcheng/sub2api/pulls) · [上游项目](https://github.com/Wei-Shaw/sub2api)

</div>

## 关于本项目

本项目基于 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) Fork，由 [duanyongcheng](https://github.com/duanyongcheng) 维护后续开发、功能定制与版本集成。

Sub2API 将多个上游 AI 账号与服务接入统一网关，对外提供 API Key，集中处理鉴权、请求转发、账号调度、用量统计和计费。本仓库在原有能力上，重点完善渠道可用性监控、分组管理和日常运维体验。

本分支的功能说明、变更和维护以本仓库为准；上游更新会按需评估后合入。感谢原作者与所有贡献者提供的基础。

## 本仓库的定制功能

### 渠道可用性监控

V2 监控基于真实请求数据，按供应商、分组和模型展示可用率、平均首字延迟与历史状态，支持：

- 卡片、列表、状态矩阵和折线图。
- 按供应商组织可用性卡片，展开查看分组或模型明细。
- 搜索、多选筛选、异常优先排序和只看异常。
- 查看错误分类，区分计入可用率与已忽略的错误。
- 无流量或样本不足时显示未知状态。

用户监控入口为 `/monitor`，管理入口为 `/admin/channels/monitor`；需要在系统中选择 V2 模式。

配置方法与数据口径见 [V2 可用率监控](docs/channel-monitor-v2-availability.md)。现有 V1 主动探测和配额监控仍然保留；后续的主动监测改进会通过独立 PR 迭代。

### API Key 自助切换分组

持有 API Key 的用户可以查询自己有权使用的分组，并切换这把 Key 的当前分组，无需登录管理后台。

| 接口 | 用途 | 每把 Key 的限频 |
| --- | --- | --- |
| `GET /v1/key/groups` | 查询可用分组 | 30 次/分钟 |
| `PUT /v1/key/group` | 切换当前分组 | 10 次/分钟 |

分组权限和订阅检查沿用现有规则。切换只影响当前 API Key，不重置额度或用量；成功后，后续新请求使用新的分组。已建立的 WebSocket 连接需要重新连接。

请求示例和错误说明见 [API Key 自助切换分组](docs/API_KEY_GROUP_SWITCH.md)。

## 基础能力

- **多模型接入**：兼容 OpenAI、Anthropic、Gemini 等接口与客户端，按平台配置上游账号。
- **账号与密钥管理**：支持 OAuth、API Key 等账号类型，管理用户、分组及访问权限。
- **调度与流量控制**：支持多账号调度、粘性会话、并发限制和速率限制。
- **用量与计费**：记录请求用量与费用，提供余额、订阅及支付相关能力。
- **Web 管理界面**：管理渠道、账号、密钥、系统设置和运行状态。
- **简易模式**：可通过 `RUN_MODE=simple` 用于个人或内部团队场景，具体行为见部署配置。

## 快速开始：从本仓库构建

使用本仓库的源码构建，可以获得这里维护的定制功能。

### 环境准备

| 组件 | 当前配置 |
| --- | --- |
| Go | `1.27.3`，以 [backend/go.mod](backend/go.mod) 为准 |
| Node.js | 推荐 `24`，与 [Dockerfile](Dockerfile) 的构建环境一致 |
| pnpm | `9` |
| PostgreSQL / Redis | 需自行准备；现有 Compose 模板使用 PostgreSQL `18`、Redis `8` |

### 编译并启动

```bash
git clone https://github.com/duanyongcheng/sub2api.git
cd sub2api

# 配置前端包管理器
corepack enable
corepack prepare pnpm@9 --activate

# 编译前端
cd frontend
pnpm install --frozen-lockfile
pnpm run build

# 编译后端，并嵌入前端资源
cd ../backend
VERSION="$(./scripts/resolve-version.sh)"
go build -tags embed -ldflags="-X main.Version=${VERSION}" -o sub2api ./cmd/server

# 启动服务
./sub2api
```

首次启动前准备好 PostgreSQL 和 Redis，启动后访问 `http://localhost:8080`，通过设置向导配置数据库、Redis 和管理员账号。

**首次安装时让设置向导生成 `config.yaml`。** 预先复制配置文件可能使程序跳过向导；已有实例则继续使用自己的配置与数据。

### 本地开发

前端依赖安装完成后，在两个终端中分别运行：

```bash
# 终端一：在仓库根目录启动后端
cd backend
go run ./cmd/server
```

```bash
# 终端二：在仓库根目录启动前端
cd frontend
pnpm run dev
```

前端默认地址为 `http://localhost:3000`，开发代理默认连接 `http://localhost:8080`。

## 容器部署与更新

仓库包含 [Dockerfile](Dockerfile) 和 [Docker Compose 部署模板](deploy/docker-compose.local.yml)，可使用当前源码构建自己的镜像：

```bash
# 在仓库根目录执行
docker build -t sub2api-custom:local .
```

使用 Compose 部署这个版本时，需要把模板中 `sub2api` 服务的 `image` 改为自己构建或发布的镜像，再配置环境变量和持久化目录。详细配置参考 [部署文档](deploy/README.md) 和 [环境变量示例](deploy/.env.example)。

**当前继承自上游的部署入口仍有以下默认值：**

- Compose 模板默认拉取 `weishaw/sub2api:latest`。
- `deploy/install.sh` 和 `deploy/docker-deploy.sh` 仍指向上游仓库。
- 应用内的更新检查仍使用上游 Releases。

这些入口的默认行为会获取上游版本。使用本仓库的定制功能时，请使用本仓库源码构建的产物，并从自己的构建与部署流程更新。

分支管理、版本规划和发布改造说明见 [Fork 同步、发布与部署规范](docs/CUSTOM_FORK_RELEASE_WORKFLOW_CN.md)。该文档包含待实施项，具体支持情况以当前代码和发布记录为准。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [V2 可用率监控](docs/channel-monitor-v2-availability.md) | 监控视图、供应商配置、可用率口径 |
| [API Key 自助切换分组](docs/API_KEY_GROUP_SWITCH.md) | 接口、鉴权、权限与限频 |
| [部署说明](deploy/README.md) | 部署方式与运行配置，注意上述上游默认值 |
| [环境变量示例](deploy/.env.example) | 容器环境变量与配置说明 |
| [支付配置](docs/PAYMENT_CN.md) | 支付渠道配置 |
| [边缘代理与安全配置](deploy/EDGE_SECURITY.md) | 代理信任边界与客户端 IP 配置 |
| [Fork 同步、发布与部署规范](docs/CUSTOM_FORK_RELEASE_WORKFLOW_CN.md) | 上游同步、版本管理、发布与回滚规划 |

## 维护与贡献

本仓库由 [duanyongcheng](https://github.com/duanyongcheng) 维护。功能修改通过独立分支提交 PR，审查后合入 `main`；上游更新也会先评估与现有定制功能的兼容性。

提交问题或改进时，请注明所用 commit 或版本、部署方式、复现步骤和相关日志，并移除日志中的密钥等敏感信息。代码与文档贡献可通过 [Pull Requests](https://github.com/duanyongcheng/sub2api/pulls) 提交。

使用时请遵守相应模型服务商的条款。项目按许可证以现状提供，不保证上游服务的持续可用性。

## 来源与许可证

本项目 Fork 自 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)，保留原项目版权与许可证信息，并继续按 [GNU Lesser General Public License v3.0 或更高版本（LGPL-3.0-or-later）](LICENSE) 授权。

原项目版权声明：

```text
Copyright (c) 2026 Wesley Liddick
```

感谢原作者、上游维护者及所有贡献者。
