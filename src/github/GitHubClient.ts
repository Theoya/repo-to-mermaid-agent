import { Octokit } from '@octokit/rest';
import { GitHubConfig } from '../types';

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, baseBranch: string = 'main'): Promise<void> {
    try {
      // Get the latest commit SHA from the base branch
      const { data: baseRef } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${baseBranch}`,
      });

      // Create the new branch
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.getBranch({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: branchName,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(filePath: string, branch: string = 'main'): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: filePath,
        ref: branch,
      });

      if ('content' in data && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create or update a file in the repository
   */
  async createOrUpdateFile(
    filePath: string,
    content: string,
    commitMessage: string,
    branch: string
  ): Promise<void> {
    try {
      // Check if file exists
      const existingContent = await this.getFileContent(filePath, branch);
      let sha: string | undefined;

      if (existingContent !== null) {
        // Get the SHA of the existing file
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: filePath,
          ref: branch,
        });

        if ('sha' in data) {
          sha = data.sha;
        }
      }

      // Create or update the file
      const updateParams: any = {
        owner: this.config.owner,
        repo: this.config.repo,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: branch,
      };
      
      if (sha) {
        updateParams.sha = sha;
      }
      
      await this.octokit.rest.repos.createOrUpdateFileContents(updateParams);
    } catch (error) {
      throw new Error(`Failed to create/update file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    body: string,
    headBranch: string,
    baseBranch: string = 'main'
  ): Promise<{ number: number; url: string }> {
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: title,
        body: body,
        head: headBranch,
        base: baseBranch,
      });

      return {
        number: data.number,
        url: data.html_url || '',
      };
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a pull request already exists for the branch
   */
  async getExistingPullRequest(headBranch: string, baseBranch: string = 'main'): Promise<{ number: number; url: string } | null> {
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner: this.config.owner,
        repo: this.config.repo,
        head: `${this.config.owner}:${headBranch}`,
        base: baseBranch,
        state: 'open',
      });

      if (data.length > 0) {
        return {
          number: data[0]?.number || 0,
          url: data[0]?.html_url || '',
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(): Promise<{
    name: string;
    fullName: string;
    defaultBranch: string;
    description: string | null;
  }> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });

      return {
        name: data.name,
        fullName: data.full_name,
        defaultBranch: data.default_branch,
        description: data.description,
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get changed files in a pull request
   */
  async getChangedFiles(prNumber: number): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
      });

      return data.map(file => file.filename);
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get commits in a pull request
   */
  async getPullRequestCommits(prNumber: number): Promise<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }[]> {
    try {
      const { data } = await this.octokit.rest.pulls.listCommits({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
      });

      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || 'Unknown',
        date: commit.commit.author?.date || '',
      }));
    } catch (error) {
      throw new Error(`Failed to get pull request commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add labels to a pull request
   */
  async addLabelsToPullRequest(prNumber: number, labels: string[]): Promise<void> {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: prNumber,
        labels: labels,
      });
    } catch (error) {
      throw new Error(`Failed to add labels: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a comment to a pull request
   */
  async addCommentToPullRequest(prNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: prNumber,
        body: body,
      });
    } catch (error) {
      throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test the GitHub connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });
      return {
        success: true,
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
