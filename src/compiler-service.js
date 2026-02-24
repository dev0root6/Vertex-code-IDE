import axios from 'axios';

const COMPILER_API = 'http://localhost:5000/api/execute';
const SHELL_API = 'http://localhost:5000/api/shell';

export const executeCode = async (code, language, compileCommand, input = '') => {
  try {
    const response = await axios.post(COMPILER_API, { code, language, compileCommand, input });
    return response.data;
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.response?.data?.error || `Connection error: Is the compiler running on port 5000?`
    };
  }
};

export const executeShellCommand = async (command, code, language, filename, stdin = '') => {
  try {
    const response = await axios.post(SHELL_API, { command, code, language, filename, stdin });
    return response.data;
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error.response?.data?.stderr || `Connection error: Is the compiler running on port 5000?`,
      exitCode: 1
    };
  }
};

export const sendShellInput = async (input) => {
  try {
    const response = await axios.post(`${SHELL_API}/stdin`, { input });
    return response.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};
