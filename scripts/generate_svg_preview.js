#!/usr/bin/env node
/**
 * generate_svg_preview.js
 * 从 Draw.io XML 生成 SVG 预览
 *
 * 用法：
 *   node generate_svg_preview.js --input <file.drawio> --output <file.svg>
 */

const fs = require('fs');
const path = require('path');

// 命令行参数解析
const args = process.argv.slice(2);
let inputPath = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) inputPath = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
}

if (!inputPath || !outputPath) {
  console.error('用法：node generate_svg_preview.js --input <file.drawio> --output <file.svg>');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`错误：输入文件不存在：${inputPath}`);
  process.exit(1);
}

// 读取 Draw.io XML
const xml = fs.readFileSync(inputPath, 'utf-8');

// 解析 mxGraphModel
const mxGraphMatch = xml.match(/<mxGraphModel[^>]*>/);
if (!mxGraphMatch) {
  console.error('错误：无法解析 mxGraphModel');
  process.exit(1);
}

// 提取画布尺寸
const pageWidthMatch = xml.match(/pageWidth="(\d+)"/);
const pageHeightMatch = xml.match(/pageHeight="(\d+)"/);
const width = pageWidthMatch ? parseInt(pageWidthMatch[1]) : 1000;
const height = pageHeightMatch ? parseInt(pageHeightMatch[1]) : 700;

// 解析所有 mxCell（支持多行）
const cellRegex = /<mxCell\s([^>]*)>([\s\S]*?)<\/mxCell>/g;
const cells = [];
let match;

while ((match = cellRegex.exec(xml)) !== null) {
  const attrs = match[1];
  const content = match[2];
  
  // 解析属性
  const idMatch = attrs.match(/id="([^"]*)"/);
  const valueMatch = attrs.match(/value="([^"]*)"/);
  const styleMatch = attrs.match(/style="([^"]*)"/);
  const vertexMatch = attrs.match(/vertex="1"/);
  const edgeMatch = attrs.match(/edge="1"/);
  const sourceMatch = attrs.match(/source="([^"]*)"/);
  const targetMatch = attrs.match(/target="([^"]*)"/);
  
  // 解析几何
  const geometryMatch = content.match(/<mxGeometry\s+x="([^"]*)"\s+y="([^"]*)"\s+width="([^"]*)"\s+height="([^"]*)"/);
  
  cells.push({
    id: idMatch ? idMatch[1] : '',
    value: valueMatch ? valueMatch[1] : '',
    style: styleMatch ? styleMatch[1] : '',
    isVertex: !!vertexMatch,
    isEdge: !!edgeMatch,
    source: sourceMatch ? sourceMatch[1] : null,
    target: targetMatch ? targetMatch[1] : null,
    x: geometryMatch ? parseFloat(geometryMatch[1]) : 0,
    y: geometryMatch ? parseFloat(geometryMatch[2]) : 0,
    w: geometryMatch ? parseFloat(geometryMatch[3]) : 0,
    h: geometryMatch ? parseFloat(geometryMatch[4]) : 0,
    rawXml: content  // 保存原始 XML 用于解析折线路径
  });
}

// 生成 SVG
let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#333333"/>
    </marker>
  </defs>
  
`;

// 建立 ID 到位置的映射
const posMap = new Map();
for (const cell of cells) {
  if (cell.isVertex) {
    posMap.set(cell.id, { x: cell.x, y: cell.y, w: cell.w, h: cell.h, value: cell.value, style: cell.style });
  }
}

// 绘制节点
for (const cell of cells) {
  if (!cell.isVertex) continue;
  
  const { x, y, w, h, value, style } = cell;
  
  // 跳过标签节点（宽高为 0 或很小）
  if (w < 10 || h < 10) continue;
  
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // 判断形状
  if (style.includes('rhombus')) {
    // 菱形
    svg += `  <polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="#F5F5F5" stroke="#333333" stroke-width="1.5"/>\n`;
  } else if (style.includes('rounded=1')) {
    // 圆角矩形
    svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6" fill="#F5F5F5" stroke="#333333" stroke-width="1.5"/>\n`;
  } else if (style.includes('parallelogram')) {
    // 平行四边形
    const offset = 20;
    svg += `  <polygon points="${x + offset},${y} ${x + w},${y} ${x + w - offset},${y + h} ${x},${y + h}" fill="#FFFFFF" stroke="#333333" stroke-width="1.5"/>\n`;
  } else {
    // 矩形
    svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF" stroke="#333333" stroke-width="1.5"/>\n`;
  }
  
  svg += `  <text x="${cx}" y="${cy}" font-size="14" fill="#000000" text-anchor="middle" dominant-baseline="central" font-family="Arial">${value}</text>\n\n`;
}

