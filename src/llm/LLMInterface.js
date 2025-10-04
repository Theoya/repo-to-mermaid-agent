"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMInterface = void 0;
class LLMInterface {
    constructor(apiKey, model, maxTokens = 8000, temperature = 0.1) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
    }
    /**
     * Get model information
     */
    getModelInfo() {
        return {
            name: this.model,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            provider: this.getProviderName()
        };
    }
    /**
     * Create system prompt for code analysis
     */
    createSystemPrompt() {
        return `You are an expert software architect and code analyst. Your task is to analyze code files and create comprehensive summaries and Mermaid diagrams that represent the architecture and relationships within the codebase.

Key requirements:
1. Focus on architectural patterns, class relationships, and system design
2. Identify key components, modules, and their interactions
3. Highlight important data flows and dependencies
4. Create clear, readable summaries that capture the essence of the code
5. Generate valid Mermaid syntax for diagrams

When analyzing code:
- Identify classes, interfaces, and their relationships
- Note inheritance hierarchies and composition patterns
- Understand data flow and control flow
- Recognize design patterns and architectural decisions
- Consider the overall system structure and organization

Your responses should be professional, accurate, and focused on the technical architecture rather than implementation details.`;
    }
    /**
     * Create user prompt for file analysis
     */
    createUserPrompt(files, previousSummary, previousMermaid) {
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
        prompt += `2. A Mermaid diagram showing the system structure and component relationships\n\n`;
        prompt += `Format your response as JSON with the following structure:\n`;
        prompt += `{\n`;
        prompt += `  "summary": "Your detailed summary here",\n`;
        prompt += `  "mermaid_content": "Your Mermaid diagram here"\n`;
        prompt += `}`;
        return prompt;
    }
    /**
     * Get language identifier for syntax highlighting
     */
    getLanguageFromExtension(extension) {
        const languageMap = {
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
    parseResponse(response) {
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
        }
        catch (error) {
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
    cleanMermaidContent(content) {
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
exports.LLMInterface = LLMInterface;
