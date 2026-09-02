/**
 * drawio-mcp-server.js - Draw.io MCP 服务器
 * 通过 localhost 控制 Draw.io 桌面版，实现实时可视化绘制
 * 
 * 基于 scientific-illustrator 的 MCP 协议，融合 DSH 模板系统
 */

const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ============ 配置 ============
const MCP_PORT = 8765;
const DRAWIO_PATH = process.env.DRAWIO_PATH || 'C:\\Program Files\\draw.io\\draw.io.exe';

// ============ Draw.io 控制 ============
class DrawioController {
  constructor() {
    this.connected = false;
    this.currentPage = null;
  }

  /**
   * 启动或连接 Draw.io 桌面版
   */
  async launch() {
    try {
      // 检查是否已运行
      const running = execSync('tasklist /FI "IMAGENAME eq draw.io.exe" /FO CSV /NH', { encoding: 'utf-8' });
      if (running.includes('draw.io.exe')) {
        console.log('✅ Draw.io 已在运行');
      } else {
        console.log('🚀 启动 Draw.io...');
        execSync(`"${DRAWIO_PATH}" --no-sandbox`, { stdio: 'ignore' });
        await this.sleep(3000);
      }
      
      this.connected = true;
      return { success: true, message: 'Draw.io 已就绪' };
    } catch (error) {
      return { success: false, message: `启动失败：${error.message}` };
    }
  }

  /**
   * 获取当前画布状态
   */
  async status() {
    return {
      connected: this.connected,
      page: this.currentPage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 添加形状到画布
   */
  async addShape(shape) {
    if (!this.connected) {
      return { success: false, message: '未连接到 Draw.io' };
    }

    // 通过 Draw.io 的 URL 协议添加形状
    const command = this.buildShapeCommand(shape);
    
    try {
      // 使用 Draw.io 的 HTTP API（需要启用）
      const response = await this.sendToDrawio(command);
      return { success: true, shapeId: response.id };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 批量绘制（带延迟，便于观察）
   */
  async drawSequence(shapes, delayMs = 500) {
    const results = [];
    for (const shape of shapes) {
      const result = await this.addShape(shape);
      results.push(result);
      await this.sleep(delayMs);
    }
    return results;
  }

  /**
   * 截图检查
   */
  async screenshot() {
    if (!this.connected) {
      return { success: false, message: '未连接到 Draw.io' };
    }

    try {
      // 使用 Draw.io 的导出功能
      const screenshotPath = path.join(__dirname, `screenshot_${Date.now()}.png`);
      const command = `draw.io --export --format png --output "${screenshotPath}"`;
      execSync(command, { stdio: 'ignore' });
      
      return { success: true, path: screenshotPath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 保存 .drawio 文件
   */
  async saveSnapshot(filePath) {
    if (!this.connected) {
      return { success: false, message: '未连接到 Draw.io' };
    }

    try {
      const command = `draw.io --save "${filePath}"`;
      execSync(command, { stdio: 'ignore' });
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ============ 辅助方法 ============

  buildShapeCommand(shape) {
    // 构建 Draw.io 可识别的形状命令
    return {
      type: shape.type,
      x: shape.x,
      y: shape.y,
      width: shape.w,
      height: shape.h,
      text: shape.text,
      style: shape.style
    };
  }

  async sendToDrawio(command) {
    // 通过 HTTP 发送到 Draw.io（需要 Draw.io 启用 HTTP 监听）
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 8766, // Draw.io HTTP 端口
        path: '/api/v1/shapes',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(command));
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ MCP 服务器 ============
const controller = new DrawioController();

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { method, params } = JSON.parse(body);
      let result;

      switch (method) {
        case 'drawio_live_launch':
          result = await controller.launch();
          break;
        
        case 'drawio_live_status':
          result = await controller.status();
          break;
        
        case 'drawio_live_add_shape':
          result = await controller.addShape(params);
          break;
        
        case 'drawio_live_draw_sequence':
          result = await controller.drawSequence(params.shapes, params.delayMs);
          break;
        
        case 'drawio_live_screenshot':
          result = await controller.screenshot();
          break;
        
        case 'drawio_live_save_snapshot':
          result = await controller.saveSnapshot(params.filePath);
          break;
        
        default:
          result = { success: false, message: `Unknown method: ${method}` };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: error.message }));
    }
  });
});

server.listen(MCP_PORT, '127.0.0.1', () => {
  console.log(` Draw.io MCP 服务器已启动：http://127.0.0.1:${MCP_PORT}`);
  console.log('可用方法：');
  console.log('  - drawio_live_launch');
  console.log('  - drawio_live_status');
  console.log('  - drawio_live_add_shape');
  console.log('  - drawio_live_draw_sequence');
  console.log('  - drawio_live_screenshot');
  console.log('  - drawio_live_save_snapshot');
});
