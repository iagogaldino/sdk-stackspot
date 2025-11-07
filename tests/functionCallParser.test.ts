import {
  detectFunctionCalls,
  executeDetectedFunctions,
  formatFunctionResults,
  DetectedFunctionCall,
} from '../src/utils/functionCallParser';

describe('detectFunctionCalls', () => {
  it('detects write_file blocks removing markdown fences', () => {
    const response = `write_file path=generated-page/index.html content=\n\n\`\`\`html\n<html>example</html>\n\`\`\``;

    const calls = detectFunctionCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe('write_file');
    expect(calls[0].arguments).toEqual({
      filePath: 'generated-page/index.html',
      content: '<html>example</html>',
      createDirectories: true,
    });
  });

  it('supports [TOOL:name] JSON payloads', () => {
    const response = '[TOOL:find_file]{"fileName":"index.html"}[/TOOL]';
    const calls = detectFunctionCalls(response);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      functionName: 'find_file',
      arguments: { fileName: 'index.html' },
    });
  });
});

describe('executeDetectedFunctions', () => {
  it('executes functions in order using provided executor', async () => {
    const collected: Array<{ name: string; args: Record<string, unknown> }> = [];
    const calls: DetectedFunctionCall[] = [
      {
        functionName: 'write_file',
        arguments: { filePath: 'a', content: 'b' },
        confidence: 0.8,
      },
      {
        functionName: 'execute_command',
        arguments: { command: 'start' },
        confidence: 0.8,
      },
    ];

    const results = await executeDetectedFunctions(calls, async (name, args) => {
      collected.push({ name, args });
      return name === 'write_file' ? 'Arquivo salvo' : 'Erro: comando inválido';
    });

    expect(collected).toEqual([
      { name: 'write_file', args: { filePath: 'a', content: 'b' } },
      { name: 'execute_command', args: { command: 'start' } },
    ]);

    expect(results).toEqual([
      { functionName: 'write_file', result: 'Arquivo salvo', success: true },
      { functionName: 'execute_command', result: 'Erro: comando inválido', success: false },
    ]);
  });
});

describe('formatFunctionResults', () => {
  it('formats human-readable output and truncates large responses', () => {
    const longText = 'a'.repeat(1200);
    const formatted = formatFunctionResults([
      { functionName: 'write_file', result: 'OK', success: true },
      { functionName: 'execute_command', result: longText, success: false },
    ]);

    expect(formatted).toContain('✅ write_file');
    expect(formatted).toContain('❌ execute_command');
    expect(formatted).toContain('[Resultado truncado]');
  });
});

