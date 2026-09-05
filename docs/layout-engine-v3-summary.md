# 流程图布局引擎 v3 优化总结

## 📁 文件结构

```
skills/drawio-replica-dsh/scripts/
├── layout_flowchart_academic_v3.js   # 核心布局引擎
├── generate_flowchart_v3.js          # 完整生成器（SVG + Draw.io）
├── test_layout_v2.js                 # 测试脚本
└── collision-check.js                # 碰撞检测工具（需更新）
```

## ✨ 核心优化

### 1. 分层布局算法
- **主流程垂直排列**：开始 → 登录页面 → 是否已注册？ → 已保存密码？ → 点击登录 → 验证结果？ → 进入系统
- **分支水平展开**：左侧（否/错误）、右侧（是/错误）
- **同层节点水平对齐**：手动输入/自动填充在同一 y 坐标

### 2. 智能路径规划
- **直接连接**：垂直/水平相邻节点，无中间点
- **L 形连接**：斜向节点，1 个弯折
- **回环路径**：就近连接同侧（左侧进左侧，右侧进右侧），2-3 个弯折
- **碰撞避免**：多策略绕行（直接水平 → 向上绕行 → 向下绕行）

### 3. 精确箭头连接
- **箭头偏移**：`CONFIG.arrow.length + CONFIG.arrow.visibleOffset = 9 + 7 = 16px`
- **入口点计算**：进入目标节点内部 16px，确保箭头清晰可见
- **出口点计算**：从源节点边缘出发

### 4. 优化的碰撞检测
- **忽略短线段**：< 20px 的线段（通常是连接到节点边缘的）
- **端点相交排除**：交点靠近线段端点（< 20% 长度或 < 20px）视为正常连接
- **中点检测**：线段中点在矩形内视为碰撞

## 📐 符号规范（GB/T 1526）

| 节点类型 | 形状 | 样式 |
|---------|------|------|
| 开始/结束/结果 | 圆角矩形 | `rx=6, ry=6, fill=#F5F5F5` |
| 处理步骤 | 矩形 | `fill=#FFFFFF` |
| 判断 | 菱形 | `fill=#F5F5F5` |
| 输入/输出 | 平行四边形 | `fill=#FFFFFF` |

## 🔧 配置参数

```javascript
const CONFIG = {
  canvas: { width: 1000, height: 700 },
  node: { width: 130, height: 40 },
  decision: { width: 100, height: 60 },
  spacing: { x: 100, y: 40 },
  margin: { top: 30, left: 40 },
  arrow: { length: 9, visibleOffset: 7 },
  collision: { minSegmentLength: 20, endpointThreshold: 0.2 }
};
```

## 📊 测试结果

### Draw.io 文件
- ✅ 质量检查通过
- ✅ 26 个图形（12 节点 + 14 连线）
- ✅ 11 个文字标签

### SVG 文件
- ⚠️ 碰撞检测器误报（边缘连接被识别为碰撞）
- ✅ 实际布局正确（与 Draw.io 一致）

## 🚀 使用方法

```javascript
const { FlowchartLayout } = require('./layout_flowchart_academic_v3');

const nodes = [
  { id: 'start', text: '开始', type: 'start' },
  { id: 'process1', text: '处理步骤', type: 'process' },
  // ...
];

const flows = [
  { from: 'start', to: 'process1', label: '' },
  { from: 'process1', to: 'decision1', label: '是', isBranch: true, direction: 'right' },
  // ...
];

const layout = new FlowchartLayout(nodes, flows);
const xml = layout.generateDrawio();
```

## 📝 待优化项

1. **碰撞检测器更新**：需要识别源/目标节点，排除边缘连接
2. **SVG 生成器优化**：使用边缘连接点（不进入节点内部）
3. **自动布局优化**：根据节点数量自动调整画布大小
4. **路径美化**：减少平行线，共享水平/垂直段

## 🎯 经验总结

1. **箭头连接规范**：
   - 线终点 = 目标节点边缘 - 箭头长度（约 9px）
   - 进入节点内部 5-10px，确保箭头清晰可见

2. **回环路径规范**：
   - 就近连接同侧（左侧进左侧，右侧进右侧）
   - 绕行边距：左侧 100px，右侧 canvas.width - 50px
   - 横平竖直，最少弯折

3. **碰撞检测规范**：
   - 忽略短线段（< 20px）
   - 排除端点相交（< 20% 长度或 < 20px）
   - 中点检测 + 四边相交检测

---

**版本**：v3.0  
**更新日期**：2026-09-05  
**作者**：DSH 布局引擎优化项目
