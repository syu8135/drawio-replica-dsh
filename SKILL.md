---
name: drawio-replica-dsh
description: DSH 版 Draw.io 复刻 Skill - 模板驱动，AI 描述结构，引擎自动布局+套用风格
---

# Draw.io Replica Skill for DSH（Phase 1）

## 功能说明

将参考图片或文字描述复刻为可编辑的 Draw.io (.drawio) 文件。

**核心思路**：AI 只描述"有什么"，模板决定"长什么样"，引擎负责"放哪里"。

## 两种模式

### 模式 A：模板 + 结构描述（推荐）

AI 只需描述结构和内容，系统自动套用模板风格 + 计算坐标。

```json
{
  "template": "layered",
  "title": "载流子输运微观机制",
  "layers": [
    {
      "id": "drift",
      "title": "Drift",
      "items": [
        {"text": "漂移"},
        {"text": "扩散"},
        {"text": "散射"}
      ],
      "params": [
        {"text": "漂移速度"},
        {"text": "迁移率"},
        {"text": "浓度梯度"}
      ],
      "note": "浓度梯度（dn/dx）引起的定向运动"
    }
  ],
  "sidebar": {
    "title": "重要输运现象",
    "categories": ["物理图像", "浓度梯度"],
    "properties": ["流子波动性", "多种样散射", "非平衡函数", "非定向运动"]
  }
}
```

**AI 不需要写**：坐标、颜色、字号、间距

### 模式 B：精确坐标（传统模式）

```json
{
  "page": {"width": 800, "height": 600},
  "shapes": [
    {"type": "rect", "x": 100, "y": 100, "w": 120, "h": 60, "text": "节点", "style": {"fillColor": "#C8E6FF"}}
  ],
  "connections": [
    {"from": 0, "to": 1, "style": {"endArrow": "classic"}}
  ]
}
```

## 可用模板

### 科研绘图模板

| 模板 ID | 名称 | 适用场景 |
|---------|------|---------|
| `layered` | 分层技术路线图 | 催化/材料/化学技术路线、研究框架 |
| `radial` | 同心圆机理图 | 催化机理、核心概念层次关系 |
| `cycle-segmented` | 分段同心圆图 | 循环流程、教学体系、业务闭环 |

### 工程图模板（新增）

| 模板 ID | 名称 | 适用场景 |
|---------|------|---------|
| `flowchart` | 流程图 | 业务流程、操作步骤、决策流程 |
| `swimlane` | 泳道图 | 多角色协作流程、跨部门流程 |
| `usecase` | 用例图 | UML 用例图、角色与功能关系 |
| `erd` | E-R 图 | 数据库实体关系图 |
| `architecture` | 架构图 | 系统技术架构、分层架构 |

## 模板风格

### layered（分层图）

- **配色**：红蓝经典（深红项目 + 浅蓝参数 + 粉红层背景）
- **布局**：平行四边形层堆叠 + 右侧侧边栏
- **字体**：标题 18pt，层标题 16pt，项目 11pt，参数 10pt

### radial（同心圆图）

- **配色**：紫色渐变（外浅内深）
- **布局**：多层同心圆 + 角度标注
- **字体**：标题 18pt，中心 14pt，标注 10pt

### cycle-segmented（分段同心圆图）

- **配色**：橙/黄/红/蓝（外环橙色 + 中环黄色 + 内环红色 + 中心蓝色）
- **布局**：多段同心圆环 + 中心圆 + 角度标注文字
- **字体**：标题 18pt，中心主标题 20pt，中心副标题 12pt，环标注 14pt，外环大字 24pt

### flowchart（流程图）

- **配色**：绿色（开始/结束）+ 蓝色（流程）+ 橙色（判断）+ 紫色（输入输出）
- **布局**：网格自动排列，支持直线连接
- **字体**：标题 18pt，节点 12pt
- **形状**：椭圆（开始/结束）、矩形（流程）、菱形（判断）、平行四边形（输入输出）

### swimlane（泳道图）

- **配色**：5 种泳道背景色（蓝/紫/绿/橙/红）+ 蓝色节点
- **布局**：垂直泳道 + 节点自动居中
- **字体**：标题 18pt，泳道 14pt，节点 12pt

### usecase（用例图）

- **配色**：蓝色（参与者）+ 绿色（用例）+ 橙色（系统边界）
- **布局**：左侧参与者 + 右侧用例 + 系统边界框
- **字体**：标题 18pt，参与者 12pt，用例 11pt

### erd（E-R 图）

- **配色**：蓝色（实体）+ 绿色（属性）+ 橙色（主键）+ 紫色（关系）
- **布局**：实体网格排列 + 属性环绕 + 关系连线
- **字体**：标题 18pt，实体 14pt，属性 11pt

### architecture（架构图）

- **配色**：4 种层背景色（蓝/紫/绿/橙）+ 蓝色组件
- **布局**：水平分层 + 组件自动居中
- **字体**：标题 18pt，层 14pt，组件 12pt

## 使用方式

### 直接调用

