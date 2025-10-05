import * as fs from 'fs-extra';
// import * as path from 'path';
import * as yaml from 'yaml';
import { Config, CLIArgs } from './types';

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor(configPath: string = 'mermaid_generator_config.yaml') {
    this.configPath = configPath;
    this.config = this.getDefaultConfig();
  }

  /**
   * Load configuration from file and CLI arguments
   */
  async loadConfig(args: CLIArgs): Promise<Config> {
    // Load from file if it exists
    if (await fs.pathExists(this.configPath)) {
      try {
        const fileContent = await fs.readFile(this.configPath, 'utf-8');
        const fileConfig = yaml.parse(fileContent);
        this.config = this.mergeConfigs(this.config, fileConfig);
      } catch (error) {
        console.warn(`Warning: Could not load config file ${this.configPath}: ${error}`);
      }
    }

    // Override with CLI arguments
    this.config = this.mergeWithCLIArgs(this.config, args);

    return this.config;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): Config {
    return {
      file_types: [
        '.cs', '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
        '.cpp', '.h', '.hpp', '.c', '.php', '.rb', '.swift', '.kt', '.scala',
        '.clj', '.hs', '.ml', '.fs', '.vb', '.sql', '.sh', '.ps1', '.bat',
        '.yaml', '.yml', '.json', '.xml', '.html', '.css', '.scss', '.less',
        '.vue', '.svelte', '.astro'
      ],
      exclude_patterns: [
        'node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj',
        '.next', '.nuxt', '.cache', '.parcel-cache', 'coverage', '.nyc_output',
        '.vscode', '.idea', '*.log', '*.tmp', '*.temp'
      ],
        llm: {
          provider: 'openai',
          model: 'gpt-5',
          max_tokens: 100000, // Optimized for GPT-5's context window
          temperature: 0.1,
          additional_instructions: '' // Additional context/instructions for the LLM
        },
      output: {
        format: 'mermaid',
        file_path: 'repo.mermaid',
        include_summary: false
      },
      colors: {
        tests: '#e17055',        // Orange for tests and testing suites
        config: '#fdcb6e',       // Yellow for configuration files and tools
        core: '#0984e3',         // Blue for core functionality or business logic
        llm: '#55efc4',          // Green for LLM related stuff
        output: '#6c5ce7'        // Purple for output stuff
      },
      github: {
        branch: 'mermaid-update',
        commit_message: 'Update Mermaid diagram',
        pr_title: 'Update repository architecture diagram',
        pr_body: 'Automatically generated Mermaid diagram of the codebase architecture'
      }
    };
  }

  /**
   * Merge two configurations
   */
  private mergeConfigs(defaultConfig: Config, fileConfig: any): Config {
    return {
      file_types: fileConfig.file_types || defaultConfig.file_types,
      exclude_patterns: fileConfig.exclude_patterns || defaultConfig.exclude_patterns,
      llm: {
        provider: fileConfig.llm?.provider || defaultConfig.llm.provider,
        model: fileConfig.llm?.model || defaultConfig.llm.model,
        max_tokens: fileConfig.llm?.max_tokens || defaultConfig.llm.max_tokens,
        temperature: fileConfig.llm?.temperature || defaultConfig.llm.temperature,
        additional_instructions: fileConfig.llm?.additional_instructions || defaultConfig.llm.additional_instructions
      },
      output: {
        format: fileConfig.output?.format || defaultConfig.output.format,
        file_path: fileConfig.output?.file_path || defaultConfig.output.file_path,
        include_summary: fileConfig.output?.include_summary !== undefined 
          ? fileConfig.output.include_summary 
          : defaultConfig.output.include_summary
      },
      colors: {
        tests: fileConfig.colors?.tests || defaultConfig.colors.tests,
        config: fileConfig.colors?.config || defaultConfig.colors.config,
        core: fileConfig.colors?.core || defaultConfig.colors.core,
        llm: fileConfig.colors?.llm || defaultConfig.colors.llm,
        output: fileConfig.colors?.output || defaultConfig.colors.output
      },
      github: {
        branch: fileConfig.github?.branch || defaultConfig.github.branch,
        commit_message: fileConfig.github?.commit_message || defaultConfig.github.commit_message,
        pr_title: fileConfig.github?.pr_title || defaultConfig.github.pr_title,
        pr_body: fileConfig.github?.pr_body || defaultConfig.github.pr_body
      }
    };
  }

  /**
   * Merge configuration with CLI arguments
   */
  private mergeWithCLIArgs(config: Config, args: CLIArgs): Config {
    return {
      file_types: args.fileTypes.length > 0 ? args.fileTypes : config.file_types,
      exclude_patterns: config.exclude_patterns,
      llm: {
        provider: args.llmProvider || config.llm.provider,
        model: args.llmModel || config.llm.model,
        max_tokens: args.tokenLimit || config.llm.max_tokens,
        temperature: config.llm.temperature,
        additional_instructions: config.llm.additional_instructions
      },
      output: {
        format: config.output.format,
        file_path: args.outputPath || config.output.file_path,
        include_summary: config.output.include_summary
      },
      colors: config.colors,
      github: {
        branch: args.githubBranch || config.github.branch,
        commit_message: config.github.commit_message,
        pr_title: config.github.pr_title,
        pr_body: config.github.pr_body
      }
    };
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: Config): Promise<void> {
    try {
      const yamlContent = yaml.stringify(config, { indent: 2 });
      await fs.writeFile(this.configPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save config file: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<Config>): void {
    this.config = {
      ...this.config,
      ...updates,
      llm: { ...this.config.llm, ...updates.llm },
      output: { ...this.config.output, ...updates.output },
      github: { ...this.config.github, ...updates.github }
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Config): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.file_types || config.file_types.length === 0) {
      errors.push('No file types specified');
    }

    if (!config.llm.provider) {
      errors.push('LLM provider not specified');
    }

    if (!config.llm.model) {
      errors.push('LLM model not specified');
    }

    if (config.llm.max_tokens <= 0) {
      errors.push('Invalid max_tokens value');
    }

    if (config.llm.temperature < 0 || config.llm.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (!config.output.file_path) {
      errors.push('Output file path not specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [
      '.cs', '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
      '.cpp', '.h', '.hpp', '.c', '.php', '.rb', '.swift', '.kt', '.scala',
      '.clj', '.hs', '.ml', '.fs', '.vb', '.sql', '.sh', '.ps1', '.bat',
      '.yaml', '.yml', '.json', '.xml', '.html', '.css', '.scss', '.less',
      '.vue', '.svelte', '.astro', '.dart', '.r', '.m', '.mm', '.pl', '.pm',
      '.lua', '.tcl', '.vim', '.el', '.ex', '.exs', '.erl', '.hrl', '.jl'
    ];
  }

  /**
   * Get supported LLM providers
   */
  getSupportedProviders(): string[] {
    return ['openai', 'claude', 'grok'];
  }

  /**
   * Get default models for each provider
   */
  getDefaultModels(): Record<string, string> {
    return {
      openai: 'gpt-4',
      claude: 'claude-3-sonnet-20240229',
      grok: 'grok-beta'
    };
  }

  /**
   * Create sample configuration file
   */
  async createSampleConfig(): Promise<void> {
    const sampleConfig = this.getDefaultConfig();
    await this.saveConfig(sampleConfig);
    console.log(`Sample configuration created at ${this.configPath}`);
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Set configuration file path
   */
  setConfigPath(path: string): void {
    this.configPath = path;
  }
}
