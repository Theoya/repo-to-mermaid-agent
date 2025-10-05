import { FileInfo, ProcessingBucket, LLMResponse, Config } from '../types';

export abstract class LLMInterface {
  protected apiKey: string;
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;
  protected colors: Config['colors'];
  protected additionalInstructions: string;

  constructor(
    apiKey: string,
    model: string,
    maxTokens: number = 8000,
    temperature: number = 0.1,
    colors?: Config['colors'],
    additionalInstructions: string = ''
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.colors = colors || {
      tests: '#e17055',
      config: '#fdcb6e',
      core: '#0984e3',
      llm: '#55efc4',
      output: '#6c5ce7'
    };
    this.additionalInstructions = additionalInstructions;
  }

  /**
   * Process a bucket of files and generate summary and Mermaid content
   */
  abstract processBucket(
    bucket: ProcessingBucket,
    previousSummary?: string,
    previousMermaid?: string
  ): Promise<LLMResponse>;

  /**
   * Generate a summary from file contents
   */
  abstract generateSummary(
    files: FileInfo[],
    previousSummary?: string
  ): Promise<string>;

  /**
   * Generate Mermaid diagram from summary and file contents
   */
  abstract generateMermaid(
    summary: string,
    files: FileInfo[],
    previousMermaid?: string
  ): Promise<string>;

  /**
   * Merge and repair multiple Mermaid fragments into a single, GitHub-compatible diagram
   */
  abstract mergeOrRepairMermaid(
    existingMermaid: string,
    fragments: string[]
  ): Promise<string>;

  /**
   * Validate API key and model availability
   */
  abstract validateConnection(): Promise<boolean>;

  /**
   * Get estimated cost for processing
   */
  abstract estimateCost(inputTokens: number, outputTokens: number): number;

  /**
   * Get model information
   */
  getModelInfo(): {
    name: string;
    maxTokens: number;
    temperature: number;
    provider: string;
  } {
    return {
      name: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      provider: this.getProviderName()
    };
  }

  /**
   * Get provider name (to be implemented by subclasses)
   */
  protected abstract getProviderName(): string;

  /**
   * Create system prompt for code analysis
   */
  protected createSystemPrompt(): string {
    return `You are an expert software architect and code analyst. Your task is to analyze code files and create comprehensive summaries and Mermaid diagrams that represent the architecture and relationships within the codebase.

Key requirements:
1. Focus on architectural patterns, class relationships, and system design
2. Identify key components, modules, and their interactions
3. Highlight important data flows and dependencies
4. Create clear, readable summaries that capture the essence of the code
5. Generate valid Mermaid syntax for diagrams with colors and styling

When analyzing code:
- Identify classes, interfaces, and their relationships
- Note inheritance hierarchies and composition patterns
- Understand data flow and control flow
- Recognize design patterns and architectural decisions
- Consider the overall system structure and organization

For Mermaid diagrams, use colors and styling to enhance readability:
- Use classDef to define color schemes for different types of components
- Apply consistent colors based on component type:
  * ${this.colors.tests} for tests and testing suites
  * ${this.colors.config} for configuration files and tools
  * ${this.colors.core} for core functionality or business logic
  * ${this.colors.llm} for LLM related components
  * ${this.colors.output} for output and rendering components
- Use different node shapes: rectangles for classes, diamonds for decisions, circles for endpoints
- Add meaningful labels and connections with descriptive text
- Example color scheme:
  classDef tests fill:${this.colors.tests},stroke:#ffffff,stroke-width:2px
  classDef config fill:${this.colors.config},stroke:#ffffff,stroke-width:2px
  classDef core fill:${this.colors.core},stroke:#ffffff,stroke-width:2px
  classDef llm fill:${this.colors.llm},stroke:#ffffff,stroke-width:2px
  classDef output fill:${this.colors.output},stroke:#ffffff,stroke-width:2px

CRITICAL: GitHub Mermaid Syntax Requirements:
- NEVER use arrow syntax with labels like -->|label| or --|label|--> (GitHub doesn't support this)
- Use simple arrows: --> for connections, -- for dashed connections
- Wrap ALL node labels containing special characters in double quotes: Node["Label with spaces & symbols"]
- Escape special characters in labels: > becomes &gt;, < becomes &lt;, & becomes &amp;
- Use only supported Mermaid diagram types: flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram
- Ensure all brackets and parentheses are properly balanced

Your responses should be professional, accurate, and focused on the technical architecture rather than implementation details.${this.additionalInstructions ? `\n\nAdditional Instructions:\n${this.additionalInstructions}` : ''}`;
  }

