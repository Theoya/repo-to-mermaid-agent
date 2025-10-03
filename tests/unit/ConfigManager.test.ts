import { ConfigManager } from '../../src/ConfigManager';
import { CLIArgs } from '../../src/types';
import * as fs from 'fs-extra';
import * as yaml from 'yaml';

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock yaml
jest.mock('yaml');
const mockedYaml = yaml as jest.Mocked<typeof yaml>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager('test-config.yml');
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load default config when no file exists', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      const args: CLIArgs = {
        tokenLimit: 8000,
        fileTypes: [],
        outputPath: 'repo.mermaid',
        recursive: true,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        dryRun: false,
        verbose: false
      };

      const config = await configManager.loadConfig(args);

      expect(config.llm.provider).toBe('openai');
      expect(config.llm.model).toBe('gpt-4');
      expect(config.llm.max_tokens).toBe(8000);
      expect(config.output.file_path).toBe('repo.mermaid');
    });

    it('should load config from file when it exists', async () => {
      const fileConfig = {
        file_types: ['.js', '.ts'],
        llm: {
          provider: 'claude',
          model: 'claude-3-sonnet'
        }
      };

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue('yaml content');
      mockedYaml.parse.mockReturnValue(fileConfig);

      const args: CLIArgs = {
        tokenLimit: 8000,
        fileTypes: [],
        outputPath: 'repo.mermaid',
        recursive: true,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        dryRun: false,
        verbose: false
      };

      const config = await configManager.loadConfig(args);

      expect(config.file_types).toEqual(['.js', '.ts']);
      expect(config.llm.provider).toBe('claude');
      expect(config.llm.model).toBe('claude-3-sonnet');
    });

    it('should override file config with CLI args', async () => {
      const fileConfig = {
        llm: {
          provider: 'claude',
          model: 'claude-3-sonnet'
        }
      };

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue('yaml content');
      mockedYaml.parse.mockReturnValue(fileConfig);

      const args: CLIArgs = {
        tokenLimit: 4000,
        fileTypes: ['.py', '.java'],
        outputPath: 'custom.mermaid',
        recursive: true,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        dryRun: false,
        verbose: false
      };

      const config = await configManager.loadConfig(args);

      expect(config.llm.provider).toBe('openai'); // Overridden by CLI
      expect(config.llm.model).toBe('gpt-4'); // Overridden by CLI
      expect(config.llm.max_tokens).toBe(4000); // Overridden by CLI
      expect(config.file_types).toEqual(['.py', '.java']); // Overridden by CLI
      expect(config.output.file_path).toBe('custom.mermaid'); // Overridden by CLI
    });

    it('should handle file reading errors gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockRejectedValue(new Error('File read error'));

      const args: CLIArgs = {
        tokenLimit: 8000,
        fileTypes: [],
        outputPath: 'repo.mermaid',
        recursive: true,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        dryRun: false,
        verbose: false
      };

      const config = await configManager.loadConfig(args);

      // Should fall back to default config
      expect(config.llm.provider).toBe('openai');
      expect(config.llm.model).toBe('gpt-4');
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const config = {
        file_types: ['.js', '.ts'],
        exclude_patterns: ['node_modules'],
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

      mockedYaml.stringify.mockReturnValue('yaml content');

      await configManager.saveConfig(config as any);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        'test-config.yml',
        'yaml content',
        'utf-8'
      );
    });

    it('should handle save errors', async () => {
      mockedFs.writeFile.mockRejectedValue(new Error('Write error'));

      const config = {
        file_types: ['.js'],
        exclude_patterns: [],
        llm: { provider: 'openai', model: 'gpt-4', max_tokens: 8000, temperature: 0.1 },
        output: { format: 'mermaid', file_path: 'repo.mermaid', include_summary: true },
        github: { branch: 'mermaid-update', commit_message: 'Update', pr_title: 'Update', pr_body: 'Update' }
      };

      await expect(configManager.saveConfig(config as any))
        .rejects.toThrow('Failed to save config file: Error: Write error');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        file_types: ['.js', '.ts'],
        exclude_patterns: ['node_modules'],
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

      const result = configManager.validateConfig(config as any);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing file types', () => {
      const config = {
        file_types: [],
        exclude_patterns: [],
        llm: { provider: 'openai', model: 'gpt-4', max_tokens: 8000, temperature: 0.1 },
        output: { format: 'mermaid', file_path: 'repo.mermaid', include_summary: true },
        github: { branch: 'mermaid-update', commit_message: 'Update', pr_title: 'Update', pr_body: 'Update' }
      };

      const result = configManager.validateConfig(config as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No file types specified');
    });

    it('should detect missing LLM provider', () => {
      const config = {
        file_types: ['.js'],
        exclude_patterns: [],
        llm: { provider: '', model: 'gpt-4', max_tokens: 8000, temperature: 0.1 },
        output: { format: 'mermaid', file_path: 'repo.mermaid', include_summary: true },
        github: { branch: 'mermaid-update', commit_message: 'Update', pr_title: 'Update', pr_body: 'Update' }
      };

      const result = configManager.validateConfig(config as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('LLM provider not specified');
    });

    it('should detect invalid max_tokens', () => {
      const config = {
        file_types: ['.js'],
        exclude_patterns: [],
        llm: { provider: 'openai', model: 'gpt-4', max_tokens: 0, temperature: 0.1 },
        output: { format: 'mermaid', file_path: 'repo.mermaid', include_summary: true },
        github: { branch: 'mermaid-update', commit_message: 'Update', pr_title: 'Update', pr_body: 'Update' }
      };

      const result = configManager.validateConfig(config as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid max_tokens value');
    });

    it('should detect invalid temperature', () => {
      const config = {
        file_types: ['.js'],
        exclude_patterns: [],
        llm: { provider: 'openai', model: 'gpt-4', max_tokens: 8000, temperature: 3.0 },
        output: { format: 'mermaid', file_path: 'repo.mermaid', include_summary: true },
        github: { branch: 'mermaid-update', commit_message: 'Update', pr_title: 'Update', pr_body: 'Update' }
      };

      const result = configManager.validateConfig(config as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Temperature must be between 0 and 2');
    });
  });

  describe('getSupportedFileTypes', () => {
    it('should return supported file types', () => {
      const fileTypes = configManager.getSupportedFileTypes();

      expect(fileTypes).toContain('.js');
      expect(fileTypes).toContain('.ts');
      expect(fileTypes).toContain('.py');
      expect(fileTypes).toContain('.cs');
      expect(fileTypes).toContain('.java');
      expect(fileTypes.length).toBeGreaterThan(20);
    });
  });

  describe('getSupportedProviders', () => {
    it('should return supported providers', () => {
      const providers = configManager.getSupportedProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
      expect(providers).toContain('grok');
    });
  });

  describe('getDefaultModels', () => {
    it('should return default models for each provider', () => {
      const defaultModels = configManager.getDefaultModels();

      expect(defaultModels.openai).toBe('gpt-4');
      expect(defaultModels.claude).toBe('claude-3-sonnet-20240229');
      expect(defaultModels.grok).toBe('grok-beta');
    });
  });

  describe('createSampleConfig', () => {
    it('should create sample config file', async () => {
      mockedYaml.stringify.mockReturnValue('sample yaml content');

      await configManager.createSampleConfig();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        'test-config.yml',
        'sample yaml content',
        'utf-8'
      );
    });
  });

  describe('getConfigPath and setConfigPath', () => {
    it('should get and set config path', () => {
      expect(configManager.getConfigPath()).toBe('test-config.yml');

      configManager.setConfigPath('new-config.yml');
      expect(configManager.getConfigPath()).toBe('new-config.yml');
    });
  });
});