```bash
node "D:\soft\dsh-home\work\skills\drawio-replica-dsh\scripts\create_drawio_from_plan.js" \
  --plan "plan.json" \
  --output "output.drawio"
```

脚本自动检测：
- 有 `template` 或 `layout` 字段 → 模板模式（自动布局+风格）
- 无 → 坐标模式（传统）

### 质量检查与自动修正

生成 .drawio 后，可运行质量检查器：

```bash
# 基础检查
node "D:\soft\dsh-home\work\skills\drawio-replica-dsh\scripts\drawio-quality-checker.js" output.drawio

# 自动修正问题
node "D:\soft\dsh-home\work\skills\drawio-replica-dsh\scripts\drawio-quality-checker.js" output.drawio --fix

# 生成 SVG 预览并自动打开
node "D:\soft\dsh-home\work\skills\drawio-replica-dsh\scripts\drawio-quality-checker.js" output.drawio --preview

# 完整流程：修正 + 预览
node "D:\soft\dsh-home\work\skills\drawio-replica-dsh\scripts\drawio-quality-checker.js" output.drawio --fix --preview
```

**质量检查项**：
- ✅ XML 格式验证
- ✅ 元素数量检查（1-200）
- ✅ 坐标范围检查（0-9000）
- ✅ 文字长度检查（<200 字符）
- ✅ 字号范围检查（8-48pt）
- ✅ 布局重叠检查（排除同心圆和文字覆盖）

**自动修正功能**：
- 🔧 修正超出范围的坐标
-  修正异常字号
-  截断过长文字
- 🔧 修正后自动重新检查

### 通过 DSH 调用（自然语言输入）

```
用户："画一个用户登录的流程图，包含开始、输入账号密码、验证、成功、失败、结束"
AI:
  1. 理解意图 → 选择 flowchart 模板
  2. 提取节点和流程
  3. 生成 JSON
  4. 调用脚本
  5. 返回 .drawio 文件

用户："画一个电商订单的泳道图，包含用户、商家、平台三个角色"
AI:
  1. 理解意图 → 选择 swimlane 模板
  2. 提取泳道和节点
  3. 生成 JSON
  4. 调用脚本
  5. 返回 .drawio 文件
```

### 自然语言→图 示例

| 用户输入 | 自动选择模板 |
|---------|-------------|
| "画一个流程图..." | `flowchart` |
| "画一个泳道图..." | `swimlane` |
| "画一个用例图..." | `usecase` |
| "画一个 E-R 图..." | `erd` |
| "画一个架构图..." | `architecture` |
| "画一个同心圆..." | `radial` |
| "画一个分层图..." | `layered` |
| "画一个循环图..." | `cycle-segmented` |

## 结构化 JSON 格式

### layered 模板

```json
{
  "template": "layered",
  "title": "图标题",
  "layers": [
    {
      "id": "唯一ID",
      "title": "层标题（右侧）",
      "subtitle": "副标题（可选）",
      "leftLabel": "左侧标签（可选）",
      "items": [{"text": "项目文字"}],
      "params": [{"text": "参数文字"}],
      "mechanisms": [{"text": "机制文字", "type": "diamond"}],
      "note": "备注文字"
    }
  ],
  "sidebar": {
    "title": "侧边栏标题",
    "categories": ["分类1", "分类2"],
    "properties": ["属性1", "属性2", "属性3", "属性4"]
  }
}
```

### radial 模板

```json
{
  "template": "radial",
  "title": "图标题",
  "center": {"text": "中心文字"},
  "rings": [
    {
      "radius": 350,
      "dashed": true,
      "labels": [
        {"text": "标注文字", "angle": -45, "bold": true}
      ]
    }
  ]
}
```

### cycle-segmented 模板

```json
{
  "template": "cycle-segmented",
  "title": "产教融合实战基座",
  "center": {
    "text": "产教融合实战基座",
    "subtitle": "海浪智学/真实场景/双轨评测"
  },
  "rings": [
    {
      "radius": 400,
      "labels": [
        {"text": "学", "angle": -135, "bold": true, "style": {"fontSize": 24}},
        {"text": "评", "angle": -45, "bold": true, "style": {"fontSize": 24}}
      ]
    },
    {
      "radius": 300,
      "labels": [
        {"text": "智能采集", "angle": -90, "bold": true}
      ]
    }
  ]
}
```

### flowchart 模板

```json
{
  "template": "flowchart",
  "title": "用户登录流程",
  "nodes": [
    {"id": "start", "type": "start", "text": "开始"},
    {"id": "input", "type": "io", "text": "输入账号密码"},
    {"id": "validate", "type": "decision", "text": "验证通过？"},
    {"id": "success", "type": "process", "text": "登录成功"},
    {"id": "end", "type": "end", "text": "结束"}
  ],
  "flows": [
    {"from": "start", "to": "input"},
    {"from": "input", "to": "validate"},
    {"from": "validate", "to": "success", "label": "是"},
    {"from": "validate", "to": "fail", "label": "否"}
  ]
}
```

### swimlane 模板

