import React, { useState, useEffect, useRef } from 'react';

const Terminal = ({
    output,
    error,
    isCompiling,
    onRun,
    onInput, // This will be used to set the STDIN for the next run
    currentLanguage,
    currentFilename
}) => {
    const [history, setHistory] = useState([
        { type: 'system', content: 'CoTra-IDE Terminal v1.1.0' },
        { type: 'system', content: 'Enter input in the STDIN box below if your code requires it.' },
        { type: 'system', content: 'Type "run" to execute.' }
    ]);
    const [inputBuffer, setInputBuffer] = useState('');
    const [stdinBuffer, setStdinBuffer] = useState('');
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // ... scroll effect

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    // Focus input on click
    const handleContainerClick = (e) => {
        // Don't focus terminal input if clicking in STDIN area
        if (e.target.closest('.terminal-stdin-area')) return;
        inputRef.current?.focus();
    };

    // Handle external execution
    useEffect(() => {
        if (isCompiling) {
            setHistory(prev => [...prev, { type: 'command', content: `running ${currentFilename}...` }]);
        }
    }, [isCompiling, currentFilename]);

    // Handle output/error updates
    useEffect(() => {
        if (output) {
            setHistory(prev => [...prev, { type: 'output', content: output }]);
        }
        if (error) {
            setHistory(prev => [...prev, { type: 'error', content: error }]);
        }
    }, [output, error]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const command = inputBuffer.trim();
            setHistory(prev => [...prev, { type: 'command', content: command }]);
            setInputBuffer('');

            if (command.toLowerCase() === 'clear') {
                setHistory([]);
            } else if (command.toLowerCase() === 'run') {
                onRun();
            } else {
                setHistory(prev => [...prev, { type: 'error', content: `Command not found: ${command}` }]);
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
                <div className="terminal-title">user@cotra: ~/{currentLanguage}</div>
            </div>

            {/* STDIN Area - Explicit Input Field */}
            <div className="terminal-stdin-area" style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--panel-border)',
                background: 'rgba(0,0,0,0.2)'
            }}>
                <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    marginBottom: '4px',
                    fontFamily: 'var(--font-header)'
                }}>
                    PROGRAM INPUT (STDIN)
                </label>
                <textarea
                    value={stdinBuffer}
                    onChange={(e) => {
                        setStdinBuffer(e.target.value);
                        if (onInput) onInput(e.target.value);
                    }}
                    placeholder="Enter input here before running (e.g. 10 20)..."
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        resize: 'none',
                        outline: 'none',
                        height: '24px', // Compact height
                        overflow: 'hidden'
                    }}
                />
            </div>

            <div className="terminal-body">
                {history.map((line, index) => (
                    <div key={index} className={`terminal-line ${line.type}`}>
                        {line.type === 'command' && <span className="prompt">➜ ~ </span>}
                        <span className="content">{line.content}</span>
                    </div>
                ))}
                <div className="terminal-input-line">
                    <span className="prompt">➜ ~ </span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="terminal-input"
                        value={inputBuffer}
                        onChange={(e) => setInputBuffer(e.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck="false"
                        autoComplete="off"
                    />
                </div>
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default Terminal;
