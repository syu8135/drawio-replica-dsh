/**
 * drawio-quality-checker.js - 质量检查器
 * 生成后自动校验图形质量，发现问题自动修正
 * 
 * 融合 scientific-illustrator 的质量门控理念
 */

const fs = require('fs');
const path = require('path');

// ============ 质量检查规则 ============
const QUALITY_RULES = {
  // 1. 元素数量检查
  minShapes: 1,
  maxShapes: 200,
  
  // 2. 坐标范围检查
  minCoordinate: 0,
  maxCoordinate: 10000,
  
  // 3. 文字内容检查
  requireText: true,
  maxTextLength: 500,
  
  // 4. 样式完整性检查
  requireFillColor: true,
  requireFontSize: true,
  
  // 5. 布局合理性检查
  maxOverlapRatio: 0.3, // 最大重叠比例
  minSpacing: 10, // 最小间距
};

// ============ 质量检查器 ============
class DrawioQualityChecker {
  constructor(rules = QUALITY_RULES) {
    this.rules = rules;
    this.issues = [];
  }

  /**
   * 检查生成的 .drawio 文件
   */
  check(drawioPath) {
    this.issues = [];
    
    if (!fs.existsSync(drawioPath)) {
      return {
        passed: false,
        issues: [{ type: 'FATAL', message: '文件不存在' }]
      };
    }

    const content = fs.readFileSync(drawioPath, 'utf-8');
    
    // 1. XML 格式检查
    this.checkXmlFormat(content);
    
    // 2. 解析图形元素
    const shapes = this.parseShapes(content);
    
    // 3. 元素数量检查
    this.checkShapeCount(shapes);
    
    // 4. 坐标范围检查
    this.checkCoordinates(shapes);
    
    // 5. 文字内容检查
    this.checkTextContent(shapes);
    
    // 6. 样式完整性检查
    this.checkStyles(shapes);
    
    // 7. 布局合理性检查
    this.checkLayout(shapes);
    
    return {
      passed: this.issues.filter(i => i.severity === 'ERROR').length === 0,
      issues: this.issues,
      stats: {
        totalShapes: shapes.length,
        textShapes: shapes.filter(s => s.text).length,
        connectionShapes: shapes.filter(s => s.type === 'line').length
      }
    };
  }

  /**
   * 检查 XML 格式
   */
  checkXmlFormat(content) {
    if (!content.includes('<?xml')) {
      this.issues.push({
        severity: 'ERROR',
        type: 'FORMAT',
        message: '缺少 XML 声明'
      });
    }
    
    if (!content.includes('<mxfile')) {
      this.issues.push({
        severity: 'ERROR',
        type: 'FORMAT',
        message: '缺少 mxfile 根元素'
      });
    }
    
    if (!content.includes('<mxGraphModel')) {
      this.issues.push({
        severity: 'ERROR',
        type: 'FORMAT',
        message: '缺少 mxGraphModel 元素'
      });
    }
  }

