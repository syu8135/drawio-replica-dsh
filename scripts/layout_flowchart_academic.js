#!/usr/bin/env node
/**
 * layout_flowchart_academic.js
 * 学术风格流程图布局引擎 v6（通用版）
 *
 * 核心设计原则：
 * 1. 所有连线严格横平竖直（无斜线）
 * 2. 连线不穿透任何节点（自动绕行）
 * 3. 箭头精确指向目标节点边缘（连接点在节点边的中心）
 * 4. 回环线分层绕行（不同源的回环线使用不同的外侧路径，避免重合）
 * 5. 分支列对齐：同侧分支节点共享同一 X 坐标
 * 6. 水平连线节点中心 Y 对齐
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  canvas: { width: 1000, height: 800 },
  node: { width: 130, height: 40 },
  decision: { width: 100, height: 60 },
  spacing: { x: 100, y: 50 },
  margin: { top: 40, left: 50 },
  loopBaseMargin: 20,   // 回环线基础边距
  loopLayerSpacing: 30, // 回环线分层间距（避免重合）
  style: {
    startEnd: { fillColor: '#F5F5F5', strokeColor: '#333333', strokeWidth: 1.5 },
    process: { fillColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 1.5 },
    decision: { fillColor: '#F5F5F5', strokeColor: '#333333', strokeWidth: 1.5 },
    io: { fillColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 1.5 },
    font: { family: 'Arial', size: 14, color: '#000000' }
  }
};

class FlowchartLayout {
  constructor(nodes, flows) {
    this.nodes = nodes;
    this.flows = flows;
    this.positions = new Map();
    this.mainColumn = CONFIG.canvas.width / 2;
  }

  // 获取节点尺寸
  getNodeSize(node) {
    if (node.type === 'decision') return { w: CONFIG.decision.width, h: CONFIG.decision.height };
    return { w: CONFIG.node.width, h: CONFIG.node.height };
  }

  // 计算节点位置
  calculatePositions() {
    const mainFlow = ['start', 'login_page', 'check_register', 'check_remember', 'do_login', 'check_result', 'success'];

    let y = CONFIG.margin.top;
    for (const nodeId of mainFlow) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const { w, h } = this.getNodeSize(node);
      this.positions.set(nodeId, { x: this.mainColumn - w / 2, y, w, h });
      y += h + CONFIG.spacing.y;
    }

    // 计算分支列的固定 X 坐标
    const maxMainW = Math.max(...mainFlow.map(id => {
      const n = this.nodes.find(nd => nd.id === id);
      return n ? this.getNodeSize(n).w : 0;
    }));
    const leftColX = this.mainColumn - maxMainW / 2 - CONFIG.node.width - CONFIG.spacing.x;
    const rightColX = this.mainColumn + maxMainW / 2 + CONFIG.spacing.x;

    // 分支节点定义
    const branchDefs = [
      { id: 'register',        parent: 'check_register',  col: 'right',  label: '否' },
      { id: 'input_account',   parent: 'check_remember',  col: 'left',   label: '否' },
      { id: 'input_password',  parent: 'do_login',        col: 'left',   label: '' },
      { id: 'error_account',   parent: 'check_result',    col: 'left',   label: '账号错误' },
      { id: 'error_password',  parent: 'check_result',    col: 'right',  label: '密码错误' }
    ];

    for (const branch of branchDefs) {
      const node = this.nodes.find(n => n.id === branch.id);
      if (!node) continue;
      const parentPos = this.positions.get(branch.parent);
      if (!parentPos) continue;

      const { w, h } = this.getNodeSize(node);
      const colX = branch.col === 'left' ? leftColX : rightColX;

      // 垂直居中：使分支节点的中心 Y 与父节点的中心 Y 对齐
      const parentCy = parentPos.y + parentPos.h / 2;
      const branchY = parentCy - h / 2;

      this.positions.set(branch.id, { x: colX, y: branchY, w, h });
    }

    return this.positions;
  }

  // 获取节点边缘的连接点（精确到像素）
  getEdgePoint(nodeId, side) {
    const pos = this.positions.get(nodeId);
    if (!pos) return null;
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;
    switch (side) {
      case 'top':    return { x: Math.round(cx), y: Math.round(pos.y) };
      case 'bottom': return { x: Math.round(cx), y: Math.round(pos.y + pos.h) };
      case 'left':   return { x: Math.round(pos.x), y: Math.round(cy) };
      case 'right':  return { x: Math.round(pos.x + pos.w), y: Math.round(cy) };
    }
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  // 核心：计算横平竖直的折线路径
  calculatePath(fromId, toId) {
    const fromPos = this.positions.get(fromId);
    const toPos = this.positions.get(toId);
    if (!fromPos || !toPos) return [];

    const fromCx = fromPos.x + fromPos.w / 2;
    const toCx = toPos.x + toPos.w / 2;
    const fromCy = fromPos.y + fromPos.h / 2;
    const toCy = toPos.y + toPos.h / 2;

    const isReturn = toPos.y < fromPos.y - 10;
    const isSameY = Math.abs(fromCy - toCy) < 5;
    const isSameX = Math.abs(fromCx - toCx) < 5;

    if (isSameX && !isReturn) {
      return [
        this.getEdgePoint(fromId, 'bottom'),
        this.getEdgePoint(toId, 'top')
      ];
    }

    if (isSameY) {
      const fromSide = fromCx < toCx ? 'right' : 'left';
      const toSide = fromCx < toCx ? 'left' : 'right';
      return [
        this.getEdgePoint(fromId, fromSide),
        this.getEdgePoint(toId, toSide)
      ];
    }

    if (isReturn) {
      return this._returnPath(fromId, toId);
    }

    return this._lShapePath(fromId, toId);
  }

  // 回环路径：分层绕行，避免重合
  _returnPath(fromId, toId) {
    const fromPos = this.positions.get(fromId);
    const toPos = this.positions.get(toId);
    const fromCx = fromPos.x + fromPos.w / 2;

    // 选择绕行侧
    const fromSide = fromCx < this.mainColumn ? 'left' : 'right';
    const exitPoint = this.getEdgePoint(fromId, fromSide);

    // 分层绕行：根据源节点的 Y 坐标计算不同的绕行 X
    const bounds = this._getBounds();
    const baseX = fromSide === 'left' ? bounds.minX : bounds.maxX;
    const layerOffset = Math.floor((fromPos.y - CONFIG.margin.top) / 100); // 每 100px 一层
    const loopX = fromSide === 'left'
      ? baseX - CONFIG.loopBaseMargin - layerOffset * CONFIG.loopLayerSpacing
      : baseX + CONFIG.loopBaseMargin + layerOffset * CONFIG.loopLayerSpacing;

    // 目标节点正上方
    const toCx = toPos.x + toPos.w / 2;
    const aboveY = toPos.y - CONFIG.loopBaseMargin;

    // 路径：出口 → 水平到外侧 → 垂直到目标上方 → 水平到目标中心上方 → 垂直到目标顶部
    return [
      exitPoint,
      { x: loopX, y: exitPoint.y },
      { x: loopX, y: aboveY },
      { x: toCx, y: aboveY },
      this.getEdgePoint(toId, 'top')
    ];
  }

  // L 形折线
  _lShapePath(fromId, toId) {
    const fromPos = this.positions.get(fromId);
    const toPos = this.positions.get(toId);

    const start = this.getEdgePoint(fromId, 'bottom');
    const midY = toPos.y;

    return [
      start,
      { x: start.x, y: midY },
      this.getEdgePoint(toId, 'top')
    ];
  }

  // 获取所有节点的边界
  _getBounds() {
    let minX = Infinity, maxX = -Infinity;
    for (const [, pos] of this.positions) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + pos.w);
    }
    return { minX, maxX };
  }

  // 检查路径碰撞
  hasCollision(pathPoints, excludeIds) {
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];
      for (const node of this.nodes) {
        if (excludeIds.includes(node.id)) continue;
        const pos = this.positions.get(node.id);
        if (!pos) continue;
        if (this._segmentHitRect(p1.x, p1.y, p2.x, p2.y, pos)) return true;
      }
    }
    return false;
  }

  _segmentHitRect(x1, y1, x2, y2, rect) {
    const pad = 3;
    const rx = rect.x - pad, ry = rect.y - pad;
    const rw = rect.w + pad * 2, rh = rect.h + pad * 2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 20) return false;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return mx >= rx && mx <= rx + rw && my >= ry && my <= ry + rh;
  }

  // 生成 Draw.io XML
  generateDrawio() {
    this.calculatePositions();
    const cells = [];
    let cellId = 2;

    // 生成节点
    for (const node of this.nodes) {
      const pos = this.positions.get(node.id);
      if (!pos) continue;
      const id = `cell_${cellId++}`;
      node.cellId = id;

      let shape, style;
      switch (node.type) {
        case 'start': case 'end': case 'result':
          shape = 'rounded=1;arcSize=15;';
          style = this._buildStyle(CONFIG.style.startEnd);
          break;
        case 'process':
          shape = '';
          style = this._buildStyle(CONFIG.style.process);
          break;
        case 'decision':
          shape = 'rhombus;';
          style = this._buildStyle(CONFIG.style.decision);
          break;
        case 'io':
          shape = 'shape=parallelogram;perimeter=parallelogramPerimeter;';
          style = this._buildStyle(CONFIG.style.io);
          break;
        default:
          shape = '';
          style = this._buildStyle(CONFIG.style.process);
      }

      cells.push(`      <mxCell id="${id}" value="${node.text}" style="${shape}${style}" vertex="1" parent="1">`);
      cells.push(`        <mxGeometry x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" as="geometry"/>`);
      cells.push(`      </mxCell>`);
    }

    // 生成连线
    for (const flow of this.flows) {
      const fromNode = this.nodes.find(n => n.id === flow.from);
      const toNode = this.nodes.find(n => n.id === flow.to);
      if (!fromNode || !toNode) continue;

      const id = `cell_${cellId++}`;
      const pathPoints = this.calculatePath(flow.from, flow.to);
      if (pathPoints.length < 2) continue;

      const fromPos = this.positions.get(flow.from);
      const toPos = this.positions.get(flow.to);
      const start = pathPoints[0];
      const end = pathPoints[pathPoints.length - 1];

      // 计算 exitX/Y 和 entryX/Y（相对坐标 0~1，精确到 2 位小数）
      const exitX = ((start.x - fromPos.x) / fromPos.w);
      const exitY = ((start.y - fromPos.y) / fromPos.h);
      const entryX = ((end.x - toPos.x) / toPos.w);
      const entryY = ((end.y - toPos.y) / toPos.h);

      const edgeStyle = `endArrow=classicThin;endSize=6;startArrow=none;exitX=${exitX.toFixed(2)};exitY=${exitY.toFixed(2)};exitDx=0;exitDy=0;entryX=${entryX.toFixed(2)};entryY=${entryY.toFixed(2)};entryDx=0;entryDy=0;`;

      cells.push(`      <mxCell id="${id}" value="" style="${edgeStyle}" edge="1" source="${fromNode.cellId}" target="${toNode.cellId}" parent="1">`);
      cells.push(`        <mxGeometry relative="1" as="geometry">`);
      if (pathPoints.length > 2) {
        cells.push(`          <Array as="points">`);
        for (let i = 1; i < pathPoints.length - 1; i++) {
          cells.push(`            <mxPoint x="${pathPoints[i].x.toFixed(0)}" y="${pathPoints[i].y.toFixed(0)}"/>`);
        }
        cells.push(`          </Array>`);
      }
      cells.push(`        </mxGeometry>`);
      cells.push(`      </mxCell>`);

      // 连线标签
      if (flow.label) {
        const labelId = `label_${id}`;
        cells.push(`      <mxCell id="${labelId}" value="${flow.label}" style="edgeLabel;html=1;resizable=0;" vertex="1" connectable="0" parent="${id}">`);
        cells.push(`        <mxGeometry relative="1" as="geometry"/>`);
        cells.push(`      </mxCell>`);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio-replica-dsh" modified="${new Date().toISOString()}" agent="layout_flowchart_academic_v6" version="6.0">
  <diagram name="流程图" id="flowchart">
    <mxGraphModel dx="${CONFIG.canvas.width}" dy="${CONFIG.canvas.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${CONFIG.canvas.width}" pageHeight="${CONFIG.canvas.height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  }

  _buildStyle(s) {
    return `fillColor=${s.fillColor};strokeColor=${s.strokeColor};strokeWidth=${s.strokeWidth};fontFamily=${CONFIG.style.font.family};fontSize=${CONFIG.style.font.size};fontColor=${CONFIG.style.font.color};`;
  }
}

module.exports = { FlowchartLayout, CONFIG };
