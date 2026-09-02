#!/usr/bin/env node
/**
 * create_drawio_from_plan.js
 * 将 JSON 图形计划转换为 Draw.io (.drawio) 文件
 * 
 * 用法: node create_drawio_from_plan.js --plan plan.json --output output.drawio [--png output.png]
 */

const fs = require('fs');
const path = require('path');
const { autoLayout } = require('./layout_engine');
const { layoutFuncStructure } = require('./layout_func_structure');
const { layoutUsecase } = require('./layout_usecase');
const { layoutErd } = require('./layout_erd');

// ============ 命令行参数解析 ============
const args = process.argv.slice(2);
let planPath = null, outputPath = null, pngOutput = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plan' && args[i + 1]) { planPath = args[++i]; }
  else if (args[i] === '--output' && args[i + 1]) { outputPath = args[++i]; }
  else if (args[i] === '--png' && args[i + 1]) { pngOutput = args[++i]; }
}

if (!planPath || !outputPath) {
  console.error('用法: node create_drawio_from_plan.js --plan <plan.json> --output <output.drawio> [--png <output.png>]');
  process.exit(1);
}

if (!fs.existsSync(planPath)) {
  console.error(`错误: 计划文件不存在: ${planPath}`);
  process.exit(1);
}

// ============ 读取计划 ============
const rawPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));

// 检测格式：如果有 layout 或 template 字段，使用自动布局引擎
let plan;
let parsedData = null;

if (rawPlan.template === 'func-structure' || rawPlan.layout === 'func-structure') {
  console.log(' 使用功能结构图布局引擎...');
  // 解析功能结构图数据
  parsedData = {
    modules: rawPlan.modules || [],
    functions: rawPlan.functions || []
  };
  
  // 显示解析结果并确认
  console.log('\n=== 解析结果确认 ===\n');
  console.log('模块列表:');
  parsedData.modules.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name}`);
  });
  
  console.log('\n功能列表:');
  parsedData.functions.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name} (所属模块：${f.module})`);
  });
  console.log('\n请确认以上信息是否正确。\n');
  
  plan = layoutFuncStructure(rawPlan);
} else if (rawPlan.template === 'usecase' || rawPlan.layout === 'usecase') {
  console.log(' 使用用例图布局引擎...');
  // 解析用例图数据
  parsedData = {
    actors: rawPlan.actors || [],
    usecases: rawPlan.usecases || []
  };
  
  // 显示解析结果并确认
  console.log('\n=== 解析结果确认 ===\n');
  console.log('参与者列表:');
  parsedData.actors.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.name}`);
  });
  
  console.log('\n用例列表:');
  parsedData.usecases.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name}`);
    if (u.actors) {
      console.log(`     关联参与者：${u.actors.join(', ')}`);
    }
  });
  console.log('\n请确认以上信息是否正确。\n');
  
  plan = layoutUsecase(rawPlan);
} else if (rawPlan.template === 'erd' || rawPlan.layout === 'erd') {
  console.log(' 使用 E-R 图布局引擎...');
  // 先解析数据，然后确认
  const { parseNaturalLanguage, parseMarkdown } = require('./layout_erd');
  if (rawPlan.mode === 'markdown' || rawPlan.markdown) {
    parsedData = parseMarkdown(rawPlan.markdown || rawPlan.text || '');
  } else if (rawPlan.mode === 'natural' || rawPlan.text) {
    parsedData = parseNaturalLanguage(rawPlan.text || '');
  } else if (rawPlan.entities) {
    parsedData = { entities: rawPlan.entities || [], relationships: rawPlan.relationships || [] };
  }
  
  // 显示解析结果并确认
  if (parsedData) {
    console.log('\n=== 解析结果确认 ===\n');
    console.log('实体列表:');
    parsedData.entities.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.name}`);
      e.attributes.forEach(a => {
        const pkMark = a.type === 'PK' ? ' [主键]' : '';
        console.log(`     - ${a.name}${pkMark}`);
      });
    });
    
    console.log('\n关系列表:');
    parsedData.relationships.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.from} ${r.fromCardinality}:${r.toCardinality} ${r.name} ${r.to}`);
    });
    
    console.log('\n请确认以上信息是否正确。');
    console.log('如正确，将继续生成图形；如不正确，请修改输入文件后重试。\n');
  }
  
  plan = layoutErd(rawPlan);
} else if (rawPlan.layout || rawPlan.template) {
  console.log(' 使用自动布局引擎...');
  plan = autoLayout(rawPlan);
} else {
  console.log(' 使用坐标模式...');
  plan = rawPlan;
}

