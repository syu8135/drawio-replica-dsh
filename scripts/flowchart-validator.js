#!/usr/bin/env node
/**
 * flowchart-validator.js
 * 流程图提示词验证器
 *
 * 功能：
 * 1. 检查节点类型是否正确使用（矩形、菱形、平行四边形、圆角矩形）
 * 2. 检查流程逻辑是否合理（开始/结束、判断分支、回环等）
 * 3. 提供优化建议
 *
 * GB/T 1526 符号规范：
 * - 圆角矩形：开始/结束/结果状态
 * - 矩形：处理步骤/操作
 * - 菱形：判断/决策（是/否分支）
 * - 平行四边形：输入/输出（数据、提示、显示）
 *
 * 用法：
 *   const { validateFlowchart } = require('./flowchart-validator');
 *   const result = validateFlowchart(nodes, flows);
 *   console.log(result.report);
 */

// ============ 符号规范定义 ============
const SYMBOL_RULES = {
  start: {
    name: '开始',
    shape: '圆角矩形',
    description: '流程起点',
    validTypes: ['start'],
    examples: ['开始', '启动', '初始化']
  },
  end: {
    name: '结束',
    shape: '圆角矩形',
    description: '流程终点',
    validTypes: ['end', 'result'],
    examples: ['结束', '完成', '进入系统', '退出']
  },
  process: {
    name: '处理',
    shape: '矩形',
    description: '操作、处理步骤、功能执行',
    validTypes: ['process'],
    examples: ['登录页面', '点击登录', '验证密码', '保存数据']
  },
  decision: {
    name: '判断',
    shape: '菱形',
    description: '条件判断、分支决策（必须有是/否分支）',
    validTypes: ['decision'],
    examples: ['是否已注册？', '验证结果？', '密码正确？']
  },
  io: {
    name: '输入/输出',
    shape: '平行四边形',
    description: '数据输入、结果显示、提示信息',
    validTypes: ['io'],
    examples: ['提示：账号不存在', '显示错误', '输入密码', '输出结果']
  }
};