  /**
   * Create user prompt for file analysis
   */
  protected createUserPrompt(
    files: FileInfo[],
    previousSummary?: string,
    previousMermaid?: string
  ): string {
    let prompt = `Please analyze the following code files and provide a comprehensive summary and Mermaid diagram.\n\n`;

    if (previousSummary && previousMermaid) {
      prompt += `Previous context:\n`;
      prompt += `Summary: ${previousSummary}\n\n`;
      prompt += `Previous Mermaid diagram:\n\`\`\`mermaid\n${previousMermaid}\n\`\`\`\n\n`;
      prompt += `Please build upon this previous analysis and integrate the new files into the existing architecture.\n\n`;
    }

    prompt += `Files to analyze:\n\n`;

    for (const file of files) {
      prompt += `--- File: ${file.path} ---\n`;
      prompt += `Extension: ${file.extension}\n`;
      prompt += `Size: ${file.size} bytes\n`;
      prompt += `Estimated tokens: ${file.estimated_tokens}\n\n`;
      prompt += `Content:\n\`\`\`${this.getLanguageFromExtension(file.extension)}\n${file.content}\n\`\`\`\n\n`;
    }

    prompt += `Please provide:\n`;
    prompt += `1. A comprehensive summary of the code architecture and relationships\n`;
    prompt += `2. A Mermaid diagram showing the system structure and component relationships with colors and styling\n\n`;
    prompt += `For the Mermaid diagram:\n`;
    prompt += `- Use classDef to define color schemes for different component types\n`;
    prompt += `- Apply colors consistently based on component type:\n`;
    prompt += `  * ${this.colors.tests} for tests and testing suites\n`;
    prompt += `  * ${this.colors.config} for configuration files and tools\n`;
    prompt += `  * ${this.colors.core} for core functionality or business logic\n`;
    prompt += `  * ${this.colors.llm} for LLM related components\n`;
    prompt += `  * ${this.colors.output} for output and rendering components\n`;
    prompt += `- Use descriptive node shapes and labels\n`;
    prompt += `- Include class assignments at the end of the diagram\n\n`;
    prompt += `Format your response as JSON with the following structure:\n`;
    prompt += `{\n`;
    prompt += `  "summary": "Your detailed summary here",\n`;
    prompt += `  "mermaid_content": "Your colored Mermaid diagram here"\n`;
    prompt += `}`;

    return prompt;
  }

  /**
   * Get language identifier for syntax highlighting
   */
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.cs': 'csharp',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.vb': 'vbnet',
      '.sql': 'sql',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.bat': 'batch',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.astro': 'astro'
    };

    return languageMap[extension] || 'text';
  }

  /**
   * Parse LLM response and extract summary and Mermaid content
   */
  protected parseResponse(response: string): { summary: string; mermaid_content: string } {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '',
          mermaid_content: parsed.mermaid_content || ''
        };
      }
    } catch (error) {
      // If JSON parsing fails, try to extract from text
    }

    // Fallback: extract from text format
    const summaryMatch = response.match(/summary[:\s]*([\s\S]*?)(?=mermaid|$)/i);
    const mermaidMatch = response.match(/mermaid[:\s]*([\s\S]*?)(?=\n\n|$)/i);

    return {
      summary: summaryMatch ? summaryMatch[1]?.trim() || response : response,
      mermaid_content: mermaidMatch ? mermaidMatch[1]?.trim() || '' : ''
    };
  }

  /**
   * Clean and validate Mermaid content
   */
  protected cleanMermaidContent(content: string): string {
    // Remove code block markers if present
    let cleaned = content.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '');
    
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // Ensure it starts with a valid Mermaid diagram type
    const validStarts = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitgraph'];
    const startsWithValid = validStarts.some(start => cleaned.toLowerCase().startsWith(start.toLowerCase()));
    
    if (!startsWithValid && cleaned.length > 0) {
      // Default to flowchart if no valid start is found
      cleaned = `flowchart TD\n${cleaned}`;
    }
    
    return cleaned;
  }
}