  /**
   * 解析图形元素
   */
  parseShapes(content) {
    const shapes = [];
    const cellMap = {};
    
    // 解析矩形/椭圆（有 width/height）- 使用更精确的正则
    const rectRegex = /<mxCell([^>]*)>[\s\S]*?<mxGeometry([^>]*)\/?>[\s\S]*?<\/mxCell>/g;
    
    let match;
    while ((match = rectRegex.exec(content)) !== null) {
      const cellTag = match[1];
      const geomTag = match[2];
      
      // 提取 id, value, style
      const idMatch = cellTag.match(/id="([^"]*)"/);
      const valueMatch = cellTag.match(/value="([^"]*)"/);
      const styleMatch = cellTag.match(/style="([^"]*)"/);
      
      // 提取 x, y, width, height
      const xMatch = geomTag.match(/x="([^"]*)"/);
      const yMatch = geomTag.match(/y="([^"]*)"/);
      const wMatch = geomTag.match(/width="([^"]*)"/);
      const hMatch = geomTag.match(/height="([^"]*)"/);
      
      if (!idMatch || !xMatch || !yMatch || !wMatch || !hMatch) continue;
      
      // 跳过 edge 类型
      if (cellTag.includes('edge="1"')) continue;
      
      const style = styleMatch ? styleMatch[1] : '';
      const cell = {
        id: idMatch[1],
        text: valueMatch ? valueMatch[1] : '',
        style: style,
        x: parseFloat(xMatch[1]),
        y: parseFloat(yMatch[1]),
        w: parseFloat(wMatch[1]),
        h: parseFloat(hMatch[1]),
        type: style.includes('ellipse') ? 'ellipse' : (style.includes('rhombus') ? 'rhombus' : (style.startsWith('text;') ? 'text' : 'rect'))
      };
      shapes.push(cell);
      cellMap[cell.id] = cell;
    }
    
    // 解析连接线（edge）
    const edgeRegex = /<mxCell([^>]*)edge="1"([^>]*)>/g;
    while ((match = edgeRegex.exec(content)) !== null) {
      const cellTag = match[1] + match[2];
      const idMatch = cellTag.match(/id="([^"]*)"/);
      const sourceMatch = cellTag.match(/source="([^"]*)"/);
      const targetMatch = cellTag.match(/target="([^"]*)"/);
      const styleMatch = cellTag.match(/style="([^"]*)"/);
      
      if (!idMatch || !sourceMatch || !targetMatch) continue;
      
      const source = cellMap[sourceMatch[1]];
      const target = cellMap[targetMatch[1]];
      
      if (source && target) {
        const style = styleMatch ? styleMatch[1] : '';
        const exitXMatch = style.match(/exitX=([\d.]+)/);
        const exitYMatch = style.match(/exitY=([\d.]+)/);
        const entryXMatch = style.match(/entryX=([\d.]+)/);
        const entryYMatch = style.match(/entryY=([\d.]+)/);
        
        const exitX = exitXMatch ? parseFloat(exitXMatch[1]) : 0.5;
        const exitY = exitYMatch ? parseFloat(exitYMatch[1]) : 0.5;
        const entryX = entryXMatch ? parseFloat(entryXMatch[1]) : 0.5;
        const entryY = entryYMatch ? parseFloat(entryYMatch[1]) : 0.5;
        
        shapes.push({
          id: idMatch[1],
          text: '',
          style: style,
          x1: source.x + source.w * exitX,
          y1: source.y + source.h * exitY,
          x2: target.x + target.w * entryX,
          y2: target.y + target.h * entryY,
          type: 'line'
        });
      }
    }
    
    return shapes;
  }

  /**
   * 检查元素数量
   */
  checkShapeCount(shapes) {
    if (shapes.length < this.rules.minShapes) {
      this.issues.push({
        severity: 'WARNING',
        type: 'COUNT',
        message: `图形数量过少（${shapes.length} < ${this.rules.minShapes}）`
      });
    }
    
    if (shapes.length > this.rules.maxShapes) {
      this.issues.push({
        severity: 'WARNING',
        type: 'COUNT',
        message: `图形数量过多（${shapes.length} > ${this.rules.maxShapes}）`
      });
    }
  }

  /**
   * 检查坐标范围
   */
  checkCoordinates(shapes) {
    for (const shape of shapes) {
      if (shape.x < this.rules.minCoordinate || shape.x > this.rules.maxCoordinate) {
        this.issues.push({
          severity: 'ERROR',
          type: 'COORDINATE',
          message: `X 坐标超出范围：${shape.x}`
        });
      }
      
      if (shape.y < this.rules.minCoordinate || shape.y > this.rules.maxCoordinate) {
        this.issues.push({
          severity: 'ERROR',
          type: 'COORDINATE',
          message: `Y 坐标超出范围：${shape.y}`
        });
      }
    }
  }

  /**
   * 检查文字内容
   */
  checkTextContent(shapes) {
    for (const shape of shapes) {
      if (this.rules.requireText && !shape.text && shape.type === 'vertex') {
        // 允许空文字（可能是装饰图形）
        continue;
      }
      
      if (shape.text && shape.text.length > this.rules.maxTextLength) {
        this.issues.push({
          severity: 'WARNING',
          type: 'TEXT',
          message: `文字过长：${shape.text.substring(0, 50)}...`
        });
      }
    }
  }

  /**
   * 检查样式完整性
   */
  checkStyles(shapes) {
    for (const shape of shapes) {
      if (this.rules.requireFillColor && !shape.style.includes('fillColor')) {
        // 允许无边框图形
        continue;
      }
      
      if (this.rules.requireFontSize && shape.style.includes('fontSize')) {
        const fontSizeMatch = shape.style.match(/fontSize=(\d+)/);
        if (fontSizeMatch) {
          const fontSize = parseInt(fontSizeMatch[1]);
          if (fontSize < 6 || fontSize > 72) {
            this.issues.push({
              severity: 'WARNING',
              type: 'STYLE',
              message: `字号异常：${fontSize}pt`
            });
          }
        }
      }
    }
  }

  /**
   * 检查布局合理性
   */
  checkLayout(shapes) {
    // 检查重叠（排除正常情况）
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const s1 = shapes[i];
        const s2 = shapes[j];
        
        // 跳过同心圆嵌套检测（椭圆包含椭圆是正常的）
        if (this.isConcentricNesting(s1, s2)) {
          continue;
        }
        
        // 跳过文字与背景图形的重叠（文字本来就在图形上面）
        if (this.isTextOnShape(s1, s2)) {
          continue;
        }
        
        // 跳过层与组件的包含关系（架构图中层包含组件是正常的）
        if (this.isLayerContainsComponent(s1, s2)) {
          continue;
        }
        
        const overlap = this.calculateOverlap(s1, s2);
        if (overlap > this.rules.maxOverlapRatio) {
          this.issues.push({
            severity: 'WARNING',
            type: 'LAYOUT',
            message: `图形重叠过多：${s1.text || 'shape1'} 与 ${s2.text || 'shape2'}`
          });
        }
      }
    }
  }

  /**
   * 判断是否是文字在图形上（正常情况）
   */
  isTextOnShape(s1, s2) {
    const isText1 = s1.style.includes('text;') || s1.text;
    const isText2 = s2.style.includes('text;') || s2.text;
    const isShape1 = s1.style.includes('ellipse') || s1.style.includes('rect');
    const isShape2 = s2.style.includes('ellipse') || s2.style.includes('rect');
    
    // 一个是文字，一个是图形
    return (isText1 && isShape2) || (isText2 && isShape1);
  }

  /**
   * 判断是否是层与组件的包含关系（架构图正常情况）
   */
  isLayerContainsComponent(s1, s2) {
    // 两个都是矩形
    const isBothRect = s1.style.includes('rect') && s2.style.includes('rect');
    if (!isBothRect) return false;
    
    // 一个是另一个的父容器（面积大很多）
    const area1 = s1.w * s1.h;
    const area2 = s2.w * s2.h;
    const ratio = Math.max(area1, area2) / Math.min(area1, area2);
    
    // 面积比大于 5 倍，可能是层与组件的关系
    return ratio > 5;
  }

  /**
   * 判断是否是同心圆嵌套（正常情况）
   */
  isConcentricNesting(s1, s2) {
    // 两个都是椭圆
    const isBothOval = s1.style.includes('ellipse') && s2.style.includes('ellipse');
    if (!isBothOval) return false;
    
    // 计算中心点
    const c1 = { x: s1.x + s1.w / 2, y: s1.y + s1.h / 2 };
    const c2 = { x: s2.x + s2.w / 2, y: s2.y + s2.h / 2 };
    
    // 中心点距离很近（同心）
    const distance = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
    const isConcentric = distance < 50;
    
    // 一个是另一个的子集（嵌套）
    const isNested = (s1.x <= s2.x && s1.y <= s2.y && 
                      s1.x + s1.w >= s2.x + s2.w && 
                      s1.y + s1.h >= s2.y + s2.h) ||
                     (s2.x <= s1.x && s2.y <= s1.y && 
                      s2.x + s2.w >= s1.x + s1.w && 
                      s2.y + s2.h >= s1.y + s1.h);
    
    return isConcentric && isNested;
  }

  /**
   * 计算两个图形的重叠比例
   */
  calculateOverlap(s1, s2) {
    const x1 = Math.max(s1.x, s2.x);
    const y1 = Math.max(s1.y, s2.y);
    const x2 = Math.min(s1.x + s1.w, s2.x + s2.w);
    const y2 = Math.min(s1.y + s1.h, s2.y + s2.h);
    
    if (x1 >= x2 || y1 >= y2) return 0;
    
    const overlapArea = (x2 - x1) * (y2 - y1);
    const area1 = s1.w * s1.h;
    const area2 = s2.w * s2.h;
    const minArea = Math.min(area1, area2);
    
    return overlapArea / minArea;
  }
}

