# 流程图生成器使用指南（带验证）

##  文件结构

```
skills/drawio-replica-dsh/scripts/
├── flowchart-validator.js                    # 提示词验证器
├── layout_flowchart_academic_v3.js           # 布局引擎 v3
├── generate_flowchart_with_validation.js     # 带验证的生成器（推荐）
├── generate_flowchart_v3.js                  # 直接生成器（跳过验证）
└── test-validator.js                         # 验证器测试
```

##  快速开始

### 1. 准备数据文件

**nodes.json** - 节点定义：
```json
[
  { "id": "start", "text": "开始", "type": "start" },
  { "id": "login_page", "text": "登录页面", "type": "process" },
  { "id": "check_register", "text": "是否已注册？", "type": "decision" },
  { "id": "success", "text": "进入系统", "type": "result" }
]
```

**flows.json** - 连线定义：
```json
[
  { "from": "start", "to": "login_page", "label": "" },
  { "from": "login_page", "to": "check_register", "label": "" },
  { "from": "check_register", "to": "success", "label": "是", "isBranch": true, "direction": "right" }
]
```

### 2. 运行生成器

```bash
node scripts/generate_flowchart_with_validation.js \
  --nodes nodes.json \
  --flows flows.json \
  --output output/login-flow.drawio
```

### 3. 查看验证报告

生成器会先输出验证报告：

```
═══════════════════════════════════════
  流程图提示词验证报告
═══════════════════════════════════════

📊 基本信息：
  节点数：12
  连线数：15
  判断节点：3
  回环连线：3

 符号使用统计：
  圆角矩形：1 个（开始）
  矩形：5 个（处理）
  菱形：3 个（判断）
  平行四边形：2 个（输入/输出）

🔍 验证结果：
✅ 所有验证通过！提示词合理。

💡 优化建议：
  无额外建议，流程设计合理。
```

## 📐 GB/T 1526 符号规范

| 符号 | 形状 | 用途 | 示例 |
|------|------|------|------|
| **开始/结束** | 圆角矩形 | 流程起止、结果状态 | 开始、结束、进入系统 |
| **处理** | 矩形 | 操作、处理步骤 | 登录页面、点击登录、验证密码 |
| **判断** | 菱形 | 条件判断、分支决策 | 是否已注册？、验证结果？ |
| **输入/输出** | 平行四边形 | 数据输入、结果显示、提示 | 提示：账号不存在、输入密码 |

## 🔍 验证规则

### 规则 1：必须有且仅有一个开始节点
```json
// ✅ 正确
{ "id": "start", "text": "开始", "type": "start" }

// ❌ 错误：缺少开始节点
// ❌ 错误：多个开始节点
```

### 规则 2：判断节点必须有"是/否"分支
```json
// ✅ 正确
{ "from": "check_login", "to": "success", "label": "是", "isBranch": true }
{ "from": "check_login", "to": "error", "label": "否", "isBranch": true }

// ❌ 错误：缺少"是/否"标签
{ "from": "check_login", "to": "success", "label": "通过" }
```

### 规则 3：节点类型必须合理
```json
// ✅ 正确：判断类词汇用菱形
{ "id": "check1", "text": "是否已注册？", "type": "decision" }

//  错误：判断类词汇用矩形
{ "id": "check1", "text": "是否已注册？", "type": "process" }

// ✅ 正确：提示类词汇用平行四边形
{ "id": "msg1", "text": "提示：账号不存在", "type": "io" }

// ❌ 错误：提示类词汇用矩形
{ "id": "msg1", "text": "提示：账号不存在", "type": "process" }
```

### 规则 4：流程必须连通
```json
// ✅ 正确：所有节点都有入线和出线（除了开始/结束）
// ❌ 错误：孤立节点（没有入线或出线）
```

### 规则 5：回环逻辑必须合理
```json
// ✅ 正确：错误提示回环到输入节点
{ "from": "error_account", "to": "login_page", "isReturn": true }

// ⚠️ 警告：错误提示回环到判断节点（可能不合理）
{ "from": "error_account", "to": "check_login", "isReturn": true }
```

## 💡 常见错误示例

### 错误 1：符号误用
```json
// ❌ 错误
{ "id": "check1", "text": "是否登录？", "type": "process" }
{ "id": "msg1", "text": "显示错误", "type": "process" }
{ "id": "end1", "text": "进入系统", "type": "process" }

// ✅ 正确
{ "id": "check1", "text": "是否登录？", "type": "decision" }
{ "id": "msg1", "text": "显示错误", "type": "io" }
{ "id": "end1", "text": "进入系统", "type": "result" }
```

### 错误 2：缺少分支标签
```json
// ❌ 错误
{ "from": "check1", "to": "process1", "label": "" }
{ "from": "check1", "to": "process2", "label": "" }

// ✅ 正确
{ "from": "check1", "to": "process1", "label": "是", "isBranch": true }
{ "from": "check1", "to": "process2", "label": "否", "isBranch": true }
```

### 错误 3：流程不连通
```json
// ❌ 错误：isolated_node 没有入线
{ "id": "isolated_node", "text": "孤立节点", "type": "process" }

// ✅ 正确：所有节点都有入线
{ "from": "start", "to": "isolated_node", "label": "" }
```

## ️ 高级用法

### 1. 跳过验证（直接生成）
```bash
node scripts/generate_flowchart_v3.js --nodes nodes.json --flows flows.json
```

### 2. 仅验证（不生成）
```javascript
const { validateFlowchart } = require('./flowchart-validator');
const result = validateFlowchart(nodes, flows);
console.log(result.report);
```

### 3. 自定义验证规则
```javascript
const { VALIDATION_RULES } = require('./flowchart-validator');

// 添加自定义规则
VALIDATION_RULES.myCustomRule = (nodes, flows) => {
  // 你的验证逻辑
  return { valid: true, message: '...' };
};
```

## 📊 输出文件

| 文件 | 说明 |
|------|------|
| `output/flowchart.drawio` | Draw.io 流程图（可编辑） |
| `output/flowchart.svg` | SVG 预览（只读） |

## 🎯 最佳实践

1. **先验证，后生成**：使用 `generate_flowchart_with_validation.js`
2. **遵循符号规范**：矩形=处理，菱形=判断，平行四边形=输入/输出
3. **标注分支标签**：判断节点的出线必须有"是/否"标签
4. **保持流程连通**：所有节点都应该有入线和出线
5. **合理设计回环**：错误提示应该回环到输入节点，不是判断节点

---

**版本**：v1.0  
**更新日期**：2026-09-05  
**作者**：DSH 流程图生成器项目
