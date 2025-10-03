export interface Config {
  file_types: string[];
  exclude_patterns: string[];
  llm: {
    provider: string;
    model: string;
    max_tokens: number;
    temperature: number;
  };
  output: {
    format: string;
    file_path: string;
    include_summary: boolean;
  };
  github: {
    branch: string;
    commit_message: string;
    pr_title: string;
    pr_body: string;
  };
}

export interface FileInfo {
  path: string;
  content: string;
  size: number;
  extension: string;
  estimated_tokens: number;
}

export interface ProcessingBucket {
  files: FileInfo[];
  total_tokens: number;
  summary?: string;
  mermaid_content?: string;
}

export interface LLMResponse {
  summary: string;
  mermaid_content: string;
  tokens_used: number;
}

export interface ProcessingState {
  current_bucket_index: number;
  total_buckets: number;
  processed_files: number;
  total_files: number;
  accumulated_summary: string;
  accumulated_mermaid: string;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  base_branch: string;
  target_branch: string;
}

export interface CLIArgs {
  tokenLimit: number;
  fileTypes: string[];
  outputPath: string;
  configPath?: string;
  recursive: boolean;
  specificFiles?: string[];
  existingMermaid?: string;
  llmProvider: string;
  llmModel: string;
  llmApiKey?: string;
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  dryRun: boolean;
  verbose: boolean;
}
