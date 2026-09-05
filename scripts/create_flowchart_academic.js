#!/usr/bin/env node
/**
 * create_flowchart_academic.js
 * 学术风格流程图生成器（独立版本）
 *
 * 用法：
 *   node create_flowchart_academic.js --plan login-flow-academic.json --output login-flow.drawio
 */

const fs = require('fs');
const path = require('path');
const { FlowchartLayout } = require('./layout_flowchart_academic');

// 命令行参数解析
const args = process.argv.slice(2);
let planPath = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plan' && args[i + 1]) planPath = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
}

if (!planPath || !outputPath) {
  console.error('用法：node create_flowchart_academic.js --plan <plan.json> --output <output.drawio>');
  process.exit(1);
}

if (!fs.existsSync(planPath)) {
  console.error(`错误：计划文件不存在：${planPath}`);
  process.exit(1);
}

// 读取计划
const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));

// 创建布局引擎
const layout = new FlowchartLayout(plan.nodes, plan.flows);

// 生成 Draw.io XML
const xml = layout.generateDrawio();

// 确保输出目录存在
const outDir = path.dirname(outputPath);
if (outDir && !fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 写入文件
fs.writeFileSync(outputPath, xml, 'utf-8');

console.log(`✅ 学术流程图生成成功：${outputPath}`);
console.log(`   画布：800×600`);
console.log(`   节点数：${plan.nodes.length}`);
console.log(`   连线数：${plan.flows.length}`);
