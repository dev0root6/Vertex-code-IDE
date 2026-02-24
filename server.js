import express from 'express';
import { spawn, exec } from 'child_process';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Language mappings
const languageMap = {
  python: { ext: '.py', cmd: 'python3', args: ['-u'], timeout: 5000 },
  javascript: { ext: '.js', cmd: 'node', timeout: 5000 },
  java: { ext: '.java', cmd: 'java', timeout: 5000, compile: 'javac', timeout: 10000 },
  cpp: { ext: '.cpp', cmd: 'g++', compile: true, timeout: 10000 },
  c: { ext: '.c', cmd: 'gcc', compile: true, timeout: 10000 },
  csharp: { ext: '.cs', cmd: 'csc', timeout: 5000 },
  ruby: { ext: '.rb', cmd: 'ruby', timeout: 5000 },
  go: { ext: '.go', cmd: 'go', timeout: 5000 },
  rust: { ext: '.rs', cmd: 'rustc', compile: true, timeout: 10000 },
  php: { ext: '.php', cmd: 'php', timeout: 5000 },
  typescript: { ext: '.ts', cmd: 'ts-node', timeout: 5000 },
};

const executeCode = async (code, language, frontendCompileCommand, input) => {
  const langConfig = languageMap[language];

  if (!langConfig) {
    return {
      success: false,
      output: '',
      error: `Language "${language}" not supported. Supported: ${Object.keys(languageMap).join(', ')}`
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotra-'));
  const filename = `code${langConfig.ext}`;
  const filepath = path.join(tmpDir, filename);

  try {
    fs.writeFileSync(filepath, code);

    // Determine the actual command to execute
    let commandToExecute = langConfig.cmd;
    let commandArgs = langConfig.args ? [...langConfig.args, filepath] : [filepath];

    if (frontendCompileCommand) {
      // For C/C++/Java (compiled), frontendCompileCommand might be like "gcc -o a.out file.c && ./a.out"
      // This means the frontend wants to handle compilation and execution in one command string.
      // We'll treat this as a shell command to be executed directly, bypassing langConfig.cmd for execution.
      if (language === 'c' || language === 'cpp' || language === 'java') {
        // Need to handle Java main class properly here if it's part of frontendCompileCommand
        // For now, assume frontendCompileCommand completely dictates execution.
        // This is a simplification; a more robust solution would parse frontendCompileCommand.
        return await executeCommandAsShell(frontendCompileCommand.replace('/src/main.c', filepath).replace('/src/main.cpp', filepath).replace('/src/Main.java', filepath), tmpDir, langConfig.timeout, input);
      }
    }

    // Compile if needed (Java, C++, C, Rust)
    if (langConfig.compile) {
      if (language === 'java') {
        const compileResult = await new Promise((resolve) => {
          const proc = spawn(langConfig.compile, [filepath], {
            cwd: tmpDir,
            timeout: langConfig.timeout
          });

          let stderr = '';
          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          proc.on('close', (code) => {
            resolve({ code, stderr });
          });

          proc.on('error', (err) => {
            resolve({ code: 1, stderr: err.message });
          });
        });

        if (compileResult.code !== 0) {
          return {
            success: false,
            output: '',
            error: `Compilation error:\n${compileResult.stderr}`
          };
        }

        // Run compiled Java
        const className = 'code';
        const runResult = await executeCommand(langConfig.cmd, [className], tmpDir, langConfig.timeout, input);
        return runResult;
      } else {
        // C++, C, Rust
        const outFile = path.join(tmpDir, 'a.out');
        const compileResult = await executeCommand(langConfig.cmd, [filepath, '-o', outFile], tmpDir, langConfig.timeout);

        if (compileResult.error) {
          return compileResult;
        }

        const runResult = await executeCommand(outFile, [], tmpDir, langConfig.timeout, input);
        return runResult;
      }
    } else {
      // Interpreted languages
      return await executeCommand(commandToExecute, commandArgs, tmpDir, langConfig.timeout, input);
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `Error: ${err.message}`
    };
  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
};

const executeCommand = (cmd, args, cwd, timeout, input = '') => {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, timeout });

    let stdout = '';
    let stderr = '';

    // Pipe input to stdin of the child process
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (stderr) {
        resolve({
          success: false,
          output: stdout,
          error: stderr
        });
      } else {
        resolve({
          success: true,
          output: stdout,
          error: ''
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: `Execution error: ${err.message}`
      });
    });

    // Handle timeout
    if (timeout) {
      setTimeout(() => {
        try {
          proc.kill();
          resolve({
            success: false,
            output: stdout, // Return partial output
            error: `Execution timeout (${timeout}ms exceeded)`
          });
        } catch (e) {
          // Process already terminated
        }
      }, timeout);
    }
  });
};