```json
{
  "template": "swimlane",
  "title": "电商订单流程",
  "lanes": [
    {
      "name": "用户",
      "nodes": [
        {"id": "u1", "text": "浏览商品"},
        {"id": "u2", "text": "下单"}
      ]
    },
    {
      "name": "商家",
      "nodes": [
        {"id": "m1", "text": "发货"}
      ]
    }
  ],
  "flows": [
    {"from": "u1", "to": "u2"},
    {"from": "u2", "to": "m1"}
  ]
}
```

### usecase 模板

```json
{
  "template": "usecase",
  "title": "用户管理用例图",
  "systemName": "用户管理系统",
  "actors": [
    {"name": "普通用户"},
    {"name": "管理员"}
  ],
  "usecases": [
    {"name": "登录"},
    {"name": "注册"},
    {"name": "修改密码"},
    {"name": "管理用户"}
  ],
  "associations": [
    {"actor": "普通用户", "usecase": "登录"},
    {"actor": "普通用户", "usecase": "注册"},
    {"actor": "管理员", "usecase": "管理用户"}
  ]
}
```

### erd 模板

```json
{
  "template": "erd",
  "title": "电商系统 E-R 图",
  "entities": [
    {
      "name": "用户",
      "attributes": [
        {"name": "用户 ID", "isKey": true},
        {"name": "姓名"},
        {"name": "邮箱"}
      ]
    },
    {
      "name": "订单",
      "attributes": [
        {"name": "订单 ID", "isKey": true},
        {"name": "金额"},
        {"name": "日期"}
      ]
    }
  ],
  "relationships": [
    {"from": "用户", "to": "订单", "name": "下单"}
  ]
}
```

### architecture 模板

```json
{
  "template": "architecture",
  "title": "系统架构图",
  "layers": [
    {
      "name": "前端层",
      "components": [
        {"name": "Web 端"},
        {"name": "移动端"},
        {"name": "小程序"}
      ]
    },
    {
      "name": "后端层",
      "components": [
        {"name": "API 网关"},
        {"name": "业务服务"},
        {"name": "数据服务"}
      ]
    },
    {
      "name": "数据层",
      "components": [
        {"name": "MySQL"},
        {"name": "Redis"},
        {"name": "MongoDB"}
      ]
    }
  ],
  "connections": [
    {"from": "Web 端", "to": "API 网关"},
    {"from": "API 网关", "to": "业务服务"},
    {"from": "业务服务", "to": "MySQL"}
  ]
}
```

## 文件结构

```
drawio-replica-dsh/
├── SKILL.md
├── templates/                 # 模板定义
│   ├── layered.json          # 分层图模板
│   ├── radial.json           # 同心圆图模板
│   ├── cycle-segmented.json  # 分段同心圆图模板
│   ├── flowchart.json        # 流程图模板
│   ├── swimlane.json         # 泳道图模板
│   ├── usecase.json          # 用例图模板
│   ├── erd.json              # E-R 图模板
│   └── architecture.json     # 架构图模板
├── scripts/                   # 核心脚本
├── examples/                  # 模板示例（学习用）
└── output/                    # 生成的架构图（用户作品）
```

## 使用方式
│   ├── create_drawio_from_plan.js   # 生成器
│   └── layout_engine.js             # 布局引擎
└── examples/
    ├── simple-flow.json              # 简单流程图（坐标式）
    ├── hospital-er.json              # 医院ER图（坐标式）
    ├── carrier-transport-structural.json  # 载流子（模板式）
    ├── education-beautiful.json      # 产教融合（美观版）
    ├── login-flowchart.json          # 登录流程图（新增）
    └── ecommerce-swimlane.json       # 电商泳道图（新增）
```

## 环境要求

| 组件 | 要求 |
|------|------|
| 操作系统 | Windows / macOS / Linux |
| Node.js | 14.0+ |
| Draw.io | 可选（桌面版用于导出） |

## 快速开始

1. 确保 Node.js 已安装
2. 提供参考图或文字描述
3. AI 分析结构，选择模板
4. 生成结构化 JSON
5. 执行脚本生成 .drawio
6. 在 draw.io 中微调（5分钟）
7. 导出为 PNG/SVG

## 输出格式

| 格式 | 说明 | 用途 |
|------|------|------|
| `.drawio` | 可编辑文件 | 在 draw.io 中修改 |
| `.svg` | 预览图 | 快速查看效果 |

## 输出位置

生成的架构图存放在 `output/` 文件夹，与模板示例分开。

## 导出方式

### 在线版
1. 打开 https://app.diagrams.net
2. 拖入 .drawio 文件
3. 文件 → 导出为 → PNG/SVG

### 桌面版
```bash
draw.io --export --format png --output output.png input.drawio
```

## 与 Visio COM 方案对比

| 特性 | Visio COM | Draw.io |
|------|-----------|---------|
| 依赖 | 必须安装 Visio | 仅需 Node.js |
| 图形类型 | 15种（多种占位） | 100+种 |
| 布局方式 | 坐标式 | 模板+自动布局 |
| 风格控制 | 手动 | 模板保证 |
| 输出格式 | .vsdx | .drawio/.svg |
| 跨平台 | 仅 Windows | 全平台 |
| 生成速度 | 慢 | 快 |
