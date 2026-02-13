import axios from 'axios';

const COMPILER_API = 'http://localhost:5000/api/execute';

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