const executeCommandAsShell = (command, cwd, timeout, input = '') => {
  return new Promise((resolve) => {
    // exec uses a shell, so commands like "gcc ... && ./a.out" work
    const proc = exec(command, { cwd, timeout }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || error.message
        });
      } else {
        resolve({
          success: true,
          output: stdout,
          error: stderr
        });
      }
    });

    // Pipe input to stdin of the child process
    if (input) {
      proc.stdin?.write(input);
      proc.stdin?.end();
    }
  });
};

app.post('/api/execute', async (req, res) => {
  const { code, language, compileCommand, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      success: false,
      output: '',
      error: 'Code and language are required'
    });
  }

  const result = await executeCode(code, language, compileCommand, input);
  res.json(result);
});

// Persistent workspace for user shell commands - now local .temp
const WORKSPACE_DIR = path.join(__dirname, '.temp');
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Store active shell processes for interactive input
const activeProcesses = new Map();

// Cleanup endpoint to clear the .temp directory on session refresh/close
app.post('/api/cleanup', (req, res) => {
  try {
    // Kill all active processes first
    for (const proc of activeProcesses.values()) {
      try { proc.kill(); } catch (e) { }
    }
    activeProcesses.clear();

    if (fs.existsSync(WORKSPACE_DIR)) {
      const files = fs.readdirSync(WORKSPACE_DIR);
      for (const file of files) {
        const curPath = path.join(WORKSPACE_DIR, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          fs.rmSync(curPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(curPath);
        }
      }
      console.log('🧹 Cleaned up .temp workspace');
    }
    res.json({ success: true, message: 'Workspace cleaned' });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to send STDIN to a running process
app.post('/api/shell/stdin', (req, res) => {
  const { input } = req.body;
  // For now, assume a single active session/process as Vertex is single-user IDE
  const activeProc = Array.from(activeProcesses.values())[0];

  if (activeProc) {
    try {
      activeProc.stdin.write(input + '\n');
      console.log(`Piped to stdin: ${input}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.status(404).json({ success: false, error: 'No active process found' });
  }
});

app.post('/api/shell', async (req, res) => {
  const { command, code, filename } = req.body;

  if (!command) {
    return res.status(400).json({ success: false, stdout: '', stderr: 'No command provided' });
  }

  // Save current editor code to workspace if provided
  if (code && filename) {
    try {
      const fullPath = path.join(WORKSPACE_DIR, filename);
      fs.writeFileSync(fullPath, code);
      console.log(`Saved ${filename} to ${WORKSPACE_DIR}`);
    } catch (err) {
      console.error(`Error saving file: ${err.message}`);
    }
  }

  // Set up streaming response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let finalCommand = command;
  if (command.startsWith('python ') && !command.includes(' -u ')) {
    finalCommand = command.replace('python ', 'python -u ');
  }

  const proc = spawn(finalCommand, { cwd: WORKSPACE_DIR, shell: true });
  const procId = Date.now().toString();
  activeProcesses.set(procId, proc);

  proc.stdout.on('data', (data) => {
    res.write(JSON.stringify({ type: 'stdout', content: data.toString() }) + '\n');
  });

  proc.stderr.on('data', (data) => {
    res.write(JSON.stringify({ type: 'stderr', content: data.toString() }) + '\n');
  });

  const timer = setTimeout(() => {
    proc.kill();
    activeProcesses.delete(procId);
    res.write(JSON.stringify({ type: 'error', content: 'Execution timeout (30s)' }) + '\n');
    res.end();
  }, 30000);

  proc.on('close', (code) => {
    clearTimeout(timer);
    activeProcesses.delete(procId);
    res.write(JSON.stringify({ type: 'exit', code }) + '\n');
    res.end();
  });

  proc.on('error', (err) => {
    clearTimeout(timer);
    activeProcesses.delete(procId);
    res.write(JSON.stringify({ type: 'error', content: err.message }) + '\n');
    res.end();
  });
});

app.get('/api/languages', (req, res) => {
  res.json({
    supported: Object.keys(languageMap)
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vertex Compiler running on http://localhost:${PORT}`);
});
