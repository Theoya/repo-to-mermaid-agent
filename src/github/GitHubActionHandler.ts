import { GitHubClient } from './GitHubClient';
import { GitHubConfig, Config } from '../types';
import { FileDiscovery } from '../core/FileDiscovery';
import { BucketManager } from '../core/BucketManager';
import { OpenAIClient } from '../llm/OpenAIClient';
import { MermaidGenerator } from '../output/MermaidGenerator';
import { StateManager } from '../output/StateManager';

export class GitHubActionHandler {
  private githubClient: GitHubClient;
  private config: Config;
  private githubConfig: GitHubConfig;

  constructor(config: Config, githubConfig: GitHubConfig) {
    this.config = config;
    this.githubConfig = githubConfig;
    this.githubClient = new GitHubClient(githubConfig);
  }

  /**
   * Run the complete GitHub Action workflow
   */
  async runWorkflow(
    rootPath: string = '.',
    specificFiles?: string[],
    existingMermaidPath?: string
  ): Promise<{
    success: boolean;
    prUrl?: string;
    prNumber?: number;
    message: string;
  }> {
    try {
      console.log('🚀 Starting GitHub Action workflow...');

      // Test GitHub connection
      const connectionTest = await this.githubClient.testConnection();
      if (!connectionTest.success) {
        throw new Error(`GitHub connection failed: ${connectionTest.message}`);
      }

      // Get repository info
      const repoInfo = await this.githubClient.getRepositoryInfo();
      console.log(`📁 Repository: ${repoInfo.fullName}`);
      console.log(`🌿 Default branch: ${repoInfo.defaultBranch}`);

      // Check if target branch exists
      const branchExists = await this.githubClient.branchExists(this.githubConfig.target_branch);
      if (!branchExists) {
        console.log(`🌿 Creating branch: ${this.githubConfig.target_branch}`);
        await this.githubClient.createBranch(
          this.githubConfig.target_branch,
          this.githubConfig.base_branch
        );
      } else {
        console.log(`🌿 Using existing branch: ${this.githubConfig.target_branch}`);
      }

      // Load existing Mermaid content if it exists
      let existingMermaid = '';
      if (existingMermaidPath) {
        existingMermaid = await this.githubClient.getFileContent(
          existingMermaidPath,
          this.githubConfig.target_branch
        ) || '';
      } else {
        // Try to load from default path
        existingMermaid = await this.githubClient.getFileContent(
          this.config.output.file_path,
          this.githubConfig.target_branch
        ) || '';
      }

      if (existingMermaid) {
        console.log(`📄 Found existing Mermaid file with ${existingMermaid.length} characters`);
      }

      // Process the codebase
      console.log('🔍 Processing codebase...');
      const result = await this.processCodebase(rootPath, specificFiles, existingMermaid);

      // Create or update the Mermaid file
      console.log('📝 Creating/updating Mermaid file...');
      await this.githubClient.createOrUpdateFile(
        this.config.output.file_path,
        result.finalContent,
        this.config.github.commit_message,
        this.githubConfig.target_branch
      );

      // Check if PR already exists
      const existingPR = await this.githubClient.getExistingPullRequest(
        this.githubConfig.target_branch,
        this.githubConfig.base_branch
      );

      let prUrl: string | undefined;
      let prNumber: number | undefined;

      if (existingPR) {
        console.log(`🔄 Updating existing PR: ${existingPR.url}`);
        prUrl = existingPR.url;
        prNumber = existingPR.number;

        // Add a comment about the update
        await this.githubClient.addCommentToPullRequest(
          existingPR.number,
          `🔄 **Mermaid diagram updated**\n\n` +
          `- Files processed: ${result.stats.processedFiles}/${result.stats.totalFiles}\n` +
          `- Completion: ${Math.round(result.stats.completionPercentage)}%\n` +
          `- Generated on: ${new Date().toISOString()}\n\n` +
          `The diagram has been automatically updated with the latest changes.`
        );
      } else {
        console.log('🆕 Creating new pull request...');
        const pr = await this.githubClient.createPullRequest(
          this.config.github.pr_title,
          this.buildPullRequestBody(result),
          this.githubConfig.target_branch,
          this.githubConfig.base_branch
        );

        prUrl = pr.url;
        prNumber = pr.number;

        // Add labels
        await this.githubClient.addLabelsToPullRequest(pr.number, [
          'automated',
          'mermaid',
          'documentation',
          'architecture'
        ]);

        console.log(`✅ Pull request created: ${pr.url}`);
      }

      return {
        success: true,
        prUrl,
        prNumber,
        message: 'GitHub Action workflow completed successfully'
      };

    } catch (error) {
      console.error('❌ GitHub Action workflow failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process the codebase and generate Mermaid diagram
   */
  private async processCodebase(
    rootPath: string,
    specificFiles?: string[],
    existingMermaid: string = ''
  ): Promise<{
    finalContent: string;
    stats: {
      processedFiles: number;
      totalFiles: number;
      completionPercentage: number;
    };
  }> {
    // Initialize components
    const fileDiscovery = new FileDiscovery(this.config);
    const bucketManager = new BucketManager(this.config.llm.max_tokens);
    const llmClient = new OpenAIClient(
      process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || '',
      this.config.llm.model,
      this.config.llm.max_tokens,
      this.config.llm.temperature
    );
    const mermaidGenerator = new MermaidGenerator(
      llmClient,
      this.config.output.file_path,
      this.config.output.include_summary
    );
    // const stateManager = new StateManager();

    // Discover files
    const files = await fileDiscovery.discoverFiles(
      rootPath,
      specificFiles,
      true // recursive
    );

    if (files.length === 0) {
      throw new Error('No files found to process');
    }

    console.log(`📊 Found ${files.length} files to process`);

    // Create buckets
    const buckets = bucketManager.createBuckets(files);
    const bucketStats = bucketManager.getBucketStatistics(buckets);

    console.log(`📦 Created ${bucketStats.totalBuckets} processing buckets`);
    console.log(`🎯 Total estimated tokens: ${bucketStats.totalTokens}`);

    // Process buckets
    const state = await mermaidGenerator.processBuckets(buckets, existingMermaid);

    // Generate final content
    const finalContent = await mermaidGenerator.generateFinalMermaidFile(state);

    // Get processing statistics
    const stats = mermaidGenerator.getProcessingStatistics(state);

    return {
      finalContent,
      stats
    };
  }

  /**
   * Build pull request body
   */
  private buildPullRequestBody(result: {
    stats: {
      processedFiles: number;
      totalFiles: number;
      completionPercentage: number;
    };
  }): string {
    const { stats } = result;

    return `## 📊 Mermaid Architecture Diagram Update

This pull request contains an automatically generated Mermaid diagram representing the current architecture of the codebase.

### 📈 Processing Statistics
- **Files processed**: ${stats.processedFiles}/${stats.totalFiles}
- **Completion**: ${Math.round(stats.completionPercentage)}%
- **Generated on**: ${new Date().toISOString()}

### 🎯 What's Included
- Comprehensive architecture diagram in Mermaid format
- Component relationships and dependencies
- Data flow visualization
- System structure overview

### 📝 File Changes
- \`${this.config.output.file_path}\` - Updated/created Mermaid diagram

### 🤖 Automation Details
This PR was automatically generated by the Mermaid Codebase Generator GitHub Action. The diagram is updated whenever changes are made to the codebase.

### 🔍 Review Notes
Please review the generated diagram to ensure it accurately represents the current architecture. If you notice any issues or missing components, please let us know so we can improve the generation process.

---
*This PR was created automatically by the Mermaid Codebase Generator*`;
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(): Promise<{
    branchExists: boolean;
    hasExistingPR: boolean;
    prUrl?: string;
    lastCommit?: string;
  }> {
    try {
      const branchExists = await this.githubClient.branchExists(this.githubConfig.target_branch);
      const existingPR = await this.githubClient.getExistingPullRequest(
        this.githubConfig.target_branch,
        this.githubConfig.base_branch
      );

      return {
        branchExists,
        hasExistingPR: !!existingPR,
        prUrl: existingPR?.url || undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old branches (optional utility)
   */
  async cleanupOldBranches(_maxAge: number = 30): Promise<void> {
    // This would be implemented to clean up old Mermaid update branches
    // For now, it's a placeholder
    console.log('🧹 Cleanup functionality not yet implemented');
  }
}