// 绘制连线（横平竖直折线，不穿透任何几何图形）
for (const cell of cells) {
  if (!cell.isEdge) continue;
  
  const sourcePos = posMap.get(cell.source);
  const targetPos = posMap.get(cell.target);
  if (!sourcePos || !targetPos) continue;
  
  // 解析 style 获取 exitX, exitY, entryX, entryY
  const exitXMatch = cell.style.match(/exitX=([^;]+)/);
  const exitYMatch = cell.style.match(/exitY=([^;]+)/);
  const entryXMatch = cell.style.match(/entryX=([^;]+)/);
  const entryYMatch = cell.style.match(/entryY=([^;]+)/);
  
  const exitX = exitXMatch ? parseFloat(exitXMatch[1]) : 0.5;
  const exitY = exitYMatch ? parseFloat(exitYMatch[1]) : 1;
  const entryX = entryXMatch ? parseFloat(entryXMatch[1]) : 0.5;
  const entryY = entryYMatch ? parseFloat(entryYMatch[1]) : 0;
  
  // 计算边缘连接点
  const sx = sourcePos.x + exitX * sourcePos.w;
  const sy = sourcePos.y + exitY * sourcePos.h;
  const tx = targetPos.x + entryX * targetPos.w;
  const ty = targetPos.y + entryY * targetPos.h;
  
  // 解析折线路径点（如果有）- 从原始 XML 中提取
  let pathPoints = [];
  if (cell.rawXml) {
    const pointsMatch = cell.rawXml.match(/<Array as="points">([\s\S]*?)<\/Array>/);
    if (pointsMatch) {
      const pointRegex = /<mxPoint\s+x="([^"]*)"\s+y="([^"]*)"/g;
      let ptMatch;
      while ((ptMatch = pointRegex.exec(pointsMatch[1])) !== null) {
        pathPoints.push({ x: parseFloat(ptMatch[1]), y: parseFloat(ptMatch[2]) });
      }
    }
  }
  
  if (pathPoints.length > 0) {
    // 使用折线路径：起点 → 中间点 → 终点（调整终点到节点边缘）
    const allPoints = [{ x: sx, y: sy }, ...pathPoints];
    
    // 计算最后一个中间点到目标节点的方向，调整终点到边缘
    const lastPt = pathPoints[pathPoints.length - 1];
    const dx = tx - lastPt.x;
    const dy = ty - lastPt.y;
    
    // 如果水平接近，终点用目标节点的 entryY
    if (Math.abs(dx) < Math.abs(dy)) {
      allPoints.push({ x: tx, y: ty });
    } else {
      allPoints.push({ x: tx, y: ty });
    }
    
    const pointsStr = allPoints.map(p => `${p.x},${p.y}`).join(' ');
    svg += `  <polyline points="${pointsStr}" fill="none" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
  } else {
    // 判断是否为回环连线（目标在源上方）
    const isReturn = ty < sy - 20;
    
    if (isReturn) {
      // 回环连线：使用正交路径，绕远路避免穿透
      const useLeftSide = sx < width / 2;
      const marginX = useLeftSide ? 50 : width - 50;
      svg += `  <polyline points="${sx},${sy} ${marginX},${sy} ${marginX},${ty} ${tx},${ty}" fill="none" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
    } else if (Math.abs(sy - ty) < 10) {
      // 水平连线（分支）：直接连接
      svg += `  <line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
    } else {
      // 垂直连线
      if (Math.abs(sx - tx) < 5) {
        svg += `  <line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
      } else {
        svg += `  <polyline points="${sx},${sy} ${sx},${ty} ${tx},${ty}" fill="none" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)"/>\n`;
      }
    }
  }
  
  if (cell.value) {
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2 - 6;
    svg += `  <text x="${mx}" y="${my}" font-size="12" fill="#000000" text-anchor="middle" font-family="Arial">${cell.value}</text>\n`;
  }
}

svg += `</svg>\n`;

// 写入文件
fs.writeFileSync(outputPath, svg, 'utf-8');
console.log(`✅ SVG 预览已生成：${outputPath}`);