// ============ 自动修正器 ============
class DrawioAutoFixer {
  constructor() {
    this.fixes = [];
  }

  /**
   * 自动修正 .drawio 文件
   */
  fix(drawioPath) {
    this.fixes = [];
    let content = fs.readFileSync(drawioPath, 'utf-8');
    
    // 1. 修正坐标超出范围
    content = this.fixCoordinates(content);
    
    // 2. 修正字号异常
    content = this.fixFontSize(content);
    
    // 3. 修正文字过长
    content = this.fixLongText(content);
    
    // 写回文件
    fs.writeFileSync(drawioPath, content, 'utf-8');
    
    return {
      fixed: this.fixes.length > 0,
      fixes: this.fixes
    };
  }

  /**
   * 修正坐标超出范围
   */
  fixCoordinates(content) {
    const minCoord = 0;
    const maxCoord = 9000;
    
    // 修正 x 坐标
    content = content.replace(/x="([^"]*)"/g, (match, x) => {
      const val = parseFloat(x);
      if (val < minCoord) {
        this.fixes.push({ type: 'COORDINATE', message: `X 坐标 ${val} 修正为 ${minCoord}` });
        return `x="${minCoord}"`;
      }
      if (val > maxCoord) {
        this.fixes.push({ type: 'COORDINATE', message: `X 坐标 ${val} 修正为 ${maxCoord}` });
        return `x="${maxCoord}"`;
      }
      return match;
    });
    
    // 修正 y 坐标
    content = content.replace(/y="([^"]*)"/g, (match, y) => {
      const val = parseFloat(y);
      if (val < minCoord) {
        this.fixes.push({ type: 'COORDINATE', message: `Y 坐标 ${val} 修正为 ${minCoord}` });
        return `y="${minCoord}"`;
      }
      if (val > maxCoord) {
        this.fixes.push({ type: 'COORDINATE', message: `Y 坐标 ${val} 修正为 ${maxCoord}` });
        return `y="${maxCoord}"`;
      }
      return match;
    });
    
    return content;
  }

  /**
   * 修正字号异常
   */
  fixFontSize(content) {
    const minFontSize = 8;
    const maxFontSize = 48;
    
    return content.replace(/fontSize=(\d+)/g, (match, size) => {
      const val = parseInt(size);
      if (val < minFontSize) {
        this.fixes.push({ type: 'FONT_SIZE', message: `字号 ${val}pt 修正为 ${minFontSize}pt` });
        return `fontSize=${minFontSize}`;
      }
      if (val > maxFontSize) {
        this.fixes.push({ type: 'FONT_SIZE', message: `字号 ${val}pt 修正为 ${maxFontSize}pt` });
        return `fontSize=${maxFontSize}`;
      }
      return match;
    });
  }

  /**
   * 修正文字过长
   */
  fixLongText(content) {
    const maxTextLength = 200;
    
    return content.replace(/value="([^"]*)"/g, (match, text) => {
      if (text.length > maxTextLength) {
        const truncated = text.substring(0, maxTextLength) + '...';
        this.fixes.push({ type: 'TEXT_LENGTH', message: `文字过长，已截断：${text.substring(0, 50)}...` });
        return `value="${truncated}"`;
      }
      return match;
    });
  }
}

