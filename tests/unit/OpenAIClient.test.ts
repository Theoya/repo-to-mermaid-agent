import { OpenAIClient } from '../../src/llm/OpenAIClient';
import { FileInfo, ProcessingBucket } from '../../src/types';

// Mock OpenAI
const mockCreate = jest.fn();
const mockResponsesCreate = jest.fn();
const mockList = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      },
      responses: {
        create: mockResponsesCreate
      },
      models: {
        list: mockList
      }
    }))
  };
});

describe('OpenAIClient', () => {
  let openAIClient: OpenAIClient;
  let mockFiles: FileInfo[];
  let mockBucket: ProcessingBucket;

  beforeEach(() => {
    // Set up mock responses
    const mockResponse = {
      choices: [{
        message: {
          content: '{"summary": "Test summary", "mermaid_content": "graph TD\\nA --> B"}'
        }
      }],
      usage: {
        total_tokens: 150
      }
    };

    mockCreate.mockResolvedValue(mockResponse);
    mockList.mockResolvedValue({
      data: [{ id: 'gpt-4' }, { id: 'gpt-5' }]
    });

    openAIClient = new OpenAIClient('test-api-key', 'gpt-4', 1000, 0.1);
    
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

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      const client = new OpenAIClient('test-key', 'gpt-3.5-turbo', 2000, 0.5);
      const info = client.getModelInfo();

      expect(info.name).toBe('gpt-3.5-turbo');
      expect(info.maxTokens).toBe(2000);
      expect(info.temperature).toBe(0.5);
      expect(info.provider).toBe('openai');
    });
  });

  describe('processBucket', () => {
    it('should process bucket successfully', async () => {
      const result = await openAIClient.processBucket(mockBucket);

      expect(result.summary).toBe('Test summary');
      expect(result.mermaid_content).toBe('graph TD\nA --> B');
      expect(result.tokens_used).toBe(150);
    });

    it('should handle API errors', async () => {
      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(openAIClient.processBucket(mockBucket))
        .rejects.toThrow('OpenAI API error: API Error');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }],
        usage: {
          total_tokens: 0
        }
      };

      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockResolvedValue(mockResponse);

      await expect(openAIClient.processBucket(mockBucket))
        .rejects.toThrow('No content received from OpenAI');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Generated summary for the code files'
          }
        }]
      };

      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockResolvedValue(mockResponse);

      const result = await openAIClient.generateSummary(mockFiles);

      expect(result).toBe('Generated summary for the code files');
    });

    it('should handle API errors', async () => {
      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(openAIClient.generateSummary(mockFiles))
        .rejects.toThrow('OpenAI API error: API Error');
    });
  });

  describe('generateMermaid', () => {
    it('should generate Mermaid successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'graph TD\nA[Start] --> B[End]'
          }
        }]
      };

      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockResolvedValue(mockResponse);

      const result = await openAIClient.generateMermaid('Test summary', mockFiles);

      expect(result).toBe('graph TD\nA[Start] --> B[End]');
    });

    it('should handle API errors', async () => {
      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(openAIClient.generateMermaid('Test summary', mockFiles))
        .rejects.toThrow('OpenAI API error: API Error');
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-4' },
          { id: 'gpt-3.5-turbo' }
        ]
      };

      const mockList = require('openai').default().models.list;
      mockList.mockResolvedValue(mockResponse);

      const result = await openAIClient.validateConnection();

      expect(result).toBe(true);
    });

    it('should return false for invalid model', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo' }
        ]
      };

      const mockList = require('openai').default().models.list;
      mockList.mockResolvedValue(mockResponse);

      const result = await openAIClient.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false for API errors', async () => {
      const mockList = require('openai').default().models.list;
      mockList.mockRejectedValue(new Error('API Error'));

      const result = await openAIClient.validateConnection();

      expect(result).toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for gpt-4', () => {
      const client = new OpenAIClient('test-key', 'gpt-4');
      const cost = client.estimateCost(1000, 500);

      // gpt-4: input $0.03/1K, output $0.06/1K
      // (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06, 2);
    });

    it('should estimate cost for gpt-3.5-turbo', () => {
      const client = new OpenAIClient('test-key', 'gpt-3.5-turbo');
      const cost = client.estimateCost(1000, 500);

      // gpt-3.5-turbo: input $0.001/1K, output $0.002/1K
      // (1000/1000 * 0.001) + (500/1000 * 0.002) = 0.001 + 0.001 = 0.002
      expect(cost).toBeCloseTo(0.002, 3);
    });

    it('should use default pricing for unknown models', () => {
      const client = new OpenAIClient('test-key', 'unknown-model');
      const cost = client.estimateCost(1000, 500);

      // Should use gpt-4 pricing as default
      expect(cost).toBeCloseTo(0.06, 2);
    });
  });

  describe('getAvailableModels', () => {
    it('should return available GPT models', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-4' },
          { id: 'gpt-4-turbo' },
          { id: 'gpt-3.5-turbo' },
          { id: 'text-embedding-ada-002' }
        ]
      };

      const mockList = require('openai').default().models.list;
      mockList.mockResolvedValue(mockResponse);

      const models = await openAIClient.getAvailableModels();

      expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']);
    });

    it('should handle API errors', async () => {
      const mockList = require('openai').default().models.list;
      mockList.mockRejectedValue(new Error('API Error'));

      await expect(openAIClient.getAvailableModels())
        .rejects.toThrow('Failed to fetch available models: API Error');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hello, this is a test message.'
          }
        }]
      };

      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockResolvedValue(mockResponse);

      const result = await openAIClient.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it('should handle connection errors', async () => {
      const mockCreate = require('openai').default().chat.completions.create;
      mockCreate.mockRejectedValue(new Error('Connection failed'));

      const result = await openAIClient.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection failed');
    });
  });
});
