import OpenAI from 'openai';
import { FileInfo, ProcessingBucket, LLMResponse } from '../types';
import { LLMInterface } from './LLMInterface';

export class OpenAIClient extends LLMInterface {
  private client: OpenAI;

  constructor(
    apiKey: string,
    model: string = 'gpt-4',
    maxTokens: number = 8000,
    temperature: number = 0.1
  ) {
    super(apiKey, model, maxTokens, temperature);
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  /**
   * Process a bucket of files and generate summary and Mermaid content
   */
  async processBucket(
    bucket: ProcessingBucket,
    previousSummary?: string,
    previousMermaid?: string
  ): Promise<LLMResponse> {
    const systemPrompt = this.createSystemPrompt();
    const userPrompt = this.createUserPrompt(bucket.files, previousSummary, previousMermaid);

    try {
      let response;
      if (this.model === 'gpt-5') {
        // Use Responses API for GPT-5
        response = await (this.client as any).responses.create({
          model: this.model,
          input: [
            { role: 'user', content: [{ type: 'input_text', text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          text: {
            format: { type: 'text' }
          },
          reasoning: {
            effort: 'medium'
          },
          tools: [],
          store: true
        });
      } else {
        // Use Chat Completions API for other models
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.min(this.maxTokens, 4000),
          temperature: this.temperature
        });
      }

      let content;
      if (this.model === 'gpt-5') {
        // Parse Responses API response
        const outputText = (response as any).input?.find((item: any) => 
          item.role === 'assistant' && item.content?.[0]?.type === 'output_text'
        );
        content = outputText?.content?.[0]?.text;
      } else {
        // Parse Chat Completions API response
        content = (response as any).choices[0]?.message?.content;
      }
      
      if (!content) {
        console.error('OpenAI Response:', JSON.stringify(response, null, 2));
        throw new Error('No content received from OpenAI');
      }

      const parsed = this.parseResponse(content);
      const cleanedMermaid = this.cleanMermaidContent(parsed.mermaid_content);

      return {
        summary: parsed.summary,
        mermaid_content: cleanedMermaid,
        tokens_used: response.usage?.total_tokens || 0
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a summary from file contents
   */
  async generateSummary(
    files: FileInfo[],
    previousSummary?: string
  ): Promise<string> {
    const systemPrompt = `You are an expert software architect. Analyze the provided code files and create a comprehensive summary focusing on:
1. Architecture and design patterns
2. Key components and their relationships
3. Data flow and dependencies
4. Overall system structure

Be concise but thorough in your analysis.`;

    const userPrompt = this.createUserPrompt(files, previousSummary);

    try {
      let response;
      if (this.model === 'gpt-5') {
        response = await (this.client as any).responses.create({
          model: this.model,
          input: [
            { role: 'user', content: [{ type: 'input_text', text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          text: { format: { type: 'text' } },
          reasoning: { effort: 'medium' },
          tools: [],
          store: true
        });
      } else {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.min(this.maxTokens, 2000),
          temperature: this.temperature
        });
      }

      if (this.model === 'gpt-5') {
        const outputText = (response as any).input?.find((item: any) => 
          item.role === 'assistant' && item.content?.[0]?.type === 'output_text'
        );
        return outputText?.content?.[0]?.text || '';
      } else {
        return (response as any).choices[0]?.message?.content || '';
      }
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Mermaid diagram from summary and file contents
   */
  async generateMermaid(
    summary: string,
    files: FileInfo[],
    previousMermaid?: string
  ): Promise<string> {
    const systemPrompt = `You are an expert at creating Mermaid diagrams. Create a clear, well-structured Mermaid diagram that represents the code architecture.

Requirements:
1. Use appropriate Mermaid diagram types (flowchart, classDiagram, sequenceDiagram, etc.)
2. Include all major components and their relationships
3. Use clear, descriptive labels
4. Ensure the diagram is valid Mermaid syntax
5. Focus on architectural relationships rather than implementation details

Return only the Mermaid diagram code, without any markdown formatting or explanations.`;

    let userPrompt = `Based on the following summary and code files, create a Mermaid diagram:\n\n`;
    userPrompt += `Summary: ${summary}\n\n`;
    
    if (previousMermaid) {
      userPrompt += `Previous diagram to build upon:\n\`\`\`mermaid\n${previousMermaid}\n\`\`\`\n\n`;
    }

    userPrompt += `Key files to consider:\n`;
    for (const file of files.slice(0, 5)) { // Limit to first 5 files to avoid token limits
      userPrompt += `- ${file.path} (${file.extension})\n`;
    }

    try {
      let response;
      if (this.model === 'gpt-5') {
        response = await (this.client as any).responses.create({
          model: this.model,
          input: [
            { role: 'user', content: [{ type: 'input_text', text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          text: { format: { type: 'text' } },
          reasoning: { effort: 'medium' },
          tools: [],
          store: true
        });
      } else {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.min(this.maxTokens, 3000),
          temperature: this.temperature
        });
      }

      let content;
      if (this.model === 'gpt-5') {
        const outputText = (response as any).input?.find((item: any) => 
          item.role === 'assistant' && item.content?.[0]?.type === 'output_text'
        );
        content = outputText?.content?.[0]?.text || '';
      } else {
        content = (response as any).choices[0]?.message?.content || '';
      }
      return this.cleanMermaidContent(content);
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate API key and model availability
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.client.models.list();
      const availableModels = response.data.map(model => model.id);
      return availableModels.includes(this.model);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get estimated cost for processing
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    // OpenAI pricing as of 2024 (approximate)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
    };

    const modelPricing = pricing[this.model] || pricing['gpt-4'];
    const inputCost = (inputTokens / 1000) * (modelPricing?.input || 0.03);
    const outputCost = (outputTokens / 1000) * (modelPricing?.output || 0.06);

    return inputCost + outputCost;
  }

  /**
   * Get provider name
   */
  protected getProviderName(): string {
    return 'openai';
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new Error(`Failed to fetch available models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test the connection with a simple request
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.model === 'gpt-5') {
        await (this.client as any).responses.create({
          model: this.model,
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello, this is a test message.' }] }
          ],
          text: { format: { type: 'text' } },
          reasoning: { effort: 'low' },
          tools: [],
          store: false
        });
      } else {
        await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
          max_tokens: 10,
          temperature: 0
        });
      }

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
