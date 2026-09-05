#!/usr/bin/env node
/**
 * generate_flowchart_with_validation.js
 * 带验证的流程图生成器
 *
 * 流程：
 * 1. 验证提示词（节点类型、流程逻辑）
 * 2. 如果验证不通过，显示优化建议并暂停
 * 3. 如果验证通过，生成流程图
 *
 * 用法：
 *   node generate_flowchart_with_validation.js --nodes <nodes.json> --flows <flows.json> --output <output.drawio>
 */

const fs = require('fs');
const path = require('path');
const { validateFlowchart } = require('./flowchart-validator');
const { FlowchartLayout } = require('./layout_flowchart_academic_v3');

// 解析命令行参数
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--') && i + 1 < args.length) {
    params[args[i].slice(2)] = args[i + 1];
    i++;
  }
}

// 检查必需参数
if (!params.nodes || !params.flows) {
  console.log('用法：node generate_flowchart_with_validation.js --nodes <nodes.json> --flows <flows.json> [--output <output.drawio>]');
  console.log('\n示例：');
  console.log('  node generate_flowchart_with_validation.js --nodes nodes.json --flows flows.json --output login-flow.drawio');
  process.exit(1);
}

// 读取节点和连线数据
let nodes, flows;
try {
  nodes = JSON.parse(fs.readFileSync(params.nodes, 'utf-8'));
  flows = JSON.parse(fs.readFileSync(params.flows, 'utf-8'));
} catch (err) {
  console.error(`❌ 读取文件失败：${err.message}`);
  process.exit(1);
}

console.log('═══════════════════════════════════════\n');
console.log('  步骤 1：验证提示词\n');
console.log('═══════════════════════════════════════\n');

// 验证提示词
const validationResult = validateFlowchart(nodes, flows);
console.log(validationResult.report);

// 如果有严重问题，暂停并询问用户
if (!validationResult.valid) {
  console.log('\n⚠️  提示词存在以上问题，建议优化后再继续。\n');
  console.log('是否继续生成？（y/n）');

  // 在非交互模式下，直接退出
  if (!process.stdin.isTTY) {
    console.log('\n❌ 检测到问题，已停止生成。请优化提示词后重试。');
    process.exit(1);
  }

  // 交互模式下，等待用户输入
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data) => {
    const answer = data.trim().toLowerCase();
    process.stdin.pause();

    if (answer !== 'y' && answer !== 'yes') {
      console.log('\n❌ 已取消生成。请优化提示词后重试。');
      process.exit(0);
    }

    // 用户选择继续，执行生成
    generateFlowchart();
  });
} else {
  // 验证通过，直接生成
  console.log('\n✅ 提示词验证通过，开始生成流程图...\n');
  generateFlowchart();
}

// ============ 生成流程图 ============
function generateFlowchart() {
  console.log('═══════════════════════════════════════\n');
  console.log('  步骤 2：生成流程图\n');
  console.log('═══════════════════════════════════════\n');

  const layout = new FlowchartLayout(nodes, flows);
  const drawioXml = layout.generateDrawio();

  // 输出文件
  const outputPath = params.output || 'output/flowchart.drawio';
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, drawioXml, 'utf-8');

  console.log(`\n✅ Draw.io 文件已生成：${outputPath}`);
  console.log(`  节点数：${nodes.length}`);
  console.log(`  连线数：${flows.length}`);

  // 生成 SVG 预览
  const svgPath = outputPath.replace('.drawio', '.svg');
  const svgContent = generateSvg(layout);
  fs.writeFileSync(svgPath, svgContent, 'utf-8');
  console.log(`✅ SVG 预览已生成：${svgPath}`);

  console.log('\n═══════════════════════════════════════\n');
  console.log('  生成完成！\n');
  console.log('═══════════════════════════════════════\n');
}

// ============ SVG 生成器 ============
function generateSvg(layout) {
  const { CONFIG } = require('./layout_flowchart_academic_v3');
  const positions = layout.positions;
  const nodes = layout.nodes;
  const flows = layout.flows;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CONFIG.canvas.width}" height="${CONFIG.canvas.height}" viewBox="0 0 ${CONFIG.canvas.width} ${CONFIG.canvas.height}">
  <rect width="100%" height="100%" fill="white"/>
  
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#333333"/>
    </marker>
  </defs>
  
`;

  // 生成节点
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;

    switch (node.type) {
      case 'start':
      case 'end':
      case 'result':
        svg += `  <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="6" ry="6" fill="#F5F5F5" stroke="#333333" stroke-width="1.5"/>\n`;
        break;
      case 'process':
        svg += `  <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" fill="#FFFFFF" stroke="#333333" stroke-width="1.5"/>\n`;
        break;
      case 'decision':
        svg += `  <polygon points="${cx},${pos.y} ${pos.x + pos.w},${cy} ${cx},${pos.y + pos.h} ${pos.x},${cy}" fill="#F5F5F5" stroke="#333333" stroke-width="1.5"/>\n`;
        break;
      case 'io':
        const offset = 20;
        svg += `  <polygon points="${pos.x + offset},${pos.y} ${pos.x + pos.w},${pos.y} ${pos.x + pos.w - offset},${pos.y + pos.h} ${pos.x},${pos.y + pos.h}" fill="#FFFFFF" stroke="#333333" stroke-width="1.5"/>\n`;
        break;
    }

    svg += `  <text x="${cx}" y="${cy}" font-size="14" fill="#000000" text-anchor="middle" dominant-baseline="central" font-family="Arial">${node.text}</text>\n\n`;
  }

  // 生成连线
  for (const flow of flows) {
    const pathPoints = layout.calculatePath(flow.from, flow.to, flow.isReturn);
    if (pathPoints.length < 2) continue;

    const pointsStr = pathPoints.map(p => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
    const isLine = pathPoints.length === 2;

    if (isLine) {
      svg += `  <line x1="${pathPoints[0].x.toFixed(0)}" y1="${pathPoints[0].y.toFixed(0)}" x2="${pathPoints[1].x.toFixed(0)}" y2="${pathPoints[1].y.toFixed(0)}" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
    } else {
      svg += `  <polyline points="${pointsStr}" fill="none" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
    }

    if (flow.label) {
      const midIdx = Math.floor(pathPoints.length / 2);
      const midPoint = pathPoints[midIdx];
      svg += `  <text x="${midPoint.x.toFixed(0)}" y="${(midPoint.y - 6).toFixed(0)}" font-size="12" fill="#000000" text-anchor="middle" font-family="Arial">${flow.label}</text>\n`;
    }
  }

  svg += `</svg>\n`;
  return svg;
}
