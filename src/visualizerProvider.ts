import * as vscode from 'vscode';
import { ParserService, Relationship } from './parserService';

export class VisualizerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vertex.visualizer';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this.update();

        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document === vscode.window.activeTextEditor?.document) {
                this.update();
            }
        });

        vscode.window.onDidChangeActiveTextEditor(() => this.update());

        vscode.window.onDidChangeTextEditorSelection(e => {
            if (e.textEditor === vscode.window.activeTextEditor) {
                this.syncHighlight(e.selections[0].active.line);
            }
        });
    }

    public syncHighlight(line: number) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'highlight', line });
        }
    }

    public update() {
        if (!this._view) { return; }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._view.webview.html = ' <div style="padding: 20px; color: #888;">Open a file to see visual intelligence...</div>';
            return;
        }

        const code = editor.document.getText();
        const lang = editor.document.languageId;
        const relationships = ParserService.parse(code, lang);

        this._view.webview.html = this.getHtmlContent(code, relationships, lang);
    }

    private getHtmlContent(code: string, relationships: Relationship[], lang: string): string {
        const lines = code.split('\n');

        // Map relationships to lines for easier span injection
        const nodeMap = new Map<number, Set<{ name: string, startCol: number, endCol: number, id: string }>>();
        relationships.forEach(rel => {
            if (!nodeMap.has(rel.start.line)) nodeMap.set(rel.start.line, new Set());
            if (!nodeMap.has(rel.end.line)) nodeMap.set(rel.end.line, new Set());

            nodeMap.get(rel.start.line)!.add({ ...rel.start, id: `start-${rel.id}` });
            nodeMap.get(rel.end.line)!.add({ ...rel.end, id: `def-${rel.id}` });
        });

        const codeLinesHtml = lines.map((line, i) => {
            const nodes = nodeMap.get(i);
            let html = '';

            if (nodes && nodes.size > 0) {
                // Sort nodes by startCol ascending
                const sortedNodes = Array.from(nodes).sort((a, b) => a.startCol - b.startCol);
                let cursor = 0;
                for (const node of sortedNodes) {
                    const start = Math.max(node.startCol, cursor);
                    const end = Math.min(node.endCol, line.length);
                    if (start > cursor) {
                        html += this.escapeHtml(line.substring(cursor, start));
                    }
                    if (start < end) {
                        html += `<span class="node" id="${this.escapeHtml(node.id)}">${this.escapeHtml(line.substring(start, end))}</span>`;
                    }
                    cursor = end;
                }
                // Remaining text after last node
                if (cursor < line.length) {
                    html += this.escapeHtml(line.substring(cursor));
                }
            } else {
                html = this.escapeHtml(line) || ' ';
            }

            return `
                <div class="line" id="line-${i}">
                    <span class="ln">${i + 1}</span>
                    <pre>${html || ' '}</pre>
                </div>
            `;
        }).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Consolas', monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; }
                    #wrapper { position: relative; padding: 10px 10px 10px 0; line-height: 20px; }
                    .line { display: flex; white-space: pre; height: 20px; }
                    .ln { width: 38px; color: #6e6e6e; text-align: right; padding-right: 10px; flex-shrink: 0; }
                    pre { margin: 0; font-family: inherit; overflow: visible; display: inline; }
                    .node { color: #4fc1ff; font-weight: bold; border-bottom: 1px dashed rgba(79,193,255,0.5); }
                    .ln-highlight { background: rgba(38,79,120,0.4); }
                    #arrow-svg { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
                    #debug { background: #252526; color: #9cdcfe; font-family: monospace; font-size: 11px; padding: 8px; margin: 8px; border: 1px solid #333; border-radius: 4px; white-space: pre-wrap; }
                    @keyframes pulse { 0%,100%{opacity:.4;stroke-width:1.5} 50%{opacity:.9;stroke-width:2} }
                    .arrow-path { animation: pulse 2s ease-in-out infinite; fill: none; stroke: #4fc1ff; }
                </style>
            </head>
            <body>
                <div id="wrapper">
                    <svg id="arrow-svg" width="0" height="0"></svg>
                    ${codeLinesHtml}
                </div>
                <div id="debug">Loading...</div>
                <script>
                    const relationships = ${JSON.stringify(relationships)};
                    const svg = document.getElementById('arrow-svg');
                    const dbg = document.getElementById('debug');
                    let attempts = 0;

                    function drawArrows() {
                        attempts++;
                        svg.innerHTML = '';
                        const wrapper = document.getElementById('wrapper');
                        const wRect = wrapper.getBoundingClientRect();
                        svg.setAttribute('width', wRect.width);
                        svg.setAttribute('height', wRect.height);

                        let found = 0, missing = 0;
                        let log = 'Attempt #' + attempts + '\\n';
                        log += 'Relationships: ' + relationships.length + '\\n';
                        log += 'Wrapper rect: ' + Math.round(wRect.width) + 'x' + Math.round(wRect.height) + '\\n\\n';

                        relationships.forEach(rel => {
                            const startEl = document.getElementById('start-' + rel.id);
                            const endEl   = document.getElementById('def-'   + rel.id);

                            if (!startEl || !endEl) {
                                missing++;
                                log += '[MISS] ' + rel.id + ' start=' + !!startEl + ' end=' + !!endEl + '\\n';
                                return;
                            }

                            found++;
                            const sRect = startEl.getBoundingClientRect();
                            const eRect = endEl.getBoundingClientRect();

                            const sx = sRect.left - wRect.left + sRect.width / 2;
                            const sy = sRect.top  - wRect.top  + sRect.height / 2;
                            const ex = eRect.left - wRect.left + eRect.width  / 2;
                            const ey = eRect.top  - wRect.top  + eRect.height / 2;

                            log += '[OK] ' + rel.id + ' s=(' + Math.round(sx)+','+Math.round(sy) + ') e=(' + Math.round(ex)+','+Math.round(ey) + ')\\n';

                            if (sx === 0 && sy === 0 && ex === 0 && ey === 0) {
                                log += '  !! All zeros - layout not ready yet\\n';
                                return;
                            }

                            const curve = Math.min(Math.abs(sy - ey) * 0.45, 80);
                            const d = 'M' + sx + ',' + sy + ' C' + (sx - curve) + ',' + sy + ' ' + (ex - curve) + ',' + ey + ' ' + ex + ',' + ey;
                            const path = document.createElementNS('http://www.w3.org/2000/svg','path');
                            path.setAttribute('d', d);
                            path.classList.add('arrow-path');
                            svg.appendChild(path);

                            [{ x:sx, y:sy }, { x:ex, y:ey }].forEach(p => {
                                const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
                                dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
                                dot.setAttribute('r', '3'); dot.setAttribute('fill', '#4fc1ff');
                                svg.appendChild(dot);
                            });
                        });

                        log += '\\nFound: ' + found + '  Missing: ' + missing;
                        dbg.textContent = log;
                    }

                    // Multiple retries to handle webview layout timing
                    drawArrows();
                    setTimeout(drawArrows, 50);
                    setTimeout(drawArrows, 200);
                    setTimeout(drawArrows, 500);
                    window.addEventListener('resize', drawArrows);

                    window.addEventListener('message', e => {
                        const msg = e.data;
                        if (msg.type === 'highlight') {
                            document.querySelectorAll('.line').forEach(el => el.classList.remove('ln-highlight'));
                            const el = document.getElementById('line-' + msg.line);
                            if (el) { el.classList.add('ln-highlight'); el.scrollIntoView({ behavior:'smooth', block:'center' }); }
                            drawArrows();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private escapeHtml(text: string): string {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
