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
        state.accumulated_summary = this.mergeSummaries(
          state.accumulated_summary,
          response.summary
        );
        state.accumulated_mermaid = this.mergeMermaidDiagrams(
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
    const content = this.buildFinalMermaidContent(state, skippedFiles);
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
  private buildFinalMermaidContent(
    state: ProcessingState,
    skippedFiles?: Array<{ path: string; size: number; reason: string }>
  ): string {
    let content = '';

    // Start with the Mermaid diagram first (for GitHub compatibility)
    const sanitizedMermaid = this.sanitizeMermaidContent(state.accumulated_mermaid);
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
  private mergeMermaidDiagrams(existing: string, newDiagram: string): string {
    if (!existing) {
      return newDiagram;
    }

    if (!newDiagram) {
      return existing;
    }

    // Try to merge diagrams intelligently
    return this.intelligentDiagramMerge(existing, newDiagram);
  }

  /**
   * Intelligently merge two Mermaid diagrams
   */
  private intelligentDiagramMerge(existing: string, newDiagram: string): string {
    // Parse diagram types
    const existingType = this.getDiagramType(existing);
    const newType = this.getDiagramType(newDiagram);

    // If same type, try to merge
    if (existingType === newType && existingType !== 'unknown') {
      return this.mergeSameTypeDiagrams(existing, newDiagram, existingType);
    }

    // If different types, create a compound diagram
    return this.createCompoundDiagram(existing, newDiagram);
  }

  /**
   * Get diagram type from content
   */
  private getDiagramType(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.startsWith('graph') || lowerContent.startsWith('flowchart')) {
      return 'flowchart';
    } else if (lowerContent.startsWith('classdiagram')) {
      return 'classdiagram';
    } else if (lowerContent.startsWith('sequencediagram')) {
      return 'sequencediagram';
    } else if (lowerContent.startsWith('statediagram')) {
      return 'statediagram';
    } else if (lowerContent.startsWith('erdiagram')) {
      return 'erdiagram';
    } else if (lowerContent.startsWith('journey')) {
      return 'journey';
    } else if (lowerContent.startsWith('gantt')) {
      return 'gantt';
    } else if (lowerContent.startsWith('pie')) {
      return 'pie';
    } else if (lowerContent.startsWith('gitgraph')) {
      return 'gitgraph';
    }

    return 'unknown';
  }

  /**
   * Merge diagrams of the same type
   */
  private mergeSameTypeDiagrams(existing: string, newDiagram: string, type: string): string {
    // For flowcharts, try to merge nodes and connections
    if (type === 'flowchart') {
      return this.mergeFlowcharts(existing, newDiagram);
    }

    // For other types, append with separator
    return `${existing}\n\n--- Additional ${type} ---\n\n${newDiagram}`;
  }

  /**
   * Merge two flowcharts
   */
  private mergeFlowcharts(existing: string, newDiagram: string): string {
    // Extract nodes and connections from both diagrams
    const existingNodes = this.extractNodes(existing);
    const newNodes = this.extractNodes(newDiagram);
    const existingConnections = this.extractConnections(existing);
    const newConnections = this.extractConnections(newDiagram);

    // Create merged diagram
    let merged = 'flowchart TD\n';
    
    // Add all unique nodes
    const allNodes = new Set([...existingNodes, ...newNodes]);
    for (const node of allNodes) {
      merged += `  ${node}\n`;
    }

    // Add all connections
    const allConnections = new Set([...existingConnections, ...newConnections]);
    for (const connection of allConnections) {
      merged += `  ${connection}\n`;
    }

    return merged;
  }

  /**
   * Extract nodes from flowchart
   */
  private extractNodes(content: string): string[] {
    const lines = content.split('\n');
    const nodes: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('flowchart') && !trimmed.includes('-->') && !trimmed.includes('---')) {
        nodes.push(trimmed);
      }
    }

    return nodes;
  }

  /**
   * Extract connections from flowchart
   */
  private extractConnections(content: string): string[] {
    const lines = content.split('\n');
    const connections: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.includes('-->') || trimmed.includes('---'))) {
        connections.push(trimmed);
      }
    }

    return connections;
  }

  /**
   * Create compound diagram from different types
   */
  private createCompoundDiagram(existing: string, newDiagram: string): string {
    return `${existing}\n\n--- Additional Diagram ---\n\n${newDiagram}`;
  }

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
