import vm from 'vm';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';

const execPromise = util.promisify(exec);

export interface TestCase {
  input: string;
  expectedOutput: string;
  isPublic?: boolean;
}

export interface TestResult {
  testCaseIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTimeMs: number;
  error?: string;
}

export interface CodeEvaluationResult {
  success: boolean;
  scorePercentage: number;
  passedCount: number;
  totalCount: number;
  testResults: TestResult[];
  compileError?: string;
}

export class CodeExecutionService {
  private judge0Url = process.env.JUDGE0_API_URL || '';
  private judge0Key = process.env.JUDGE0_API_KEY || '';

  // Configurable Judge0 Language IDs
  private languageIds: Record<string, number> = {
    javascript: 63, // Node.js
    python: 71,     // Python 3
    cpp: 54,        // C++ (GCC)
    java: 62,       // Java (OpenJDK)
  };

  async evaluateCode(
    language: 'javascript' | 'python' | 'cpp' | 'java',
    sourceCode: string,
    testCases: TestCase[]
  ): Promise<CodeEvaluationResult> {
    if (!testCases || testCases.length === 0) {
      return {
        success: true,
        scorePercentage: 100,
        passedCount: 0,
        totalCount: 0,
        testResults: [],
      };
    }

    // Strict Production Security Control: Require Judge0 remote isolated sandbox in production
    if (process.env.NODE_ENV === 'production' && !this.judge0Url) {
      throw new Error(
        'PRODUCTION_SANDBOX_REQUIRED: Direct un-sandboxed Node process code execution is prohibited in production. Please configure JUDGE0_API_URL.'
      );
    }

    // Use Remote Judge0 cluster if JUDGE0_API_URL is configured
    if (this.judge0Url) {
      return this.evaluateWithJudge0(language, sourceCode, testCases);
    }

    // Local Development Sandboxed Execution
    const testResults: TestResult[] = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const start = Date.now();

      if (language === 'javascript') {
        const res = this.runJavaScriptSandbox(sourceCode, tc.input);
        const elapsed = Date.now() - start;
        const passed = res.output.trim() === tc.expectedOutput.trim();

        if (passed) passedCount++;

        testResults.push({
          testCaseIndex: i,
          passed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: res.output,
          executionTimeMs: elapsed,
          error: res.error,
        });
      } else if (language === 'python') {
        try {
          const res = await this.runPythonIsolated(sourceCode, tc.input);
          const elapsed = Date.now() - start;
          const passed = res.output.trim() === tc.expectedOutput.trim();

          if (passed) passedCount++;

          testResults.push({
            testCaseIndex: i,
            passed,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: res.output,
            executionTimeMs: elapsed,
            error: res.error,
          });
        } catch (err: any) {
          testResults.push({
            testCaseIndex: i,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: '',
            executionTimeMs: Date.now() - start,
            error: err.message || 'Execution error',
          });
        }
      }
    }

    const scorePercentage = Math.round((passedCount / testCases.length) * 100);

    return {
      success: scorePercentage === 100,
      scorePercentage,
      passedCount,
      totalCount: testCases.length,
      testResults,
    };
  }

  private async evaluateWithJudge0(
    language: string,
    sourceCode: string,
    testCases: TestCase[]
  ): Promise<CodeEvaluationResult> {
    const langId = this.languageIds[language] || 63;
    const testResults: TestResult[] = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const response = await axios.post(
          `${this.judge0Url}/submissions?wait=true`,
          {
            source_code: sourceCode,
            language_id: langId,
            stdin: tc.input,
            expected_output: tc.expectedOutput,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(this.judge0Key ? { 'X-RapidAPI-Key': this.judge0Key } : {}),
            },
            timeout: Number(process.env.JUDGE0_TIMEOUT_MS) || 5000,
          }
        );

        const actualOutput = (response.data.stdout || '').trim();
        const passed = response.data.status?.id === 3 || actualOutput === tc.expectedOutput.trim();

        if (passed) passedCount++;

        testResults.push({
          testCaseIndex: i,
          passed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput,
          executionTimeMs: Math.round(Number(response.data.time || 0) * 1000),
          error: response.data.stderr || response.data.compile_output || undefined,
        });
      } catch (err: any) {
        testResults.push({
          testCaseIndex: i,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          executionTimeMs: 0,
          error: err.message || 'Judge0 Remote execution error',
        });
      }
    }

    const scorePercentage = Math.round((passedCount / testCases.length) * 100);

    return {
      success: scorePercentage === 100,
      scorePercentage,
      passedCount,
      totalCount: testCases.length,
      testResults,
    };
  }

  private runJavaScriptSandbox(code: string, input: string): { output: string; error?: string } {
    let logs: string[] = [];

    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      },
      input: input,
    };

    const context = vm.createContext(sandbox);

    try {
      const script = new vm.Script(code);
      script.runInContext(context, { timeout: 2000 });
      return { output: logs.join('\n') };
    } catch (err: any) {
      return { output: logs.join('\n'), error: err.message };
    }
  }

  private async runPythonIsolated(code: string, input: string): Promise<{ output: string; error?: string }> {
    try {
      const sanitizedCode = code.replace(/"/g, '\\"');
      const { stdout, stderr } = await execPromise(`python -c "${sanitizedCode}"`, { timeout: 2500 });
      return { output: stdout || '', error: stderr || undefined };
    } catch (err: any) {
      return { output: err.stdout || '', error: err.stderr || err.message };
    }
  }
}

export const codeExecutionService = new CodeExecutionService();