const page = plan.page || { name: 'Draw.io Replica', width: 800, height: 600 };
const shapes = plan.shapes || [];
const connections = plan.connections || [];

// ============ 工具函数 ============
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb.toUpperCase();
  const m = rgb.match(/RGB\((\d+),(\d+),(\d+)\)/i);
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0');
    const g = parseInt(m[2]).toString(16).padStart(2, '0');
    const b = parseInt(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }
  return '#000000';
}

// ============ 形状样式映射 ============
function buildShapeStyle(type, style) {
  if (!style) style = {};
  const parts = [];

  // 形状类型
  switch (type) {
    case 'rect': case 'rectangle': break;
    case 'oval': case 'ellipse': case 'circle': parts.push('ellipse'); break;
    case 'diamond': case 'rhombus': parts.push('rhombus'); break;
    case 'roundedrect': case 'rounded-rect': parts.push('rounded=1'); break;
    case 'cylinder': case 'database': parts.push('shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=15'); break;
    case 'cylinder-h': case 'capsule': case 'horizontal-cylinder': parts.push('rounded=1;arcSize=50'); break;
    case 'hexagon': parts.push('shape=hexagon;perimeter=hexagonPerimeter2'); break;
    case 'triangle': parts.push('shape=triangle;whiteSpace=wrap;html=1'); break;
    case 'cloud': parts.push('ellipse;whiteSpace=wrap;html=1'); break;
    case 'parallelogram': parts.push('shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1'); break;
    case 'text': parts.push('text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;'); break;
    case 'block-arrow': case 'blockArrow': parts.push('shape=blockArrow;whiteSpace=wrap;html=1;'); break;
    case 'line': parts.push('endArrow=classic;startArrow=none;'); break;
    case 'image': break;
    case 'actor': case 'umlActor': parts.push('shape=umlActor'); break;
    default: break;
  }

  // 填充
  if (style.noFill || style.fillColor === 'none') {
    parts.push('fillColor=none');
  } else if (style.fillColor) {
    parts.push(`fillColor=${rgbToHex(style.fillColor)}`);
  } else if (style.fill) {
    parts.push(`fillColor=${rgbToHex(style.fill)}`);
  }

  // 边框
  if (style.noLine || style.strokeColor === 'none') {
    parts.push('strokeColor=none');
  } else if (style.strokeColor) {
    parts.push(`strokeColor=${rgbToHex(style.strokeColor)}`);
  } else if (style.line) {
    parts.push(`strokeColor=${rgbToHex(style.line)}`);
  }

  // 边框粗细
  if (style.strokeWidth !== undefined) {
    parts.push(`strokeWidth=${style.strokeWidth}`);
  } else if (style.weight !== undefined) {
    parts.push(`strokeWidth=${style.weight}`);
  }

  // 虚线
  if (style.dashed || style.dash) {
    parts.push('dashed=1');
  }

  // 字体
  if (style.fontSize) {
    parts.push(`fontSize=${style.fontSize}`);
  }
  if (style.fontColor) {
    parts.push(`fontColor=${rgbToHex(style.fontColor)}`);
  } else if (style.textColor) {
    parts.push(`fontColor=${rgbToHex(style.textColor)}`);
  }

  // 字体样式
  let fontStyle = 0;
  if (style.bold || style.fontStyle === 'bold') fontStyle |= 1;
  if (style.italic || style.fontStyle === 'italic') fontStyle |= 2;
  if (style.underline || style.fontStyle === 'underline') fontStyle |= 4;
  if (fontStyle > 0) {
    parts.push(`fontStyle=${fontStyle}`);
  }

  // 对齐
  if (style.align !== undefined) {
    const alignMap = { 0: 'left', 1: 'center', 2: 'right', 'left': 'left', 'center': 'center', 'right': 'right' };
    const alignVal = alignMap[style.align];
    if (alignVal) parts.push(`align=${alignVal}`);
  }
  if (style.verticalAlign !== undefined) {
    const vAlignMap = { 0: 'top', 1: 'middle', 2: 'bottom', 'top': 'top', 'middle': 'middle', 'bottom': 'bottom' };
    const vAlignVal = vAlignMap[style.verticalAlign];
    if (vAlignVal) parts.push(`verticalAlign=${vAlignVal}`);
  }

  // 圆角弧度
  if (style.arcSize !== undefined) {
    parts.push(`arcSize=${style.arcSize}`);
  }

  // 文字方向
  if (style.textDirection) {
    parts.push(`textDirection=${style.textDirection}`);
  }

  // 标签位置（如 bottom 表示在图形下方）
  if (style.verticalLabelPosition) {
    parts.push(`verticalLabelPosition=${style.verticalLabelPosition}`);
  }
  if (style.labelPosition) {
    parts.push(`labelPosition=${style.labelPosition}`);
  }

  // 旋转
  if (style.rotation !== undefined) {
    parts.push(`rotation=${style.rotation}`);
  }

  // 纵向文字
  if (style.verticalText) {
    parts.push('verticalText=1');
  }

  // 透明度
  if (style.opacity !== undefined) {
    parts.push(`opacity=${style.opacity}`);
  }

  // 通用
  if (type !== 'text') {
    parts.push('whiteSpace=wrap');
    parts.push('html=1');
  }

  return parts.join(';');
}