// ============ 验证规则 ============
const VALIDATION_RULES = {
  // 规则 1：必须有且仅有一个开始节点
  mustHaveSingleStart: (nodes) => {
    const starts = nodes.filter(n => n.type === 'start');
    if (starts.length === 0) {
      return { valid: false, message: '❌ 缺少开始节点（圆角矩形）' };
    }
    if (starts.length > 1) {
      return { valid: false, message: `❌ 有 ${starts.length} 个开始节点，应该只有 1 个` };
    }
    return { valid: true };
  },

  // 规则 2：建议有结束节点（或结果节点）
  shouldHaveEnd: (nodes) => {
    const ends = nodes.filter(n => n.type === 'end' || n.type === 'result');
    if (ends.length === 0) {
      return { valid: false, message: '⚠️ 缺少结束/结果节点（圆角矩形）', severity: 'warning' };
    }
    return { valid: true };
  },

  // 规则 3：判断节点必须有分支
  decisionMustHaveBranches: (nodes, flows) => {
    const decisions = nodes.filter(n => n.type === 'decision');
    const issues = [];

    for (const decision of decisions) {
      const outgoing = flows.filter(f => f.from === decision.id);
      if (outgoing.length < 2) {
        issues.push(`⚠️ 判断节点"${decision.text}"只有 ${outgoing.length} 个出口，应该有 2 个（是/否）`);
      }

      // 检查是否有"是"和"否"标签
      const hasYes = outgoing.some(f => f.label && f.label.includes('是'));
      const hasNo = outgoing.some(f => f.label && f.label.includes('否'));
      if (!hasYes || !hasNo) {
        issues.push(`⚠️ 判断节点"${decision.text}"的分支缺少"是/否"标签`);
      }
    }

    return issues.length > 0
      ? { valid: false, message: issues.join('\n') }
      : { valid: true };
  },

  // 规则 4：检查节点类型是否合理
  checkNodeTypeAppropriateness: (nodes) => {
    const issues = [];

    for (const node of nodes) {
      const text = node.text.toLowerCase();

      // 检查是否应该用菱形（判断类词汇）
      if (node.type !== 'decision') {
        const decisionKeywords = ['是否', '？', '?', '判断', '检查', '验证'];
        if (decisionKeywords.some(kw => text.includes(kw))) {
          issues.push(`⚠️ "${node.text}"包含判断类词汇，建议使用菱形（decision），当前使用${SYMBOL_RULES[node.type].shape}`);
        }
      }

      // 检查是否应该用平行四边形（提示/显示类词汇）
      if (node.type !== 'io') {
        const ioKeywords = ['提示', '显示', '输出', '输入', '打印', '提示：'];
        if (ioKeywords.some(kw => text.includes(kw))) {
          issues.push(`⚠️ "${node.text}"包含输入/输出类词汇，建议使用平行四边形（io），当前使用${SYMBOL_RULES[node.type].shape}`);
        }
      }

      // 检查是否应该用圆角矩形（开始/结束/结果类词汇）
      if (node.type !== 'start' && node.type !== 'end' && node.type !== 'result') {
        const startEndKeywords = ['开始', '结束', '完成', '进入系统', '退出', '启动'];
        if (startEndKeywords.some(kw => text.includes(kw))) {
          issues.push(`⚠️ "${node.text}"是起止/结果类词汇，建议使用圆角矩形，当前使用${SYMBOL_RULES[node.type].shape}`);
        }
      }

      // 检查矩形是否被误用为判断或输入输出
      if (node.type === 'process') {
        // 已经在上面检查过了
      }
    }

    return issues.length > 0
      ? { valid: false, message: issues.join('\n') }
      : { valid: true };
  },

  // 规则 5：检查流程连通性
  checkConnectivity: (nodes, flows) => {
    const issues = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    // 检查是否有孤立节点
    for (const node of nodes) {
      const hasIncoming = flows.some(f => f.to === node.id);
      const hasOutgoing = flows.some(f => f.from === node.id);

      if (!hasIncoming && node.type !== 'start') {
        issues.push(`⚠️ 节点"${node.text}"没有入线（除了开始节点）`);
      }
      if (!hasOutgoing && node.type !== 'end' && node.type !== 'result') {
        issues.push(`⚠️ 节点"${node.text}"没有出线（除了结束/结果节点）`);
      }
    }

    // 检查是否有未定义的节点引用
    for (const flow of flows) {
      if (!nodeIds.has(flow.from)) {
        issues.push(`❌ 连线引用了未定义的节点：${flow.from}`);
      }
      if (!nodeIds.has(flow.to)) {
        issues.push(`❌ 连线引用了未定义的节点：${flow.to}`);
      }
    }

    return issues.length > 0
      ? { valid: false, message: issues.join('\n') }
      : { valid: true };
  },

  // 规则 6：检查回环逻辑
  checkReturnLogic: (nodes, flows) => {
    const issues = [];
    const returnFlows = flows.filter(f => f.isReturn);

    for (const flow of returnFlows) {
      const fromNode = nodes.find(n => n.id === flow.from);
      const toNode = nodes.find(n => n.id === flow.to);

      if (!fromNode || !toNode) continue;

      // 回环应该回到前面的节点，不是后面的节点
      const fromIdx = nodes.findIndex(n => n.id === flow.from);
      const toIdx = nodes.findIndex(n => n.id === flow.to);

      if (fromIdx < toIdx) {
        issues.push(`⚠️ 回环"${fromNode.text}"→"${toNode.text}"是向前回环，可能是逻辑错误`);
      }
    }

    return issues.length > 0
      ? { valid: false, message: issues.join('\n') }
      : { valid: true };
  }
};

// ============ 主验证函数 ============
function validateFlowchart(nodes, flows) {
  const results = [];
  let allValid = true;

  // 运行所有验证规则
  const rules = [
    VALIDATION_RULES.mustHaveSingleStart,
    VALIDATION_RULES.shouldHaveEnd,
    VALIDATION_RULES.decisionMustHaveBranches,
    VALIDATION_RULES.checkNodeTypeAppropriateness,
    VALIDATION_RULES.checkConnectivity,
    VALIDATION_RULES.checkReturnLogic
  ];

  for (const rule of rules) {
    const result = rule(nodes, flows);
    results.push(result);

    if (!result.valid && result.severity !== 'warning') {
      allValid = false;
    }
  }

  // 生成报告
  const report = generateReport(nodes, flows, results);

  return {
    valid: allValid,
    results,
    report
  };
}

