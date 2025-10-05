import * as fs from 'fs-extra';
import * as path from 'path';
import { ProcessingBucket, ProcessingState } from '../types';
import { LLMInterface } from '../llm/LLMInterface';

export class MermaidGenerator {
  private llmClient: LLMInterface;
  private outputPath: string;
  private includeSummary: boolean;

  constructor(
    llmClient: LLMInterface,
    outputPath: string = 'repo.mermaid',
    includeSummary: boolean = true
  ) {
    this.llmClient = llmClient;
    this.outputPath = outputPath;
    this.includeSummary = includeSummary;
  }

  /**
   * Process all buckets and generate final Mermaid diagram
   */
  async processBuckets(
    buckets: ProcessingBucket[],
    existingMermaid?: string,
    _skippedFiles?: Array<{ path: string; size: number; reason: string }>
  ): Promise<ProcessingState> {
    const state: ProcessingState = {
      current_bucket_index: 0,
      total_buckets: buckets.length,
      processed_files: 0,
      total_files: buckets.reduce((sum, bucket) => sum + bucket.files.length, 0),
      accumulated_summary: '',
      accumulated_mermaid: existingMermaid || ''
    };

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      state.current_bucket_index = i;

      try {
        console.log(`Processing bucket ${i + 1}/${buckets.length} (${bucket!.files.length} files, ${bucket!.total_tokens} tokens)`);

        const response = await this.llmClient.processBucket(
          bucket!,
          state.accumulated_summary,
          state.accumulated_mermaid
        );

        // Update bucket with results
        bucket!.summary = response.summary;
        bucket!.mermaid_content = response.mermaid_content;

        // Accumulate results
        // Accumulate results
        state.accumulated_summary = this.mergeSummaries(
          state.accumulated_summary,
          response.summary
        );
        // Defer diagram merging to LLM; collect fragments
        state.accumulated_mermaid = this.appendMermaidFragment(
          state.accumulated_mermaid,
          response.mermaid_content
        );

        state.processed_files += bucket!.files.length;

        console.log(`✓ Bucket ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`✗ Error processing bucket ${i + 1}:`, error);
        throw error;
      }
    }

    return state;
  }

  /**
   * Generate final Mermaid file
   */
  async generateFinalMermaidFile(
    state: ProcessingState,
    skippedFiles?: Array<{ path: string; size: number; reason: string }>
  ): Promise<string> {
    const content = await this.buildFinalMermaidContent(state, skippedFiles);
    await this.writeMermaidFile(content);
    return content;
  }

  /**
   * Sanitize Mermaid content to fix common syntax issues for GitHub compatibility
   */
  private sanitizeMermaidContent(content: string): string {
    return content
      // Fix invalid arrow syntax with labels (GitHub doesn't support -->|label| syntax)
      .replace(/-->\|([^|]*)\|/g, '-->')
      .replace(/--\|([^|]*)\|-->/g, '-->')
      
      // Fix node labels with special characters - wrap in quotes for safety
      .replace(/(\w+)\{([^}]*[><=#+\-&]+[^}]*)\}/g, (_match, nodeId, label) => {
        // Escape special characters and wrap in quotes
        const escapedLabel = label
          .replace(/&/g, '&amp;')
          .replace(/>/g, '&gt;')
          .replace(/</g, '&lt;')
          .replace(/=/g, '&equals;')
          .replace(/#/g, '&num;')
          .replace(/\+/g, '&plus;')
          .replace(/\-/g, '&minus;');
        return `${nodeId}{"${escapedLabel}"}`;
      })
      
      // Fix node labels with special characters in square brackets - wrap in quotes
      .replace(/(\w+)\[([^\]]*[><=#+\-&]+[^\]]*)\]/g, (_match, nodeId, label) => {
        const escapedLabel = label
          .replace(/&/g, '&amp;')
          .replace(/>/g, '&gt;')
          .replace(/</g, '&lt;')
          .replace(/=/g, '&equals;')
          .replace(/#/g, '&num;')
          .replace(/\+/g, '&plus;')
          .replace(/\-/g, '&minus;');
        return `${nodeId}["${escapedLabel}"]`;
      })
      
      // Fix connection labels with special characters - ensure proper quoting
      .replace(/--\s*"([^"]*[><=#+\-&]+[^"]*)"\s*-->/g, (_match, label) => {
        const escapedLabel = label
          .replace(/&/g, '&amp;')
          .replace(/>/g, '&gt;')
          .replace(/</g, '&lt;')
          .replace(/=/g, '&equals;')
          .replace(/#/g, '&num;')
          .replace(/\+/g, '&plus;')
          .replace(/\-/g, '&minus;');
        return `-- "${escapedLabel}" -->`;
      })
      
      // Remove any remaining invalid syntax patterns
      .replace(/-->\|/g, '-->')
      .replace(/\|-->/g, '-->')
      
      // Ensure all node labels with spaces or special chars are quoted
      .replace(/(\w+)\[([^\[\]]*[^\[\]"]+[^\[\]]*)\]/g, (match, nodeId, label) => {
        if (!label.startsWith('"') && !label.endsWith('"')) {
          return `${nodeId}["${label}"]`;
        }
        return match;
      })
      
      // Fix double quotes in node labels
      .replace(/\[""([^"]+)""\]/g, '["$1"]')
      .replace(/\{""([^"]+)""\}/g, '{"$1"}')
      
      // Fix incomplete connections (nodes without proper targets)
      .replace(/(\w+)\[([^\]]*)\]\s*--\s*(\w+)(?!\[)/g, '$1["$2"] --> $3')
      .replace(/(\w+)\s*--\s*(\w+)\[([^\]]*)\](?!\s*-->)/g, '$1 --> $2["$3"]')
      
      // Final cleanup: ensure proper line endings and remove any trailing issues
      .replace(/\s+$/gm, '') // Remove trailing whitespace
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple newlines
  }


  /**
   * Build final Mermaid content
   */
  private async buildFinalMermaidContent(
    state: ProcessingState,
    skippedFiles?: Array<{ path: string; size: number; reason: string }>
  ): Promise<string> {
    let content = '';

    // Start with the Mermaid diagram first (for GitHub compatibility)
    // Merge/repair via LLM using collected fragments
    const fragments = this.collectFragments(state.accumulated_mermaid);
    const merged = await this.llmClient.mergeOrRepairMermaid('', fragments);
    const sanitizedMermaid = this.sanitizeMermaidContent(merged);
    content += sanitizedMermaid;
    
    // Validate the sanitized content
    const validation = this.validateMermaidSyntax(sanitizedMermaid);
    if (!validation.valid) {
      console.warn('Warning: Generated Mermaid may have syntax issues:');
      validation.errors.forEach(error => console.warn(`  - ${error}`));
    }

    // Add metadata as comments at the end
    if (this.includeSummary && state.accumulated_summary) {
      content += `\n\n<!--\n`;
      content += `Generated Mermaid Diagram\n`;
      content += `========================\n\n`;
      content += `Summary:\n${state.accumulated_summary}\n\n`;
      content += `Processing Statistics:\n`;
      content += `- Total files processed: ${state.processed_files}\n`;
      content += `- Total buckets: ${state.total_buckets}\n`;
      content += `- Generated on: ${new Date().toISOString()}\n`;
      
      if (skippedFiles && skippedFiles.length > 0) {
        content += `\nSkipped Files (${skippedFiles.length}):\n`;
        for (const skipped of skippedFiles) {
          content += `- ${skipped.path} (${skipped.size} bytes): ${skipped.reason}\n`;
        }
      }
      
      content += `\n-->`;
    }

    return content;
  }

  /**
   * Write Mermaid content to file
   */
  private async writeMermaidFile(content: string): Promise<void> {
    const dir = path.dirname(this.outputPath);
    await fs.ensureDir(dir);
    await fs.writeFile(this.outputPath, content, 'utf-8');
  }

  /**
   * Merge multiple summaries into one
   */
  private mergeSummaries(existing: string, newSummary: string): string {
    if (!existing) {
      return newSummary;
    }

    if (!newSummary) {
      return existing;
    }

    // Simple merge strategy - in production, you might want more sophisticated merging
    return `${existing}\n\n--- Additional Analysis ---\n\n${newSummary}`;
  }

  /**
   * Merge multiple Mermaid diagrams into one
   */
  // Collect fragments in a simple serialized form for LLM merging
  private appendMermaidFragment(existing: string, fragment: string): string {
    if (!fragment) return existing;
    if (!existing) return fragment;
    return `${existing}\n\n--- FRAGMENT ---\n\n${fragment}`;
  }

  private collectFragments(serialized: string): string[] {
    if (!serialized) return [];
    const parts = serialized.split(/\n\n--- FRAGMENT ---\n\n/);
    return parts.filter(p => p.trim().length > 0);
  }

  // Removed local merge helpers in favor of LLM-driven merge

  /**
   * Validate Mermaid syntax
   */
  validateMermaidSyntax(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation checks
    if (!content.trim()) {
      errors.push('Empty diagram content');
      return { valid: false, errors };
    }

    // Check for valid diagram start
    const validStarts = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitgraph'];
    const hasValidStart = validStarts.some(start => content.toLowerCase().includes(start.toLowerCase()));
    
    if (!hasValidStart) {
      errors.push('No valid Mermaid diagram type found');
    }

    // Check for balanced brackets
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      errors.push('Unbalanced brackets in diagram');
    }

    // Check for balanced parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in diagram');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(state: ProcessingState): {
    totalFiles: number;
    totalBuckets: number;
    processedFiles: number;
    completionPercentage: number;
    averageFilesPerBucket: number;
  } {
    return {
      totalFiles: state.total_files,
      totalBuckets: state.total_buckets,
      processedFiles: state.processed_files,
      completionPercentage: state.total_files > 0 ? (state.processed_files / state.total_files) * 100 : 0,
      averageFilesPerBucket: state.total_buckets > 0 ? state.processed_files / state.total_buckets : 0
    };
  }
}
