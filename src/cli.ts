#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
// import * as path from 'path';
import { ConfigManager } from './ConfigManager';
import { FileDiscovery } from './core/FileDiscovery';
import { BucketManager } from './core/BucketManager';
import { OpenAIClient } from './llm/OpenAIClient';
import { MermaidGenerator } from './output/MermaidGenerator';
import { StateManager } from './output/StateManager';
import { CLIArgs } from './types';

const program = new Command();

program
  .name('mermaid-gen')
  .description('Generate Mermaid diagrams from codebases using LLMs')
  .version('1.0.0');

program
  .option('-t, --token-limit <number>', 'Token limit per processing batch', '400000') // Updated default to match GPT-5's context window
  .option('-f, --file-types <types>', 'Comma-separated list of file extensions', '')
  .option('-o, --output <path>', 'Output file path', 'repo.mermaid')
  .option('-c, --config <path>', 'Configuration file path', 'config.yml')
  .option('-r, --recursive', 'Process files recursively', true)
  .option('-s, --specific-files <files>', 'Comma-separated list of specific files to process', '')
  .option('-e, --existing-mermaid <path>', 'Path to existing Mermaid file to build upon', '')
  .option('-p, --llm-provider <provider>', 'LLM provider (openai, claude, grok)', 'openai')
  .option('-m, --llm-model <model>', 'LLM model to use', 'gpt-5')
  .option('-k, --llm-api-key <key>', 'LLM API key (or set via environment variable)', '')
  .option('-g, --github-token <token>', 'GitHub token for PR creation (or set via GITHUB_TOKEN)', '')
  .option('-O, --github-owner <owner>', 'GitHub repository owner', '')
  .option('-R, --github-repo <repo>', 'GitHub repository name', '')
  .option('-b, --github-branch <branch>', 'GitHub branch for PR', 'mermaid-update')
  .option('-d, --dry-run', 'Run without making changes', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .argument('[directory]', 'Directory to process (default: current directory)', '.')
  .action(async (directory: string, options: any) => {
    try {
      await runMermaidGenerator(directory, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

async function runMermaidGenerator(directory: string, options: any): Promise<void> {
  const spinner = ora('Initializing Mermaid generator...').start();

  try {
    // Parse CLI arguments
    const args: CLIArgs = {
      tokenLimit: parseInt(options.tokenLimit) || 400000, // Updated default to match GPT-5's context window
      fileTypes: options.fileTypes ? options.fileTypes.split(',').map((t: string) => t.trim()) : [],
      outputPath: options.output,
      configPath: options.config,
      recursive: options.recursive,
      specificFiles: options.specificFiles ? options.specificFiles.split(',').map((f: string) => f.trim()) : undefined,
      existingMermaid: options.existingMermaid,
      llmProvider: options.llmProvider,
      llmModel: options.llmModel,
      llmApiKey: options.llmApiKey || process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'],
      githubToken: options.githubToken || process.env['GITHUB_TOKEN'],
      githubOwner: options.githubOwner || process.env['GITHUB_OWNER'],
      githubRepo: options.githubRepo || process.env['GITHUB_REPO'],
      githubBranch: options.githubBranch,
      dryRun: options.dryRun,
      verbose: options.verbose
    };

    if (!args.llmApiKey) {
      throw new Error('LLM API key is required. Set via --llm-api-key or environment variable.');
    }

    // Load configuration
    spinner.text = 'Loading configuration...';
    const configManager = new ConfigManager(args.configPath);
    const config = await configManager.loadConfig(args);

    // Validate configuration
    const configValidation = configManager.validateConfig(config);
    if (!configValidation.valid) {
      throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
    }

    if (args.verbose) {
      console.log(chalk.blue('Configuration:'), JSON.stringify(config, null, 2));
    }

    // Initialize components
    spinner.text = 'Initializing components...';
    const fileDiscovery = new FileDiscovery(config);
    const bucketManager = new BucketManager(config.llm.max_tokens);
    const llmClient = new OpenAIClient(
      args.llmApiKey,
      config.llm.model,
      config.llm.max_tokens,
      config.llm.temperature
    );
    const mermaidGenerator = new MermaidGenerator(
      llmClient,
      config.output.file_path,
      config.output.include_summary
    );
    const stateManager = new StateManager();

    // Validate LLM connection
    spinner.text = 'Validating LLM connection...';
    const connectionTest = await llmClient.testConnection();
    if (!connectionTest.success) {
      throw new Error(`LLM connection failed: ${connectionTest.message}`);
    }

    // Discover files
    spinner.text = 'Discovering files...';
    const files = await fileDiscovery.discoverFiles(
      directory,
      args.specificFiles,
      args.recursive
    );

    if (files.length === 0) {
      throw new Error('No files found to process');
    }

    console.log(chalk.green(`Found ${files.length} files to process`));

    // Process files and split large ones if needed
    spinner.text = 'Processing files and splitting large ones...';
    const processedFiles = bucketManager.processFilesWithSplitting(files);
    
    // Create buckets
    spinner.text = 'Creating processing buckets...';
    const buckets = bucketManager.createBuckets(processedFiles);
    const stats = bucketManager.getBucketStatistics(buckets);

    console.log(chalk.blue('Bucket Statistics:'));
    console.log(`  Total buckets: ${stats.totalBuckets}`);
    console.log(`  Total files: ${stats.totalFiles}`);
    console.log(`  Total tokens: ${stats.totalTokens}`);
    console.log(`  Average tokens per bucket: ${Math.round(stats.averageTokensPerBucket)}`);
    console.log(`  Utilization rate: ${Math.round(stats.utilizationRate)}%`);

    // Show skipped files information
    const skippedFiles = bucketManager.getSkippedFiles();
    if (skippedFiles.length > 0) {
      console.log(chalk.yellow('\nSkipped Files:'));
      console.log(bucketManager.getSkippedFilesSummary());
    }

    if (args.dryRun) {
      console.log(chalk.yellow('Dry run mode - no changes will be made'));
      return;
    }

    // Load existing Mermaid content if provided
    let existingMermaid = '';
    if (args.existingMermaid) {
      try {
        existingMermaid = await require('fs-extra').readFile(args.existingMermaid, 'utf-8');
        console.log(chalk.blue(`Loaded existing Mermaid content from ${args.existingMermaid}`));
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not load existing Mermaid file: ${error}`));
      }
    }

    // Process buckets
    spinner.text = 'Processing buckets...';
    const state = await mermaidGenerator.processBuckets(buckets, existingMermaid, skippedFiles);

    // Generate final Mermaid file
    spinner.text = 'Generating final Mermaid file...';
    const finalContent = await mermaidGenerator.generateFinalMermaidFile(state, skippedFiles);

    // Save state
    await stateManager.saveState(state);

    spinner.succeed('Mermaid diagram generated successfully!');

    // Display results
    const processingStats = mermaidGenerator.getProcessingStatistics(state);
    console.log(chalk.green('\nProcessing Complete:'));
    console.log(`  Files processed: ${processingStats.processedFiles}/${processingStats.totalFiles}`);
    console.log(`  Completion: ${Math.round(processingStats.completionPercentage)}%`);
    console.log(`  Output file: ${config.output.file_path}`);

    // Validate generated Mermaid
    const mermaidValidation = mermaidGenerator.validateMermaidSyntax(finalContent);
    if (!mermaidValidation.valid) {
      console.warn(chalk.yellow('Warning: Generated Mermaid may have syntax issues:'));
      mermaidValidation.errors.forEach(error => console.warn(`  - ${error}`));
    }

    // GitHub integration (if configured)
    if (args.githubToken && args.githubOwner && args.githubRepo) {
      console.log(chalk.blue('\nGitHub integration would be triggered here...'));
      // TODO: Implement GitHub PR creation
    }

  } catch (error) {
    spinner.fail('Failed to generate Mermaid diagram');
    throw error;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();