// ============ 连接线样式 ============
function buildEdgeStyle(conn) {
  const style = conn.style || {};
  const parts = [];

  // 箭头
  let hasArrowSetting = false;
  if (style.endArrow !== undefined) {
    hasArrowSetting = true;
    if (style.endArrow === 'classic' || style.endArrow === 'end') {
      parts.push('endArrow=classic');
    } else if (style.endArrow === 'open') {
      parts.push('endArrow=open');
    } else if (style.endArrow === 'block') {
      parts.push('endArrow=block');
    } else if (style.endArrow === 'none') {
      parts.push('endArrow=none');
    } else {
      parts.push(`endArrow=${style.endArrow}`);
    }
  } else if (style.arrow === 'end' || style.arrow === true) {
    hasArrowSetting = true;
    parts.push('endArrow=classic');
  } else if (style.arrow === 'begin') {
    hasArrowSetting = true;
    parts.push('startArrow=classic');
  } else if (style.arrow === 'both') {
    hasArrowSetting = true;
    parts.push('endArrow=classic');
    parts.push('startArrow=classic');
  }

  // 默认箭头（仅当没有显式设置箭头时）
  if (!hasArrowSetting && !style.noArrow) {
    parts.push('endArrow=classic');
  }

  // 颜色
  if (style.strokeColor) {
    parts.push(`strokeColor=${rgbToHex(style.strokeColor)}`);
  } else if (style.line) {
    parts.push(`strokeColor=${rgbToHex(style.line)}`);
  }

  // 粗细
  if (style.strokeWidth !== undefined) {
    parts.push(`strokeWidth=${style.strokeWidth}`);
  } else if (style.weight !== undefined) {
    parts.push(`strokeWidth=${style.weight}`);
  }

  // 虚线
  if (style.dashed || style.dash) {
    parts.push('dashed=1');
  }

  // 曲线
  if (style.curved) {
    parts.push('curved=1');
  }

  // 正交
  if (style.orthogonal) {
    parts.push('orthogonalEdgeStyle=1');
    parts.push('edgeStyle=orthogonalEdgeStyle');
  }

  // 圆角/曲线
  if (style.rounded !== undefined) {
    parts.push(`rounded=${style.rounded}`);
  }
  if (style.curved !== undefined) {
    parts.push(`curved=${style.curved}`);
  }

  // 字体
  if (style.fontSize) parts.push(`fontSize=${style.fontSize}`);
  if (style.fontColor) parts.push(`fontColor=${rgbToHex(style.fontColor)}`);
  if (style.bold) parts.push('fontStyle=1');

  // 连接点控制（exitX/Y = 源组件出口, entryX/Y = 目标组件入口）
  if (style.exitX !== undefined) parts.push(`exitX=${style.exitX}`);
  if (style.exitY !== undefined) parts.push(`exitY=${style.exitY}`);
  if (style.entryX !== undefined) parts.push(`entryX=${style.entryX}`);
  if (style.entryY !== undefined) parts.push(`entryY=${style.entryY}`);

  // 路由点（折线路径）
  if (style.waypoints && style.waypoints.length > 0) {
    const pts = style.waypoints.map(p => `[${p.x},${p.y}]`).join(',');
    parts.push(`points=[${pts}]`);
  }

  return parts.join(';');
}

