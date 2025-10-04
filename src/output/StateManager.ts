import * as fs from 'fs-extra';
// import * as path from 'path';
import { ProcessingState, ProcessingBucket } from '../types';

export class StateManager {
  private stateFilePath: string;
  private state: ProcessingState | null = null;

  constructor(stateFilePath: string = '.mermaid-generator-state.json') {
    this.stateFilePath = stateFilePath;
  }

  /**
   * Load state from file
   */
  async loadState(): Promise<ProcessingState | null> {
    try {
      if (await fs.pathExists(this.stateFilePath)) {
        const content = await fs.readFile(this.stateFilePath, 'utf-8');
        this.state = JSON.parse(content);
        return this.state;
      }
    } catch (error) {
      console.warn(`Warning: Could not load state file: ${error}`);
    }
    return null;
  }

  /**
   * Save state to file
   */
  async saveState(state: ProcessingState): Promise<void> {
    try {
      this.state = state;
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Warning: Could not save state file: ${error}`);
    }
  }

  /**
   * Initialize new state
   */
  initializeState(totalFiles: number, totalBuckets: number): ProcessingState {
    this.state = {
      current_bucket_index: 0,
      total_buckets: totalBuckets,
      processed_files: 0,
      total_files: totalFiles,
      accumulated_summary: '',
      accumulated_mermaid: ''
    };
    return this.state;
  }

  /**
   * Update state with bucket processing results
   */
  updateState(
    bucketIndex: number,
    filesProcessed: number,
    summary: string,
    mermaidContent: string
  ): ProcessingState {
    if (!this.state) {
      throw new Error('State not initialized');
    }

    this.state.current_bucket_index = bucketIndex;
    this.state.processed_files += filesProcessed;
    this.state.accumulated_summary = this.mergeSummaries(
      this.state.accumulated_summary,
      summary
    );
    this.state.accumulated_mermaid = this.mergeMermaidContent(
      this.state.accumulated_mermaid,
      mermaidContent
    );

    return this.state;
  }

  /**
   * Get current state
   */
  getCurrentState(): ProcessingState | null {
    return this.state;
  }

  /**
   * Check if processing is complete
   */
  isProcessingComplete(): boolean {
    if (!this.state) {
      return false;
    }
    return this.state.processed_files >= this.state.total_files;
  }

  /**
   * Get processing progress
   */
  getProgress(): {
    percentage: number;
    currentBucket: number;
    totalBuckets: number;
    processedFiles: number;
    totalFiles: number;
  } {
    if (!this.state) {
      return {
        percentage: 0,
        currentBucket: 0,
        totalBuckets: 0,
        processedFiles: 0,
        totalFiles: 0
      };
    }

    return {
      percentage: this.state.total_files > 0 ? (this.state.processed_files / this.state.total_files) * 100 : 0,
      currentBucket: this.state.current_bucket_index + 1,
      totalBuckets: this.state.total_buckets,
      processedFiles: this.state.processed_files,
      totalFiles: this.state.total_files
    };
  }

  /**
   * Reset state
   */
  async resetState(): Promise<void> {
    this.state = null;
    try {
      if (await fs.pathExists(this.stateFilePath)) {
        await fs.remove(this.stateFilePath);
      }
    } catch (error) {
      console.warn(`Warning: Could not remove state file: ${error}`);
    }
  }

  /**
   * Merge summaries
   */
  private mergeSummaries(existing: string, newSummary: string): string {
    if (!existing) {
      return newSummary;
    }

    if (!newSummary) {
      return existing;
    }

    // Simple merge strategy
    return `${existing}\n\n--- Additional Analysis ---\n\n${newSummary}`;
  }

  /**
   * Merge Mermaid content
   */
  private mergeMermaidContent(existing: string, newContent: string): string {
    if (!existing) {
      return newContent;
    }

    if (!newContent) {
      return existing;
    }

    // For now, append with separator
    // In production, you might want more sophisticated merging
    return `${existing}\n\n--- Additional Components ---\n\n${newContent}`;
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(buckets: ProcessingBucket[]): Promise<void> {
    if (!this.state) {
      throw new Error('State not initialized');
    }

    const checkpoint = {
      state: this.state,
      buckets: buckets.map(bucket => ({
        files: bucket.files.map(file => ({
          path: file.path,
          size: file.size,
          extension: file.extension,
          estimated_tokens: file.estimated_tokens
        })),
        total_tokens: bucket.total_tokens,
        summary: bucket.summary,
        mermaid_content: bucket.mermaid_content
      })),
      timestamp: new Date().toISOString()
    };

    const checkpointPath = this.stateFilePath.replace('.json', '-checkpoint.json');
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  /**
   * Load checkpoint
   */
  async loadCheckpoint(): Promise<{ state: ProcessingState; buckets: ProcessingBucket[] } | null> {
    try {
      const checkpointPath = this.stateFilePath.replace('.json', '-checkpoint.json');
      if (await fs.pathExists(checkpointPath)) {
        const content = await fs.readFile(checkpointPath, 'utf-8');
        const checkpoint = JSON.parse(content);
        
        // Restore full file content for buckets
        const buckets: ProcessingBucket[] = [];
        for (const bucketData of checkpoint.buckets) {
          const bucket: ProcessingBucket = {
            files: [],
            total_tokens: bucketData.total_tokens,
            summary: bucketData.summary,
            mermaid_content: bucketData.mermaid_content
          };

          // Load file content
          for (const fileData of bucketData.files) {
            try {
              const content = await fs.readFile(fileData.path, 'utf-8');
              bucket.files.push({
                path: fileData.path,
                content,
                size: fileData.size,
                extension: fileData.extension,
                estimated_tokens: fileData.estimated_tokens
              });
            } catch (error) {
              console.warn(`Warning: Could not load file ${fileData.path}: ${error}`);
            }
          }

          buckets.push(bucket);
        }

        return {
          state: checkpoint.state,
          buckets
        };
      }
    } catch (error) {
      console.warn(`Warning: Could not load checkpoint: ${error}`);
    }
    return null;
  }

  /**
   * Get state file path
   */
  getStateFilePath(): string {
    return this.stateFilePath;
  }

  /**
   * Set state file path
   */
  setStateFilePath(path: string): void {
    this.stateFilePath = path;
  }
}
