import { TokenCalculator } from '../../src/core/TokenCalculator';
import { FileInfo } from '../../src/types';

describe('TokenCalculator', () => {
  let tokenCalculator: TokenCalculator;

  beforeEach(() => {
    tokenCalculator = new TokenCalculator();
  });

  describe('calculateFileTokens', () => {
    it('should calculate tokens for a file', () => {
      const file: FileInfo = {
        path: 'test.js',
        content: 'console.log("Hello, world!");',
        size: 100,
        extension: '.js',
        estimated_tokens: 0
      };

      const tokens = tokenCalculator.calculateFileTokens(file);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty files', () => {
      const file: FileInfo = {
        path: 'empty.js',
        content: '',
        size: 0,
        extension: '.js',
        estimated_tokens: 0
      };

      const tokens = tokenCalculator.calculateFileTokens(file);
      expect(tokens).toBe(1); // Minimum 1 token
    });
  });

  describe('calculateTotalTokens', () => {
    it('should calculate total tokens for multiple files', () => {
      const files: FileInfo[] = [
        {
          path: 'file1.js',
          content: 'console.log("test1");',
          size: 100,
          extension: '.js',
          estimated_tokens: 0
        },
        {
          path: 'file2.js',
          content: 'console.log("test2");',
          size: 100,
          extension: '.js',
          estimated_tokens: 0
        }
      ];

      const totalTokens = tokenCalculator.calculateTotalTokens(files);
      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should return 0 for empty file array', () => {
      const totalTokens = tokenCalculator.calculateTotalTokens([]);
      expect(totalTokens).toBe(0);
    });
  });

  describe('calculatePromptTokens', () => {
    it('should calculate tokens for a prompt template', () => {
      const template = 'Analyze this code: {code}';
      const variables = { code: 'console.log("test");' };

      const tokens = tokenCalculator.calculatePromptTokens(template, variables);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle template without variables', () => {
      const template = 'Simple prompt without variables';
      const variables = {};

      const tokens = tokenCalculator.calculatePromptTokens(template, variables);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('calculateMessageTokens', () => {
    it('should calculate tokens for system and user messages', () => {
      const systemMessage = 'You are a helpful assistant.';
      const userMessage = 'Please analyze this code.';

      const tokens = tokenCalculator.calculateMessageTokens(systemMessage, userMessage);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('getTokenDensity', () => {
    it('should return correct density for known file types', () => {
      expect(tokenCalculator.getTokenDensity('.py')).toBe(3.5);
      expect(tokenCalculator.getTokenDensity('.js')).toBe(4.0);
      expect(tokenCalculator.getTokenDensity('.ts')).toBe(4.0);
      expect(tokenCalculator.getTokenDensity('.cs')).toBe(3.8);
      expect(tokenCalculator.getTokenDensity('.java')).toBe(3.8);
    });

    it('should return default density for unknown file types', () => {
      expect(tokenCalculator.getTokenDensity('.unknown')).toBe(4.0);
    });
  });

  describe('recalculateFileTokens', () => {
    it('should recalculate tokens with adjusted density', () => {
      const file: FileInfo = {
        path: 'test.py',
        content: 'print("Hello, world!")',
        size: 100,
        extension: '.py',
        estimated_tokens: 10
      };

      const recalculated = tokenCalculator.recalculateFileTokens(file);
      expect(recalculated.estimated_tokens).toBeGreaterThan(0);
      expect(recalculated.estimated_tokens).toBeGreaterThanOrEqual(file.estimated_tokens);
    });
  });
});