// ============ 生成报告 ============
function generateReport(nodes, flows, results) {
  let report = '═══════════════════════════════════════\n';
  report += '  流程图提示词验证报告\n';
  report += '═══════════════════════════════════════\n\n';

  // 基本信息
  report += `📊 基本信息：\n`;
  report += `  节点数：${nodes.length}\n`;
  report += `  连线数：${flows.length}\n`;
  report += `  判断节点：${nodes.filter(n => n.type === 'decision').length}\n`;
  report += `  回环连线：${flows.filter(f => f.isReturn).length}\n\n`;

  // 符号使用统计
  report += ` 符号使用统计：\n`;
  const typeCounts = {};
  for (const node of nodes) {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts)) {
    const rule = SYMBOL_RULES[type];
    if (rule) {
      report += `  ${rule.shape}：${count} 个（${rule.name}）\n`;
    }
  }
  report += '\n';

  // 验证结果
  report += `🔍 验证结果：\n`;
  let hasIssues = false;
  for (const result of results) {
    if (!result.valid) {
      hasIssues = true;
      report += `${result.message}\n\n`;
    }
  }

  if (!hasIssues) {
    report += `✅ 所有验证通过！提示词合理。\n\n`;
  }

  // 优化建议
  report += `💡 优化建议：\n`;
  report += generateSuggestions(nodes, flows);

  report += '\n═══════════════════════════════════════\n';

  return report;
}

// ============ 生成优化建议 ============
function generateSuggestions(nodes, flows) {
  const suggestions = [];

  // 建议 1：检查是否有可以合并的节点
  const processNodes = nodes.filter(n => n.type === 'process');
  if (processNodes.length > 8) {
    suggestions.push(`⚠️ 处理节点较多（${processNodes.length} 个），考虑是否可以合并或简化流程`);
  }

  // 建议 2：检查判断节点是否过多
  const decisionNodes = nodes.filter(n => n.type === 'decision');
  if (decisionNodes.length > 5) {
    suggestions.push(`⚠️ 判断节点较多（${decisionNodes.length} 个），流程可能过于复杂`);
  }

  // 建议 3：检查是否有长路径
  const maxDepth = calculateMaxDepth(nodes, flows);
  if (maxDepth > 10) {
    suggestions.push(`⚠️ 流程深度较大（${maxDepth} 层），考虑是否可以并行或简化`);
  }

  // 建议 4：检查回环是否合理
  const returnFlows = flows.filter(f => f.isReturn);
  for (const flow of returnFlows) {
    const fromNode = nodes.find(n => n.id === flow.from);
    const toNode = nodes.find(n => n.id === flow.to);
    if (fromNode && toNode) {
      // 错误提示应该回环到输入节点，不是判断节点
      if (fromNode.type === 'io' && toNode.type === 'decision') {
        suggestions.push(` "${fromNode.text}"→"${toNode.text}"：错误提示通常应该回环到输入节点，而不是判断节点`);
      }
    }
  }

  if (suggestions.length === 0) {
    return '  无额外建议，流程设计合理。\n';
  }

  return suggestions.map(s => `  ${s}`).join('\n') + '\n';
}

// ============ 计算最大深度 ============
function calculateMaxDepth(nodes, flows) {
  const startNode = nodes.find(n => n.type === 'start');
  if (!startNode) return 0;

  let maxDepth = 0;
  const visited = new Set();

  function dfs(nodeId, depth) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    maxDepth = Math.max(maxDepth, depth);

    const outgoing = flows.filter(f => f.from === nodeId);
    for (const flow of outgoing) {
      dfs(flow.to, depth + 1);
    }

    visited.delete(nodeId);
  }

  dfs(startNode.id, 0);
  return maxDepth;
}

module.exports = { validateFlowchart, SYMBOL_RULES, VALIDATION_RULES };
