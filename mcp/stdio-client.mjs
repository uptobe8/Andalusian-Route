import { spawn } from 'node:child_process';
import readline from 'node:readline';

export class McpStdioClient {
  constructor(command, args = [], env = {}) {
    this.command = command; this.args = args; this.env = env;
    this.proc = null; this.seq = 1; this.pending = new Map(); this.ready = false;
  }
  async start() {
    if (this.proc && this.ready) return;
    this.proc = spawn(this.command, this.args, { env: { ...process.env, ...this.env }, stdio: ['pipe','pipe','pipe'] });
    this.proc.on('error', err => this.rejectAll(err));
    this.proc.on('exit', code => { this.ready = false; this.rejectAll(new Error(`MCP ${this.command} exited ${code}`)); });
    this.proc.stderr.on('data', d => process.stderr.write(`[mcp:${this.command}] ${d}`));
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', line => {
      line = line.trim(); if (!line) return;
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const {resolve,reject,timer} = this.pending.get(msg.id); clearTimeout(timer); this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error))); else resolve(msg.result);
      }
    });
    await this.request('initialize', { protocolVersion:'2025-03-26', capabilities:{}, clientInfo:{name:'andalusian-roude',version:'1.0.0'} });
    this.notify('notifications/initialized', {});
    this.ready = true;
  }
  rejectAll(err){ for(const [,p] of this.pending){clearTimeout(p.timer);p.reject(err);} this.pending.clear(); }
  send(obj){ if(!this.proc?.stdin?.writable) throw new Error('MCP process unavailable'); this.proc.stdin.write(JSON.stringify(obj)+'\n'); }
  notify(method, params={}){ this.send({jsonrpc:'2.0',method,params}); }
  request(method, params={}, timeout=30000){
    const id=this.seq++; this.send({jsonrpc:'2.0',id,method,params});
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`MCP timeout: ${method}`));},timeout);this.pending.set(id,{resolve,reject,timer});});
  }
  async listTools(){ await this.start(); return this.request('tools/list',{}); }
  async callTool(name,args={}){ await this.start(); return this.request('tools/call',{name,arguments:args},45000); }
}