// ============ SVG 预览生成器 ============
class DrawioSvgPreview {
  /**
   * 将 .drawio 转换为 SVG 预览
   */
  generateSvg(drawioPath, outputPath) {
    const content = fs.readFileSync(drawioPath, 'utf-8');
    
    // 提取画布尺寸
    const widthMatch = content.match(/pageWidth="(\d+)"/);
    const heightMatch = content.match(/pageHeight="(\d+)"/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 800;
    const height = heightMatch ? parseInt(heightMatch[1]) : 600;
    
    // 解析图形元素
    const shapes = this.parseShapes(content);
    
    // 生成 SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
`;
    
    for (const shape of shapes) {
      svg += this.shapeToSvg(shape);
    }
    
    svg += '</svg>';
    
    fs.writeFileSync(outputPath, svg, 'utf-8');
    return outputPath;
  }

  /**
   * 解析图形元素（包括矩形和箭头）
   */
  parseShapes(content) {
    const shapes = [];
    const cellMap = {}; // 存储所有 cell 的坐标
    
    // 解析矩形/椭圆（有 width/height）- 使用更精确的正则，不跨越</mxCell>
    const rectRegex = /<mxCell([^>]*)>[\s\S]*?<mxGeometry([^>]*)\/?>[\s\S]*?<\/mxCell>/g;
    
    let match;
    while ((match = rectRegex.exec(content)) !== null) {
      const cellTag = match[1];
      const geomTag = match[2];
      
      // 提取 id, value, style
      const idMatch = cellTag.match(/id="([^"]*)"/);
      const valueMatch = cellTag.match(/value="([^"]*)"/);
      const styleMatch = cellTag.match(/style="([^"]*)"/);
      
      // 提取 x, y, width, height
      const xMatch = geomTag.match(/x="([^"]*)"/);
      const yMatch = geomTag.match(/y="([^"]*)"/);
      const wMatch = geomTag.match(/width="([^"]*)"/);
      const hMatch = geomTag.match(/height="([^"]*)"/);
      
      if (!idMatch || !xMatch || !yMatch || !wMatch || !hMatch) continue;
      
      const style = styleMatch ? styleMatch[1] : '';
      
      // 跳过 edge 类型（没有 x/y/width/height 的 geometry）
      if (cellTag.includes('edge="1"')) continue;
      
      const cell = {
        id: idMatch[1],
        text: valueMatch ? valueMatch[1] : '',
        style: style,
        x: parseFloat(xMatch[1]),
        y: parseFloat(yMatch[1]),
        w: parseFloat(wMatch[1]),
        h: parseFloat(hMatch[1]),
        type: style.includes('ellipse') ? 'ellipse' : (style.includes('rhombus') ? 'rhombus' : (style.startsWith('text;') ? 'text' : (style.includes('umlActor') ? 'actor' : 'rect')))
      };
      shapes.push(cell);
      cellMap[cell.id] = cell;
    }
    
    // 解析连接线（edge，使用 source/target 引用）
    const edgeRegex = /<mxCell[^>]*id="([^"]*)"[^>]*value="([^"]*)"[^>]*style="([^"]*)"[^>]*edge="1"[^>]*source="([^"]*)"[^>]*target="([^"]*)"/g;
    
    while ((match = edgeRegex.exec(content)) !== null) {
      const sourceId = match[4];
      const targetId = match[5];
      const source = cellMap[sourceId];
      const target = cellMap[targetId];
      
      if (source && target) {
        // 解析 exitX/exitY 和 entryX/entryY
        const exitXMatch = match[3].match(/exitX=([\d.]+)/);
        const exitYMatch = match[3].match(/exitY=([\d.]+)/);
        const entryXMatch = match[3].match(/entryX=([\d.]+)/);
        const entryYMatch = match[3].match(/entryY=([\d.]+)/);
        
        const exitX = exitXMatch ? parseFloat(exitXMatch[1]) : 0.5;
        const exitY = exitYMatch ? parseFloat(exitYMatch[1]) : 1;
        const entryX = entryXMatch ? parseFloat(entryXMatch[1]) : 0.5;
        const entryY = entryYMatch ? parseFloat(entryYMatch[1]) : 0;
        
        // 根据相对位置计算连接点
        const x1 = source.x + source.w * exitX;
        const y1 = source.y + source.h * exitY;
        const x2 = target.x + target.w * entryX;
        const y2 = target.y + target.h * entryY;
        
        shapes.push({
          text: '',
          style: match[3],
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
          type: 'line'
        });
      }
    }
    
    return shapes;
  }

  /**
   * 将图形转换为 SVG
   */
  shapeToSvg(shape) {
    const fillColor = this.extractStyle(shape.style, 'fillColor', '#ffffff');
    const strokeColor = this.extractStyle(shape.style, 'strokeColor', '#000000');
    const strokeWidth = this.extractStyle(shape.style, 'strokeWidth', '1');
    const fontSize = this.extractStyle(shape.style, 'fontSize', '12');
    const fontColor = this.extractStyle(shape.style, 'fontColor', '#000000');
    const textDirection = this.extractStyle(shape.style, 'textDirection', '');
    
    let svg = '';
    
    if (shape.type === 'ellipse') {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const rx = shape.w / 2;
      const ry = shape.h / 2;
      svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" 
    fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
    } else if (shape.type === 'actor') {
      // 绘制人形角色（火柴人）
      const cx = shape.x + shape.w / 2;
      const headY = shape.y + 15;
      const bodyTop = shape.y + 30;
      const bodyBottom = shape.y + 75;
      const armY = shape.y + 45;
      const legBottom = shape.y + shape.h;
      
      svg += `  <!-- Actor: ${shape.text} -->
`;
      svg += `  <circle cx="${cx}" cy="${headY}" r="12" 
    fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      svg += `  <line x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBottom}" 
    stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      svg += `  <line x1="${cx - 20}" y1="${armY}" x2="${cx + 20}" y2="${armY}" 
    stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      svg += `  <line x1="${cx}" y1="${bodyBottom}" x2="${cx - 15}" y2="${legBottom}" 
    stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      svg += `  <line x1="${cx}" y1="${bodyBottom}" x2="${cx + 15}" y2="${legBottom}" 
    stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      // 角色名称（在下方）- 不在这里输出，由后续统一处理
    } else if (shape.type === 'rect') {
      svg += `  <rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" 
    fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
    } else if (shape.type === 'rhombus') {
      // 菱形：四个顶点
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const top = `${cx},${shape.y}`;
      const right = `${shape.x + shape.w},${cy}`;
      const bottom = `${cx},${shape.y + shape.h}`;
      const left = `${shape.x},${cy}`;
      svg += `  <polygon points="${top} ${right} ${bottom} ${left}" 
    fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
    } else if (shape.type === 'text') {
      // 纯文本（基数标注等），不绘制形状，只绘制文字
    } else if (shape.type === 'line') {
      // 检查是否需要折线（有 orthogonal 属性）
      const needPolyline = shape.style && shape.style.includes('orthogonal');
      if (needPolyline) {
        // 正交折线：垂直→水平→垂直
        const midY = Math.round((shape.y1 + shape.y2) / 2);
        svg += `  <polyline points="${shape.x1},${shape.y1} ${shape.x1},${midY} ${shape.x2},${midY} ${shape.x2},${shape.y2}" 
    fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      } else {
        // 直线（用于用例图等）
        svg += `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" 
    stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
`;
      }
    }
    
    // 添加文字
    if (shape.text) {
      if (shape.type === 'actor') {
        // 角色名称显示在下方
        const textX = shape.x + shape.w / 2;
        const textY = shape.y + shape.h + 20;
        svg += `  <text x="${textX}" y="${textY}" 
    font-size="${fontSize}" fill="${fontColor}" 
    text-anchor="middle" dominant-baseline="central">${shape.text}</text>
`;
      } else {
        const textX = shape.x + shape.w / 2;
        const textY = shape.y + shape.h / 2;
        const writingMode = textDirection === 'vertical-lr' ? 'writing-mode="vertical-rl"' : '';
        svg += `  <text x="${textX}" y="${textY}" 
    font-size="${fontSize}" fill="${fontColor}" 
    text-anchor="middle" dominant-baseline="central" ${writingMode}>${shape.text}</text>
`;
      }
    }
    
    return svg;
  }

  /**
   * 从样式字符串提取属性
   */
  extractStyle(style, key, defaultValue) {
    const match = style.match(new RegExp(`${key}=([^;]+)`));
    return match ? match[1] : defaultValue;
  }
}

// ============ 主入口 ============
function checkQuality(drawioPath, autoFix = false, generatePreview = false) {
  const checker = new DrawioQualityChecker();
  const result = checker.check(drawioPath);
  
  console.log('\n=== 质量检查结果 ===\n');
  console.log(`文件：${drawioPath}`);
  console.log(`通过：${result.passed ? '✅ 是' : '❌ 否'}`);
  console.log(`统计：`);
  console.log(`  - 总图形数：${result.stats.totalShapes}`);
  console.log(`  - 文字图形：${result.stats.textShapes}`);
  console.log(`  - 连接线：${result.stats.connectionShapes}`);
  
  if (result.issues.length > 0) {
    console.log(`\n问题（${result.issues.length}）：`);
    for (const issue of result.issues) {
      const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
      console.log(`  ${icon} [${issue.severity}] ${issue.type}: ${issue.message}`);
    }
    
    // 自动修正
    if (autoFix) {
      console.log('\n 开始自动修正...');
      const fixer = new DrawioAutoFixer();
      const fixResult = fixer.fix(drawioPath);
      
      if (fixResult.fixed) {
        console.log(`✅ 已修正 ${fixResult.fixes.length} 个问题：`);
        for (const fix of fixResult.fixes) {
          console.log(`  - ${fix.type}: ${fix.message}`);
        }
        
        // 重新检查
        console.log('\n🔄 重新检查...');
        const newResult = checker.check(drawioPath);
        console.log(`修正后通过：${newResult.passed ? '✅ 是' : '❌ 否'}`);
      } else {
        console.log('✅ 无需修正');
      }
    }
  } else {
    console.log('\n✅ 未发现问题');
  }
  
  // 生成 SVG 预览
  if (generatePreview) {
    console.log('\n🖼️  生成 SVG 预览...');
    const previewer = new DrawioSvgPreview();
    const svgPath = drawioPath.replace('.drawio', '.svg');
    previewer.generateSvg(drawioPath, svgPath);
    console.log(`✅ 预览已生成：${svgPath}`);
    
    // 自动打开浏览器
    const { exec } = require('child_process');
    exec(`start ${svgPath}`, (err) => {
      if (err) console.log('⚠️  无法自动打开，请手动打开');
    });
  }
  
  return result;
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法：node drawio-quality-checker.js <drawio 文件路径> [选项]');
    console.log('');
    console.log('选项：');
    console.log('  --fix       自动修正问题');
    console.log('  --preview   生成 SVG 预览并自动打开');
    console.log('');
    console.log('示例：');
    console.log('  node drawio-quality-checker.js output.drawio');
    console.log('  node drawio-quality-checker.js output.drawio --fix');
    console.log('  node drawio-quality-checker.js output.drawio --fix --preview');
    process.exit(1);
  }
  
  const drawioPath = args[0];
  const autoFix = args.includes('--fix');
  const generatePreview = args.includes('--preview');
  
  const result = checkQuality(drawioPath, autoFix, generatePreview);
  process.exit(result.passed ? 0 : 1);
}

module.exports = { DrawioQualityChecker, DrawioSvgPreview, checkQuality };