// ============ 生成 XML ============
function generateDrawio() {
  let cellId = 2;
  const cells = [];
  const shapeIds = [];

  // 生成图形 cells
  for (const shape of shapes) {
    const id = `cell_${cellId++}`;
    shapeIds.push(id);

    const type = (shape.type || 'rect').toLowerCase();
    const style = buildShapeStyle(type, shape.style);
    const text = shape.text ? escapeXml(shape.text) : '';

    if (type === 'image') {
      const imgStyle = `shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=${encodeURIComponent(shape.src || '')};`;
      cells.push(`      <mxCell id="${id}" value="" style="${imgStyle}" vertex="1" parent="1">`);
      cells.push(`        <mxGeometry x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" as="geometry"/>`);
      cells.push(`      </mxCell>`);
    } else if (type === 'line') {
      // 虚线/直线：使用 x1/y1/x2/y2 坐标
      const x1 = shape.x1 || shape.x || 0;
      const y1 = shape.y1 || shape.y || 0;
      const x2 = shape.x2 || (shape.x + shape.w) || 0;
      const y2 = shape.y2 || (shape.y + shape.h) || 0;
      const lineStyle = buildShapeStyle('line', shape.style) + ';exitX=0;exitY=0;exitDx=0;exitDy=0;entryX=1;entryY=0;entryDx=0;entryDy=0;';
      cells.push(`      <mxCell id="${id}" value="" style="${lineStyle}" edge="1" parent="1">`);
      cells.push(`        <mxGeometry relative="1" as="geometry">`);
      cells.push(`          <mxPoint x="${x1}" y="${y1}" as="sourcePoint"/>`);
      cells.push(`          <mxPoint x="${x2}" y="${y2}" as="targetPoint"/>`);
      cells.push(`        </mxGeometry>`);
      cells.push(`      </mxCell>`);
    } else {
      cells.push(`      <mxCell id="${id}" value="${text}" style="${style}" vertex="1" parent="1">`);
      cells.push(`        <mxGeometry x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" as="geometry"/>`);
      cells.push(`      </mxCell>`);
    }
  }

  // 生成连接线 cells
  for (const conn of connections) {
    const id = `cell_${cellId++}`;
    const fromId = shapeIds[conn.from] || `cell_${conn.from + 2}`;
    const toId = shapeIds[conn.to] || `cell_${conn.to + 2}`;
    const edgeStyle = buildEdgeStyle(conn);
    const text = conn.text ? escapeXml(conn.text) : '';

    cells.push(`      <mxCell id="${id}" value="${text}" style="${edgeStyle}" edge="1" source="${fromId}" target="${toId}" parent="1">`);
    cells.push(`        <mxGeometry relative="1" as="geometry"/>`);
    cells.push(`      </mxCell>`);
  }

  // 组装完整 XML
  const pageWidth = page.width || 800;
  const pageHeight = page.height || 600;
  const diagramName = page.name || 'Page-1';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="drawio-replica-dsh" version="24.0.0" type="device">
  <diagram name="${escapeXml(diagramName)}" id="diagram_1">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1.5" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return xml;
}

// ============ 主流程 ============
try {
  const xml = generateDrawio();

  // 确保输出目录存在
  const outDir = path.dirname(outputPath);
  if (outDir && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, xml, 'utf-8');
  console.log(`✅ Draw.io 文件生成成功: ${outputPath}`);
  console.log(`   大小: ${fs.statSync(outputPath).size} bytes`);
  console.log(`   图形数: ${shapes.length}`);
  console.log(`   连接线数: ${connections.length}`);

  if (pngOutput) {
    console.log(`\n提示: 使用 draw.io 桌面版导出 PNG:`);
    console.log(`  draw.io --export --format png --output "${pngOutput}" "${outputPath}"`);
    console.log(`  或在 https://app.diagrams.net 中打开后导出`);
  }

} catch (err) {
  console.error(` 生成失败: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
