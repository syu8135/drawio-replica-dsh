#!/usr/bin/env node
/**
 * layout_flowchart_academic.js
 * 学术风格流程图布局引擎（独立版本）v2
 *
 * 改进：
 * - 分支节点水平展开（左右分布）
 * - 控制画布高度在 600px 内
 * - 回环连线用折线
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  canvas: { width: 800, height: 600 },
  node: { width: 130, height: 40 },
  decision: { width: 100, height: 60 },
  spacing: { x: 90, y: 25 },
  margin: { top: 25, left: 40 },
  style: {
    startEnd: { fillColor: '#F5F5F5', strokeColor: '#333333', strokeWidth: 2 },
    process: { fillColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 2 },
    decision: { fillColor: '#F5F5F5', strokeColor: '#333333', strokeWidth: 2 },
    io: { fillColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 2 },
    font: { family: 'Arial', size: 14, color: '#000000' }
  }
};

// ============ 布局引擎 ============
class FlowchartLayout {
  constructor(nodes, flows) {
    this.nodes = nodes;
    this.flows = flows;
    this.positions = new Map();
    this.mainColumn = CONFIG.canvas.width / 2;
  }

  calculatePositions() {
    // 主流程节点（非分支）
    const mainFlow = ['start', 'login_page', 'check_register', 'check_remember', 'do_login', 'check_result', 'success', 'end'];
    const branchNodes = {
      'register': { parent: 'check_register', direction: 'right', label: '否' },
      'input_manual': { parent: 'check_remember', direction: 'left', label: '否' },
      'input_auto': { parent: 'check_remember', direction: 'right', label: '是' },
      'error_account': { parent: 'check_result', direction: 'left', label: '账号错误' },
      'error_password': { parent: 'check_result', direction: 'right', label: '密码错误' }
    };

    // 主流程垂直排列
    let y = CONFIG.margin.top;
    for (const nodeId of mainFlow) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      const w = node.type === 'decision' ? CONFIG.decision.width : CONFIG.node.width;
      const h = node.type === 'decision' ? CONFIG.decision.height : CONFIG.node.height;
      const x = this.mainColumn - w / 2;
      
      this.positions.set(nodeId, { x, y, w, h });
      y += h + CONFIG.spacing.y;
    }

    // 分支节点水平展开
    for (const [nodeId, branch] of Object.entries(branchNodes)) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      const parentPos = this.positions.get(branch.parent);
      if (!parentPos) continue;

      const x = branch.direction === 'left'
        ? parentPos.x - CONFIG.node.width - CONFIG.spacing.x
        : parentPos.x + parentPos.w + CONFIG.spacing.x;
      
      this.positions.set(nodeId, { x, y: parentPos.y, w: CONFIG.node.width, h: CONFIG.node.height });
    }

    return this.positions;
  }

  generateDrawio() {
    const positions = this.calculatePositions();
    const cells = [];
    let cellId = 2;

    // 生成节点
    for (const node of this.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const id = `cell_${cellId++}`;
      node.cellId = id;

      let shape, style;
      switch (node.type) {
        case 'start':
        case 'end':
          shape = 'rounded=1;arcSize=50;';
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
      const fromPos = positions.get(flow.from);
      const toPos = positions.get(flow.to);

      // 判断连线类型
      const isHorizontal = Math.abs(fromPos.y - toPos.y) < 30;
      const isReturn = toPos.y < fromPos.y;

      let edgeStyle;
      if (isHorizontal) {
        // 水平连线（分支）
        const exitX = fromPos.x < toPos.x ? 1 : 0;
        const entryX = fromPos.x < toPos.x ? 0 : 1;
        edgeStyle = `endArrow=classic;exitX=${exitX};exitY=0.5;exitDx=0;exitDy=0;entryX=${entryX};entryY=0.5;entryDx=0;entryDy=0;`;
      } else if (isReturn) {
        // 回环连线（折线）
        edgeStyle = 'endArrow=classic;exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;curved=1;';
      } else {
        // 垂直连线
        edgeStyle = 'endArrow=classic;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;';
      }

      cells.push(`      <mxCell id="${id}" value="" style="${edgeStyle}" edge="1" source="${fromNode.cellId}" target="${toNode.cellId}" parent="1">`);
      cells.push(`        <mxGeometry relative="1" as="geometry"/>`);
      cells.push(`      </mxCell>`);

      // 添加连线标签
      if (flow.label) {
        const labelId = `label_${id}`;
        cells.push(`      <mxCell id="${labelId}" value="${flow.label}" style="edgeLabel;html=1;" vertex="1" connectable="0" parent="${id}">`);
        cells.push(`        <mxGeometry relative="1" as="geometry"/>`);
        cells.push(`      </mxCell>`);
      }
    }

    // 组装 XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio-replica-dsh" modified="${new Date().toISOString()}" agent="layout_flowchart_academic" version="2.0">
  <diagram name="流程图" id="flowchart">
    <mxGraphModel dx="${CONFIG.canvas.width}" dy="${CONFIG.canvas.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="800" pageHeight="600" math="0" shadow="0">
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

  _buildStyle(styleObj) {
    return `fillColor=${styleObj.fillColor};strokeColor=${styleObj.strokeColor};strokeWidth=${styleObj.strokeWidth};fontFamily=${CONFIG.style.font.family};fontSize=${CONFIG.style.font.size};fontColor=${CONFIG.style.font.color};`;
  }
}

module.exports = { FlowchartLayout, CONFIG };
