import * as vscode from 'vscode';
import { ParserService, Relationship } from './parserService';

export class VisualizerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devx.visualizer';
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
            this._view.webview.html = '<div style="padding: 20px; color: #888;">Open a file to see visual intelligence...</div>';
            return;
        }

        const code = editor.document.getText();
        const lang = editor.document.languageId;
        const relationships = ParserService.parse(code, lang);

        this._view.webview.html = this.getHtmlContent(code, relationships, lang);
    }

    private getHtmlContent(code: string, relationships: Relationship[], lang: string): string {
        const lines = code.split('\n');

        const nodeMap = new Map<number, Set<{ name: string, startCol: number, endCol: number, id: string }>>();
        relationships.forEach(rel => {
            if (!nodeMap.has(rel.start.line)) { nodeMap.set(rel.start.line, new Set()); }
            if (!nodeMap.has(rel.end.line)) { nodeMap.set(rel.end.line, new Set()); }
            nodeMap.get(rel.start.line)!.add({ ...rel.start, id: 'start-' + rel.id });
            nodeMap.get(rel.end.line)!.add({ ...rel.end, id: 'def-' + rel.id });
        });

        const codeLinesHtml = lines.map((line, i) => {
            const nodes = nodeMap.get(i);
            let html = '';

            if (nodes && nodes.size > 0) {
                const sortedNodes = Array.from(nodes).sort((a, b) => a.startCol - b.startCol);
                let cursor = 0;
                for (const node of sortedNodes) {
                    const start = Math.max(node.startCol, cursor);
                    const end = Math.min(node.endCol, line.length);
                    if (start > cursor) {
                        html += this.escapeHtml(line.substring(cursor, start));
                    }
                    if (start < end) {
                        html += '<span class="node" id="' + this.escapeHtml(node.id) + '">' + this.escapeHtml(line.substring(start, end)) + '</span>';
                    }
                    cursor = end;
                }
                if (cursor < line.length) {
                    html += this.escapeHtml(line.substring(cursor));
                }
            } else {
                html = this.escapeHtml(line) || ' ';
            }

            return '<div class="line" id="line-' + i + '"><span class="ln">' + (i + 1) + '</span><pre>' + (html || ' ') + '</pre></div>';
        }).join('\n');

        const colors = ['#4fc1ff', '#c586c0', '#dcdcaa', '#6a9955', '#ce9178', '#569cd6', '#d7ba7d', '#b5cea8'];

        return `<!DOCTYPE html>
<html>
<head>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; overflow-x: hidden; }
#wrapper { position: relative; padding: 4px 8px 4px 0; line-height: 20px; }
#arrow-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    z-index: 10;
}
.line { display: flex; white-space: pre; height: 20px; position: relative; }
.ln { width: 34px; color: #6e6e6e; text-align: right; padding-right: 8px; flex-shrink: 0; user-select: none; }
pre { margin: 0; font-family: inherit; overflow: visible; display: inline; }
.node { color: #4fc1ff; font-weight: bold; text-decoration: underline; text-decoration-color: rgba(79,193,255,0.6); text-underline-offset: 2px; cursor: pointer; position: relative; z-index: 5; }
.node:hover { background: rgba(79,193,255,0.15); }
.ln-highlight { background: rgba(38,79,120,0.4); }
#info { background: #252526; color: #9cdcfe; font-family: monospace; font-size: 11px; padding: 5px 8px; border-top: 1px solid #333; }
</style>
</head>
<body>
<div id="wrapper">
    <svg id="arrow-svg"></svg>
    ${codeLinesHtml}
</div>
<div id="info">Loading...</div>
<script>
(function() {
    var relationships = ${JSON.stringify(relationships)};
    var colors = ${JSON.stringify(colors)};
    var svg = document.getElementById('arrow-svg');
    var wrapper = document.getElementById('wrapper');
    var info = document.getElementById('info');

    function draw() {
        svg.innerHTML = '';
        var wRect = wrapper.getBoundingClientRect();
        if (wRect.width === 0 || wRect.height === 0) return;

        svg.setAttribute('width', wRect.width);
        svg.setAttribute('height', wRect.height);

        var found = 0;

        relationships.forEach(function(rel, idx) {
            var startEl = document.getElementById('start-' + rel.id);
            var defEl = document.getElementById('def-' + rel.id);
            if (!startEl || !defEl) return;

            var sRect = startEl.getBoundingClientRect();
            var dRect = defEl.getBoundingClientRect();

            // Start point: left edge of the usage (call) node
            var sx = sRect.left - wRect.left;
            var sy = sRect.top - wRect.top + sRect.height / 2;

            // End point: left edge of the definition node
            var ex = dRect.left - wRect.left;
            var ey = dRect.top - wRect.top + dRect.height / 2;

            // Skip zero-position elements (not yet laid out)
            if (sx === 0 && sy === 0 && ex === 0 && ey === 0) return;

            // Curve control point X: bow to the left
            // The further apart vertically, the more the curve bows left
            var dist = Math.abs(sy - ey);
            var bowX = Math.max(sx, ex) - Math.min(40, dist * 0.35 + 20);
            bowX = Math.max(4, bowX);

            var color = colors[idx % colors.length];

            // Draw cubic bezier curving left
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var d = 'M' + sx + ',' + sy +
                    ' C' + bowX + ',' + sy +
                    ' ' + bowX + ',' + ey +
                    ' ' + ex + ',' + ey;
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('opacity', '0.7');
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);

            // Small dot at usage (start) end
            var dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot1.setAttribute('cx', sx);
            dot1.setAttribute('cy', sy);
            dot1.setAttribute('r', '2.5');
            dot1.setAttribute('fill', color);
            dot1.setAttribute('opacity', '0.9');
            svg.appendChild(dot1);

            // Small dot at definition end
            var dot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot2.setAttribute('cx', ex);
            dot2.setAttribute('cy', ey);
            dot2.setAttribute('r', '2.5');
            dot2.setAttribute('fill', color);
            dot2.setAttribute('opacity', '0.9');
            svg.appendChild(dot2);

            found++;
        });

        info.textContent = 'Visual Intelligence: ' + relationships.length + ' connections | ' + found + ' drawn';
    }

    // Multiple retries for webview layout
    draw();
    setTimeout(draw, 80);
    setTimeout(draw, 200);
    setTimeout(draw, 500);
    setTimeout(draw, 1000);
    window.addEventListener('resize', draw);

    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (msg.type === 'highlight') {
            document.querySelectorAll('.line').forEach(function(el) { el.classList.remove('ln-highlight'); });
            var el = document.getElementById('line-' + msg.line);
            if (el) {
                el.classList.add('ln-highlight');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            draw();
        }
    });
})();
</script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
}
