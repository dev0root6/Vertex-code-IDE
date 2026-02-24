import React, { useState, useEffect, useRef } from 'react';
import { sendShellInput } from './compiler-service.js';

const Terminal = ({
    code,
    currentLanguage,
    currentFilename
}) => {
    const [history, setHistory] = useState([
        { type: 'system', content: 'Vertex Terminal v2.0' },
        { type: 'system', content: 'Type commands directly. e.g. python code.py, node code.js' },
    ]);
    const [inputBuffer, setInputBuffer] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    // Focus input on click
    const handleContainerClick = (e) => {
        inputRef.current?.focus();
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter') {
            const command = inputBuffer;

            if (isExecuting) {
                // If executing, send typing directly to process stdin
                setHistory(prev => [...prev, { type: 'command', content: command }]);
                setInputBuffer('');
                await sendShellInput(command);
                return;
            }

            const trimmedCommand = command.trim();
            if (!trimmedCommand) return;

            setHistory(prev => [...prev, { type: 'command', content: trimmedCommand }]);
            setCommandHistory(prev => [trimmedCommand, ...prev]);
            setHistoryIndex(-1);
            setInputBuffer('');

            if (trimmedCommand.toLowerCase() === 'clear') {
                setHistory([]);
                return;
            }

            if (trimmedCommand.toLowerCase() === 'help') {
                setHistory(prev => [...prev,
                { type: 'system', content: 'Commands: python <f>, node <f>, gcc <f> -o out, g++ <f> -o out, javac <f>, ls, cat <f>, clear' },
                { type: 'system', content: 'Tip: Type directly when a program asks for input (e.g. input())' },
                ]);
                return;
            }

            // Execute real shell command – linked to local .temp/
            setIsExecuting(true);

            try {
                const response = await fetch('http://localhost:5000/api/shell', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: trimmedCommand, code, filename: currentFilename })
                });

                if (!response.body) throw new Error("No response body");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let chunkBuffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunkBuffer += decoder.decode(value, { stream: true });
                    const lines = chunkBuffer.split('\n');
                    chunkBuffer = lines.pop(); // Last partial line

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;

                        try {
                            const data = JSON.parse(trimmedLine);
                            if (data.type === 'stdout') {
                                setHistory(prev => [...prev, { type: 'output', content: data.content }]);
                            } else if (data.type === 'stderr' || data.type === 'error') {
                                setHistory(prev => [...prev, { type: 'error', content: data.content }]);
                            }
                        } catch (err) {
                            // Raw output or malformed JSON
                            setHistory(prev => [...prev, { type: 'output', content: trimmedLine }]);
                        }
                    }
                }

                // Process final chunk if program ended without newline
                if (chunkBuffer.trim()) {
                    try {
                        const data = JSON.parse(chunkBuffer.trim());
                        if (data.type === 'stdout') {
                            setHistory(prev => [...prev, { type: 'output', content: data.content }]);
                        } else if (data.type === 'stderr' || data.type === 'error') {
                            setHistory(prev => [...prev, { type: 'error', content: data.content }]);
                        }
                    } catch (err) {
                        setHistory(prev => [...prev, { type: 'output', content: chunkBuffer.trim() }]);
                    }
                }
            } catch (err) {
                console.error("Terminal Connection Error:", err);
                setHistory(prev => [...prev, { type: 'error', content: `Terminal Error: ${err.message}` }]);
            } finally {
                setIsExecuting(false);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
                setHistoryIndex(newIndex);
                setInputBuffer(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInputBuffer(commandHistory[newIndex]);
            } else {
                setHistoryIndex(-1);
                setInputBuffer('');
            }
        }
    };

    return (
        <div className="terminal-container" onClick={handleContainerClick}>
            <div className="terminal-header">
                <div className="terminal-buttons">
                    <span className="terminal-dot red"></span>
                    <span className="terminal-dot yellow"></span>
                    <span className="terminal-dot green"></span>
                </div>
                <div className="terminal-title">
                    <span>user@vertex: ~/{currentLanguage} | {currentFilename}</span>
                </div>
            </div>

            <div className="terminal-body">
                {history.map((line, index) => (
                    <div key={index} className={`terminal-line ${line.type}`}>
                        {line.type === 'command' && <span className="prompt">$ </span>}
                        <span className="content">{line.content}</span>
                    </div>
                ))}
                {isExecuting && (
                    <div className="terminal-line system">
                        <span className="content" style={{ color: 'var(--accent)' }}>executing...</span>
                    </div>
                )}
                <div className="terminal-input-line">
                    <span className="prompt">{isExecuting ? '>> ' : '$ '}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="terminal-input"
                        value={inputBuffer}
                        onChange={(e) => setInputBuffer(e.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck="false"
                        autoComplete="off"
                        placeholder={isExecuting ? "type input for program..." : ""}
                    />
                </div>
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default Terminal;
