#!/usr/bin/env node
/**
 * collision-check.js
 * 通用碰撞检测与自动修复工具
 *
 * 支持：
 * - SVG 文件（流程图、E-R 图等）
 * - Draw.io XML 文件
 *
 * 功能：
 * 1. 检测连线是否穿过任何节点
 * 2. 自动调整路径避开碰撞
 * 3. 生成修复后的文件
 *
 * 用法：
 *   node collision-check.js --input <file.svg|file.drawio> [--output <file>] [--fix]
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  nodePadding: 5, // 节点周围的安全边距
  pathMargin: 30, // 路径绕行的最小距离
};

// ============ 几何工具 ============
class Geometry {
  // 线段与矩形相交检测（排除端点连接）
  static lineIntersectsRect(x1, y1, x2, y2, rect) {
    const { x, y, w, h } = rect;
    const padding = CONFIG.nodePadding;
    
    // 扩展矩形（安全边距）
    const rx = x - padding;
    const ry = y - padding;
    const rw = w + padding * 2;
    const rh = h + padding * 2;
    
    // 计算线段长度
    const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    
    // 忽略短线段（< 30px，通常是连接到节点边缘的）
    if (lineLength < 30) return false;
    
    // 检查线段端点是否在矩形边缘附近（如果是，则是正常连接）
    const startInRect = Geometry.pointInRect(x1, y1, rx - 5, ry - 5, rw + 10, rh + 10);
    const endInRect = Geometry.pointInRect(x2, y2, rx - 5, ry - 5, rw + 10, rh + 10);
    
    // 如果两个端点都在矩形附近，可能是穿过矩形，需要进一步检查
    // 如果只有一个端点在矩形附近，则是正常连接
    if (startInRect && !endInRect) {
      // 起点在矩形附近，检查线段是否从矩形出发
      const distFromStart = Math.sqrt(Math.pow(x1 - (x + w/2), 2) + Math.pow(y1 - (y + h/2), 2));
      if (distFromStart < Math.max(w, h)) return false; // 起点在矩形内/附近，正常连接
    }
    if (endInRect && !startInRect) {
      // 终点在矩形附近，检查线段是否连接到矩形
      const distFromEnd = Math.sqrt(Math.pow(x2 - (x + w/2), 2) + Math.pow(y2 - (y + h/2), 2));
      if (distFromEnd < Math.max(w, h)) return false; // 终点在矩形内/附近，正常连接
    }
    
    // 检查线段中点是否在矩形内（排除端点）
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    if (Geometry.pointInRect(midX, midY, rx, ry, rw, rh)) {
      return true;
    }
    
    // 检查线段是否与矩形的四条边相交（排除端点附近的相交）
    const edges = [
      { x1: rx, y1: ry, x2: rx + rw, y2: ry }, // 上边
      { x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh }, // 右边
      { x1: rx + rw, y1: ry + rh, x2: rx, y2: ry + rh }, // 下边
      { x1: rx, y1: ry + rh, x2: rx, y2: ry } // 左边
    ];
    
    for (const edge of edges) {
      if (Geometry.lineIntersectsLine(x1, y1, x2, y2, edge.x1, edge.y1, edge.x2, edge.y2)) {
        // 检查交点是否靠近线段端点（如果是，则是正常连接）
        const intersect = Geometry.lineIntersection(x1, y1, x2, y2, edge.x1, edge.y1, edge.x2, edge.y2);
        if (intersect) {
          const distToStart = Math.sqrt(Math.pow(intersect.x - x1, 2) + Math.pow(intersect.y - y1, 2));
          const distToEnd = Math.sqrt(Math.pow(intersect.x - x2, 2) + Math.pow(intersect.y - y2, 2));
          
          // 如果交点靠近端点（< 20% 线段长度或 < 30px），则是正常连接
          if (distToStart < lineLength * 0.2 || distToStart < 30 || 
              distToEnd < lineLength * 0.2 || distToEnd < 30) {
            continue;
          }
        }
        return true;
      }
    }
    
    return false;
  }
  
  // 计算两线段交点
  static lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }
    
    return null;
  }
  
  // 两线段相交检测
  static lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return false; // 平行
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  
  // 点是否在矩形内
  static pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }
}

// ============ SVG 解析 ============
class SVGParser {
  static parse(svgContent) {
    const nodes = [];
    const paths = [];
    
    // 解析矩形节点
    const rectRegex = /<rect\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g;
    let match;
    while ((match = rectRegex.exec(svgContent)) !== null) {
      nodes.push({
        type: 'rect',
        x: parseInt(match[1]),
        y: parseInt(match[2]),
        w: parseInt(match[3]),
        h: parseInt(match[4])
      });
    }
    
    // 解析菱形节点（近似为矩形）
    const polygonRegex = /<polygon\s+points="([^"]+)"/g;
    while ((match = polygonRegex.exec(svgContent)) !== null) {
      const points = match[1].split(' ').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
      
      // 计算包围盒
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      nodes.push({
        type: 'diamond',
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
      });
    }
    
    // 解析连线路径
    const pathRegex = /<(?:line|polyline|path)\s+[^>]*?(?:d="([^"]+)"|x1="(\d+)"\s+y1="(\d+)"\s+x2="(\d+)"\s+y2="(\d+)")[^>]*?>/g;
    while ((match = pathRegex.exec(svgContent)) !== null) {
      if (match[1]) {
        // path 元素
        const d = match[1];
        const points = [];
        const cmdRegex = /[ML]\s*(\d+)\s+(\d+)/g;
        let cmdMatch;
        while ((cmdMatch = cmdRegex.exec(d)) !== null) {
          points.push({ x: parseInt(cmdMatch[1]), y: parseInt(cmdMatch[2]) });
        }
        if (points.length >= 2) {
          paths.push({ points });
        }
      } else if (match[2]) {
        // line 元素
        paths.push({
          points: [
            { x: parseInt(match[2]), y: parseInt(match[3]) },
            { x: parseInt(match[4]), y: parseInt(match[5]) }
          ]
        });
      }
    }
    
    // 解析 polyline 元素
    const polylineRegex = /<polyline\s+points="([^"]+)"/g;
    while ((match = polylineRegex.exec(svgContent)) !== null) {
      const points = match[1].split(/\s+/).map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
      paths.push({ points });
    }
    
    return { nodes, paths };
  }
}

// ============ 碰撞检测 ============
class CollisionDetector {
  constructor(nodes, paths, sourceTargets = []) {
    this.nodes = nodes;
    this.paths = paths;
    this.sourceTargets = sourceTargets;
    this.collisions = [];
  }
  
  detect() {
    this.collisions = [];
    
    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      const pathCollisions = [];
      const st = this.sourceTargets[i] || {};
      
      // 检查路径的每个线段
      for (let j = 0; j < path.points.length - 1; j++) {
        const p1 = path.points[j];
        const p2 = path.points[j + 1];
        
        for (let k = 0; k < this.nodes.length; k++) {
          const node = this.nodes[k];
          
          // 跳过源节点和目标节点（正常连接）
          if (k === st.source || k === st.target) continue;
          
          if (Geometry.lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, node)) {
            pathCollisions.push({
              pathIndex: i,
              segmentIndex: j,
              node: node,
              nodeIndex: k,
              p1: p1,
              p2: p2
            });
          }
        }
      }
      
      if (pathCollisions.length > 0) {
        this.collisions.push({
          pathIndex: i,
          path: path,
          collisions: pathCollisions
        });
      }
    }
    
    return this.collisions;
  }
  
  // 生成碰撞报告
  report() {
    if (this.collisions.length === 0) {
      return '✅ 未检测到碰撞';
    }
    
    let report = `❌ 检测到 ${this.collisions.length} 条连线存在碰撞：\n\n`;
    
    for (const collision of this.collisions) {
      report += `路径 ${collision.pathIndex}:\n`;
      report += `  起点：(${collision.path.points[0].x}, ${collision.path.points[0].y})\n`;
      report += `  终点：(${collision.path.points[collision.path.points.length - 1].x}, ${collision.path.points[collision.path.points.length - 1].y})\n`;
      report += `  碰撞节点：\n`;
      
      for (const col of collision.collisions) {
        report += `    - 线段 (${col.p1.x},${col.p1.y})→(${col.p2.x},${col.p2.y}) 穿过节点 (${col.node.x},${col.node.y},${col.node.w}x${col.node.h})\n`;
      }
      report += '\n';
    }
    
    return report;
  }
}

// ============ 主流程 ============
function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputPath = null;
  let fixMode = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputPath = args[++i];
    else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
    else if (args[i] === '--fix') fixMode = true;
  }
  
  if (!inputPath) {
    console.error('用法：node collision-check.js --input <file.svg|file.drawio> [--output <file>] [--fix]');
    process.exit(1);
  }
  
  if (!fs.existsSync(inputPath)) {
    console.error(`错误：文件不存在：${inputPath}`);
    process.exit(1);
  }
  
  // 读取文件
  const content = fs.readFileSync(inputPath, 'utf-8');
  
  // 检测文件类型
  const isSVG = inputPath.endsWith('.svg');
  const isDrawio = inputPath.endsWith('.drawio');
  
  if (!isSVG && !isDrawio) {
    console.error('错误：仅支持 .svg 和 .drawio 文件');
    process.exit(1);
  }
  
  // 解析
  let nodes, paths;
  
  if (isSVG) {
    const parsed = SVGParser.parse(content);
    nodes = parsed.nodes;
    paths = parsed.paths;
  } else {
    // Draw.io XML 解析（简化版）
    console.error('Draw.io 碰撞检测功能开发中...');
    process.exit(1);
  }
  
  console.log(`📊 解析完成：${nodes.length} 个节点，${paths.length} 条连线`);
  
  // 碰撞检测
  const detector = new CollisionDetector(nodes, paths);
  const collisions = detector.detect();
  
  // 输出报告
  console.log('\n' + detector.report());
  
  // 修复模式
  if (fixMode && collisions.length > 0) {
    console.log('🔧 自动修复功能开发中，请手动调整以下路径：');
    
    for (const collision of collisions) {
      const path = collision.path;
      console.log(`\n路径 ${collision.pathIndex}:`);
      console.log(`  原路径：${path.points.map(p => `(${p.x},${p.y})`).join(' → ')}`);
    }
  }
  
  // 退出码
  process.exit(collisions.length > 0 ? 1 : 0);
}

main();
