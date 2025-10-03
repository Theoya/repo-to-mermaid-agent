import { LLMInterface } from '../../src/llm/LLMInterface';
import { FileInfo, ProcessingBucket, LLMResponse } from '../../src/types';

// Mock implementation for testing
class MockLLMClient extends LLMInterface {
  protected getProviderName(): string {
    return 'mock';
  }

  async processBucket(
    bucket: ProcessingBucket,
    previousSummary?: string,
    previousMermaid?: string
  ): Promise<LLMResponse> {
    return {
      summary: `Mock summary for ${bucket.files.length} files`,
      mermaid_content: 'graph TD\nA[Test] --> B[Result]',
      tokens_used: 100
    };
  }

  async generateSummary(files: FileInfo[], previousSummary?: string): Promise<string> {
    return `Mock summary for ${files.length} files`;
  }

  async generateMermaid(
    summary: string,
    files: FileInfo[],
    previousMermaid?: string
  ): Promise<string> {
    return 'graph TD\nA[Test] --> B[Result]';
  }

  async validateConnection(): Promise<boolean> {
    return true;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens + outputTokens) * 0.001;
  }
}

describe('LLMInterface', () => {
  let mockLLM: MockLLMClient;
  let mockFiles: FileInfo[];
  let mockBucket: ProcessingBucket;

  beforeEach(() => {
    mockLLM = new MockLLMClient('test-key', 'test-model', 1000, 0.1);
    
    mockFiles = [
      {
        path: 'test.js',
        content: 'console.log("test");',
        size: 100,
        extension: '.js',
        estimated_tokens: 10
      }
    ];

    mockBucket = {
      files: mockFiles,
      total_tokens: 10
    };
  });

  describe('getModelInfo', () => {
    it('should return correct model information', () => {
      const info = mockLLM.getModelInfo();

      expect(info.name).toBe('test-model');
      expect(info.maxTokens).toBe(1000);
      expect(info.temperature).toBe(0.1);
      expect(info.provider).toBe('mock');
    });
  });

  describe('processBucket', () => {
    it('should process bucket and return response', async () => {
      const response = await mockLLM.processBucket(mockBucket);

      expect(response.summary).toContain('Mock summary');
      expect(response.mermaid_content).toContain('graph TD');
      expect(response.tokens_used).toBe(100);
    });

    it('should handle previous summary and mermaid', async () => {
      const response = await mockLLM.processBucket(
        mockBucket,
        'Previous summary',
        'Previous mermaid'
      );

      expect(response.summary).toContain('Mock summary');
      expect(response.mermaid_content).toContain('graph TD');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary from files', async () => {
      const summary = await mockLLM.generateSummary(mockFiles);

      expect(summary).toContain('Mock summary');
      expect(summary).toContain('1 files');
    });

    it('should handle previous summary', async () => {
      const summary = await mockLLM.generateSummary(mockFiles, 'Previous summary');

      expect(summary).toContain('Mock summary');
    });
  });

  describe('generateMermaid', () => {
    it('should generate Mermaid from summary and files', async () => {
      const mermaid = await mockLLM.generateMermaid('Test summary', mockFiles);

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('A[Test]');
    });

    it('should handle previous Mermaid', async () => {
      const mermaid = await mockLLM.generateMermaid(
        'Test summary',
        mockFiles,
        'Previous mermaid'
      );

      expect(mermaid).toContain('graph TD');
    });
  });

  describe('validateConnection', () => {
    it('should validate connection', async () => {
      const isValid = await mockLLM.validateConnection();
      expect(isValid).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost correctly', () => {
      const cost = mockLLM.estimateCost(100, 50);
      expect(cost).toBe(0.15); // (100 + 50) * 0.001
    });
  });

  describe('createSystemPrompt', () => {
    it('should create system prompt', () => {
      const prompt = (mockLLM as any).createSystemPrompt();
      
      expect(prompt).toContain('expert software architect');
      expect(prompt).toContain('Mermaid diagrams');
      expect(prompt).toContain('architectural patterns');
    });
  });

  describe('createUserPrompt', () => {
    it('should create user prompt with files', () => {
      const prompt = (mockLLM as any).createUserPrompt(mockFiles);
      
      expect(prompt).toContain('test.js');
      expect(prompt).toContain('console.log');
      expect(prompt).toContain('JSON');
    });

    it('should include previous context when provided', () => {
      const prompt = (mockLLM as any).createUserPrompt(
        mockFiles,
        'Previous summary',
        'Previous mermaid'
      );
      
      expect(prompt).toContain('Previous context');
      expect(prompt).toContain('Previous summary');
      expect(prompt).toContain('Previous mermaid');
    });
  });

  describe('getLanguageFromExtension', () => {
    it('should return correct language for known extensions', () => {
      const getLanguage = (mockLLM as any).getLanguageFromExtension;
      
      expect(getLanguage('.js')).toBe('javascript');
      expect(getLanguage('.ts')).toBe('typescript');
      expect(getLanguage('.py')).toBe('python');
      expect(getLanguage('.cs')).toBe('csharp');
      expect(getLanguage('.java')).toBe('java');
    });

    it('should return text for unknown extensions', () => {
      const getLanguage = (mockLLM as any).getLanguageFromExtension;
      
      expect(getLanguage('.unknown')).toBe('text');
    });
  });

  describe('parseResponse', () => {
    it('should parse JSON response', () => {
      const jsonResponse = '{"summary": "Test summary", "mermaid_content": "graph TD"}';
      const parsed = (mockLLM as any).parseResponse(jsonResponse);
      
      expect(parsed.summary).toBe('Test summary');
      expect(parsed.mermaid_content).toBe('graph TD');
    });

    it('should handle non-JSON response', () => {
      const textResponse = 'Summary: Test summary\nMermaid: graph TD';
      const parsed = (mockLLM as any).parseResponse(textResponse);
      
      expect(parsed.summary).toContain('Test summary');
      expect(parsed.mermaid_content).toContain('graph TD');
    });
  });

  describe('cleanMermaidContent', () => {
    it('should clean Mermaid content', () => {
      const dirtyContent = '```mermaid\ngraph TD\nA --> B\n```';
      const cleaned = (mockLLM as any).cleanMermaidContent(dirtyContent);
      
      expect(cleaned).toBe('graph TD\nA --> B');
    });

    it('should add flowchart prefix if needed', () => {
      const content = 'A --> B';
      const cleaned = (mockLLM as any).cleanMermaidContent(content);
      
      expect(cleaned).toContain('flowchart TD');
    });

    it('should preserve valid diagram types', () => {
      const content = 'classDiagram\nclass A';
      const cleaned = (mockLLM as any).cleanMermaidContent(content);
      
      expect(cleaned).toBe('classDiagram\nclass A');
    });
  });
});
