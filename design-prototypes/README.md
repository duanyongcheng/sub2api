# Sub2API · 前端菜单梳理与 UI 重设计原型

本目录是基于仓库 `frontend/` 现状做的**信息架构分析 + 高保真原型**，含 9 个可交互页面与 2 份文档。

## 先看什么

0. **`flow.html` / `docs/00-设计主线.md`** —— **设计主线**：把 13 个页面串成「一条请求穿过系统」的链路（建议第一个看）
1. **`index.html`** —— 原型总览页（缩略图墙，双击打开）
2. **`docs/01-前端菜单与功能点分析.md`** —— 前端有哪些菜单、每个页面有哪些功能点、对应哪些接口
3. **`docs/02-设计规范与实现映射.md`** —— 设计令牌、组件规格、原型到路由/接口的映射、落地建议
4. **`docs/03-渠道监控设计方案.md`** —— 渠道监控专项：真实流量 + 主动探测的证据模型、错误归因、与现有接口的对照
5. **`docs/04-账号池融合设计方案.md`** —— 账号池融合方案：紧凑主表、完整功能保留、批量范围、详情交互及真实数据边界（方案稿，尚未实施）

## 原型清单

| 文件 | 页面 | 说明 |
|---|---|---|
| `01-user-workbench.html` | 用户 · 工作台 | `/dashboard` |
| `02-api-keys.html` / `02-api-keys-dark.html` | 用户 · API 密钥 | `/keys`，含新建抽屉 |
| `03-admin-overview.html` / `03-admin-overview-dark.html` | 管理 · 运营概览 | `/admin/dashboard` |
| `04-admin-accounts.html` | 管理 · 账号池 | `/admin/accounts` |
| `05-admin-groups.html` | 管理 · 分组与定价 | `/admin/groups` |
| `06-admin-channel-monitor.html` | 管理 · 渠道监控 | `/admin/channels/monitor` |
| `07-admin-ops.html` | 管理 · 运维监控 | `/admin/ops` |
| `08-admin-orders.html` | 管理 · 订单与支付 | `/admin/orders`（直接打开为退款弹窗态，`#orders` 为列表态） |
| `09-auth-and-status.html` | 登录 / 用户端渠道状态 | `/login`、`/monitor`（`#status` 深链） |
| `10-user-channel-status.html` | **渠道监控专项** · 用户端服务状态 | `/monitor`（见 docs/03） |
| `11-admin-monitor-board.html` / `-dark.html` | **渠道监控专项** · 管理端主看板 | `/admin/channels/monitor`（见 docs/03） |
| `12-admin-monitor-settings.html` | **渠道监控专项** · 监控设置抽屉 | 同上 |
| `13-admin-monitor-drill.html` | **渠道监控专项** · 下钻复盘抽屉 | 同上 |
| `14-admin-account-pools.html` | **账号池重设计** · 按池管理 | `/admin/accounts`（平台→分组树 + 混合分组 + 池头 + 池内账号 + 账号抽屉；左下角可切换降级 / simple / 深色等演示状态；规格见 `.trellis/tasks/11-10-accounts-redesign/prd.md`） |

## 目录

```
assets/   proto.css（设计令牌）、shell.css（框架）、icons.svg.html（图标 sprite）、build.py（构建脚本）
src/pages/ 页面源文件（改这里）
shots/   所有页面截图（1600 宽，含深色）
docs/    分析文档
```

## 修改与重新构建

```bash
# 修改 src/pages/ 下的源文件后
python3 assets/build.py                      # 构建全部
python3 assets/build.py 03-admin-overview.html   # 或只构建单页
```

构建会把图标 sprite、运行时脚本、侧边栏/顶栏外壳注入到根目录的同名 HTML 中，产物可直接双击打开（无网络依赖）。
