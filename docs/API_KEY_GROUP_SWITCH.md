# API Key 自助切换分组

员工可以使用自己的 API Key 查看所属公司账号可用的分组，并修改这把 Key 当前绑定的分组。使用现有 `api_keys.group_id` 和用户分组权限，无需新增配置或数据库迁移。

## 查看可用分组

```bash
curl https://api.example.com/v1/key/groups \
  -H 'Authorization: Bearer sk-employee-key'
```

响应沿用管理 API 的 JSON 信封：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {"id": 10, "name": "OpenAI Standard", "platform": "openai"},
    {"id": 12, "name": "OpenAI Pro", "platform": "openai"}
  ]
}
```

只返回该 Key 所属用户有权限绑定的活跃分组：公开分组遵循现有公开分组限制；专属分组需要用户授权；订阅分组需要有效订阅。`Accept-Language` 可控制分组名称的语言。

本接口使用独立的轻量分组查询，不读取账号数量统计。原有网页分组接口及其统计字段不变。

## 切换当前分组

```bash
curl -X PUT https://api.example.com/v1/key/group \
  -H 'Authorization: Bearer sk-employee-key' \
  -H 'Content-Type: application/json' \
  -d '{"group_id":12}'
```

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "api_key_id": 123,
    "group_id": 12,
    "group_name": "OpenAI Pro"
  }
}
```

`group_id` 必须是正整数，目标分组必须活跃并通过所属用户的分组权限和订阅检查。接口只修改用于鉴权的 Key，不能通过路径或请求体选择其他 Key，也不能解绑分组。切换不重置 Key 的额度、用量、限额、有效期或 IP 限制。

成功后失效该 Key 的鉴权缓存，后续新请求使用更新后的分组。同一个 Key 的所有客户端都会受影响；已开始的请求和已建立的 WebSocket 连接继续使用原来的分组，需要重新建立连接才能切换。

## 接口限频

按 API Key ID、操作类型分别计数，使用 Redis 共享固定 60 秒窗口（从首次请求起算）：

| 接口 | 每把 Key 的限额 |
| --- | --- |
| `GET /v1/key/groups` | 30 次/分钟 |
| `PUT /v1/key/group` | 10 次/分钟 |

两个额度独立；同公司、同出口 IP 的不同员工 Key 互不占用额度，多实例共享计数。限频仅作用于这两个自助接口，不消耗模型调用额度，也不影响原页面接口或普通模型请求。通过身份鉴权后的调用会计入次数，即使后续参数或目标分组校验失败。

超限返回 `429`，`code` 为 `API_KEY_SELF_SERVICE_RATE_LIMITED`，`Retry-After` 为距窗口重置剩余秒数。限频服务故障时只暂停自助接口，返回 `503 API_KEY_SELF_SERVICE_UNAVAILABLE` 和 `Retry-After: 5`，避免无保护地持续查询数据库。

## 鉴权与错误

两个接口支持 `Authorization: Bearer`、`x-api-key` 和 `x-goog-api-key`，不接受 URL 查询参数传递 Key，也不接受面板 JWT 作为 API Key。

Key 必须存在且未过期、未停用，用户必须启用，请求必须通过 Key 的 IP 限制。Key 额度耗尽或公司余额不足时仍可管理分组，切换不会恢复额度或绕过普通 API 的计费检查。当前分组缺失、停用、被删除、授权撤销或订阅失效不阻止使用这两个接口，目标分组仍需独立校验。

| 情况 | HTTP 状态 |
| --- | --- |
| 缺少或无效 Key、Key 停用、用户停用 | 401 |
| Key 已过期或 IP 受限 | 403 |
| 缺少 `group_id`、非整数、0 或负数 | 400 |
| 目标分组不存在 | 404 |
| 目标分组停用 | 400（`GROUP_NOT_ACTIVE`） |
| 无目标分组权限或无有效订阅 | 403（`GROUP_NOT_ALLOWED`） |
| 自助接口调用超限 | 429（`API_KEY_SELF_SERVICE_RATE_LIMITED`） |
| 自助接口限频服务不可用 | 503（`API_KEY_SELF_SERVICE_UNAVAILABLE`） |

业务错误沿用现有响应结构中的 `reason` 字段。鉴权和限频错误沿用网关的 `code` / `message` 结构。

普通网关 API 继续使用已有的未分组拦截规则，`allow_ungrouped_key_scheduling` 默认关闭；自助接口不受该拦截影响。切换事件写入服务端结构化日志，记录 Key ID、用户 ID、旧/新分组 ID、IP 和时间，不记录密钥原文。
