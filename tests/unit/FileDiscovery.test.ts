import { FileDiscovery } from '../../src/core/FileDiscovery';
import { Config } from '../../src/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock glob
jest.mock('glob');
const mockGlob = require('glob').glob as jest.MockedFunction<typeof import('glob').glob>;

describe('FileDiscovery', () => {
  let config: Config;
  let fileDiscovery: FileDiscovery;

  beforeEach(() => {
    config = {
      file_types: ['.js', '.ts', '.py'],
      exclude_patterns: ['node_modules', '.git'],
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        max_tokens: 8000,
        temperature: 0.1
      },
      output: {
        format: 'mermaid',
        file_path: 'repo.mermaid',
        include_summary: true
      },
      github: {
        branch: 'mermaid-update',
        commit_message: 'Update Mermaid diagram',
        pr_title: 'Update repository architecture diagram',
        pr_body: 'Automatically generated Mermaid diagram'
      }
    };

    fileDiscovery = new FileDiscovery(config);
    jest.clearAllMocks();
  });

  describe('discoverFiles', () => {
    it('should load specific files when provided', async () => {
      const specificFiles = ['file1.js', 'file2.ts'];
      const mockContent1 = 'console.log("test1");';
      const mockContent2 = 'const test = "test2";';

      mockedFs.stat.mockResolvedValueOnce({ size: 100 } as any);
      mockedFs.readFile.mockResolvedValueOnce(mockContent1);
      mockedFs.stat.mockResolvedValueOnce({ size: 200 } as any);
      mockedFs.readFile.mockResolvedValueOnce(mockContent2);

      const result = await fileDiscovery.discoverFiles('.', specificFiles);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('file1.js');
      expect(result[0].content).toBe(mockContent1);
      expect(result[0].extension).toBe('.js');
      expect(result[1].path).toBe('file2.ts');
      expect(result[1].content).toBe(mockContent2);
      expect(result[1].extension).toBe('.ts');
    });

    it('should discover files recursively using glob', async () => {
      const mockFiles = ['src/file1.js', 'src/file2.ts', 'test/file3.py'];
      mockGlob.mockResolvedValue(mockFiles);

      mockedFs.stat.mockResolvedValue({ size: 100 } as any);
      mockedFs.readFile.mockResolvedValue('test content');

      const result = await fileDiscovery.discoverFiles('.', undefined, true);

      expect(result).toHaveLength(3);
      expect(mockGlob).toHaveBeenCalledTimes(3); // Once for each file type
    });

    it('should discover files in single directory when not recursive', async () => {
      const mockEntries = [
        { name: 'file1.js', isFile: () => true },
        { name: 'file2.ts', isFile: () => true },
        { name: 'subdir', isFile: () => false }
      ];

      mockedFs.readdir.mockResolvedValue(mockEntries as any);
      mockedFs.stat.mockResolvedValue({ size: 100 } as any);
      mockedFs.readFile.mockResolvedValue('test content');

      const result = await fileDiscovery.discoverFiles('.', undefined, false);

      expect(result).toHaveLength(2);
      expect(mockedFs.readdir).toHaveBeenCalledWith('.', { withFileTypes: true });
    });

    it('should handle file reading errors gracefully', async () => {
      const specificFiles = ['file1.js', 'file2.js'];
      
      mockedFs.stat.mockRejectedValueOnce(new Error('File not found'));
      mockedFs.stat.mockResolvedValueOnce({ size: 100 } as any);
      mockedFs.readFile.mockResolvedValueOnce('test content');

      const result = await fileDiscovery.discoverFiles('.', specificFiles);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('file2.js');
    });
  });

  describe('filterBySize', () => {
    it('should filter files by size', () => {
      const files = [
        { path: 'file1.js', content: 'test', size: 100, extension: '.js', estimated_tokens: 1 },
        { path: 'file2.js', content: 'test', size: 200, extension: '.js', estimated_tokens: 1 },
        { path: 'file3.js', content: 'test', size: 300, extension: '.js', estimated_tokens: 1 }
      ];

      const result = fileDiscovery.filterBySize(files, 200);

      expect(result).toHaveLength(2);
      expect(result[0].size).toBeLessThanOrEqual(200);
      expect(result[1].size).toBeLessThanOrEqual(200);
    });
  });

  describe('sortBySize', () => {
    it('should sort files by size (largest first)', () => {
      const files = [
        { path: 'file1.js', content: 'test', size: 100, extension: '.js', estimated_tokens: 1 },
        { path: 'file2.js', content: 'test', size: 300, extension: '.js', estimated_tokens: 1 },
        { path: 'file3.js', content: 'test', size: 200, extension: '.js', estimated_tokens: 1 }
      ];

      const result = fileDiscovery.sortBySize(files);

      expect(result[0].size).toBe(300);
      expect(result[1].size).toBe(200);
      expect(result[2].size).toBe(100);
    });
  });

  describe('sortByTokens', () => {
    it('should sort files by token count (largest first)', () => {
      const files = [
        { path: 'file1.js', content: 'test', size: 100, extension: '.js', estimated_tokens: 1 },
        { path: 'file2.js', content: 'test', size: 200, extension: '.js', estimated_tokens: 3 },
        { path: 'file3.js', content: 'test', size: 300, extension: '.js', estimated_tokens: 2 }
      ];

      const result = fileDiscovery.sortByTokens(files);

      expect(result[0].estimated_tokens).toBe(3);
      expect(result[1].estimated_tokens).toBe(2);
      expect(result[2].estimated_tokens).toBe(1);
    });
  });
});
