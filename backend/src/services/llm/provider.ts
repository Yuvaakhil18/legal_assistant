import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface LlmRequest {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  responseSchema?: Record<string, unknown>;
}

export interface LlmProvider {
  generateStructured<T>(request: LlmRequest): Promise<T>;
}

export class GeminiLlmProvider implements LlmProvider {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async generateStructured<T>(request: LlmRequest): Promise<T> {
    const model = env.MODEL_REASONING || 'gemini-3.8-flash';
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('test_mock')) {
      logger.warn('Using mock LLM response due to missing/mock API key.');
      return this.mockResponse(request);
    }

    const payload: {
      contents: { parts: { text: string }[] }[];
      generationConfig: { temperature: number; responseMimeType: string; responseSchema?: unknown };
      systemInstruction?: { parts: { text: string }[] };
    } = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.1,
        responseMimeType: 'application/json'
      }
    };

    if (request.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: request.systemInstruction }]
      };
    }

    // Pass JSON schema if provided
    if (request.responseSchema) {
      payload.generationConfig.responseSchema = request.responseSchema;
    }

    const maxRetries = 2;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        logger.debug(`Fetching LLM`, { url });
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
          throw new Error('Malformed response from Gemini: No text content');
        }

        return JSON.parse(textContent) as T;

      } catch (err: unknown) {
        attempt++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`LLM Generation attempt ${attempt} failed: ${msg}`);
        
        if (attempt > maxRetries) {
          throw new Error(`LLM Generation failed after ${maxRetries} retries: ${msg}`);
        }
        
        // Exponential backoff
        await new Promise(res => setTimeout(res, attempt * 1000));
      }
    }

    throw new Error('Unreachable');
  }

  private mockResponse<T>(request: LlmRequest): T {
    const sys = (request.systemInstruction || '').toLowerCase();
    const pIntro = request.prompt.substring(0, 150).toLowerCase();
    
    if (sys.includes('synthesizer')) {
      if (pIntro.includes('executive') && pIntro.includes('summary')) {
        return { executive_summary: "Mock Executive Summary.", key_findings: ["Mock Finding 1"] } as unknown as T;
      }
      if (pIntro.includes('pitfall') || pIntro.includes('gotcha')) {
        return [
          {
            priority: 1,
            title: "Mock Gotcha",
            severity: "Critical",
            impact_description: "Mock Impact.",
            plain_english_advice: "Mock Advice.",
            related_clause_ids: []
          }
        ] as unknown as T;
      }
      if (pIntro.includes('checklist') || pIntro.includes('pre-signing')) {
        return [
          {
            priority: 1,
            item: "Mock Checklist Item",
            category: "General",
            status: "Action Required",
            impact_rationale: "Mock Rationale."
          }
        ] as unknown as T;
      }
      if (pIntro.includes('attorney') || pIntro.includes('dossier') || pIntro.includes('brief')) {
        return [
          {
            priority: 1,
            clause_ref: "Section 1",
            question: "Mock Question?",
            context_summary: "Mock Context."
          }
        ] as unknown as T;
      }
    }

    if (sys.includes('assistant') || sys.includes('educational only')) {
      const promptLower = request.prompt.toLowerCase();
      let answer = "Based on the document, this is a mock educational response.";
      
      if (promptLower.includes('renewal')) {
        answer = "The agreement mentions automatic renewal in Section 4. It renews for successive 1-year terms unless notice is provided 60 days before expiration.";
      } else if (promptLower.includes('termination')) {
        answer = "The termination clause allows either party to terminate with 30 days written notice.";
      } else if (promptLower.includes('liability')) {
        answer = "Liability is capped at the total fees paid under the agreement in the trailing 12 months.";
      }

      return {
        answer,
        grounding_citations: [],
        suggested_follow_ups: ["What are the exceptions?", "Can this be negotiated?"]
      } as unknown as T;
    }

    // Default to RiskAssessment
    const mockAssessment = {
      clause_id: "00000000-0000-0000-0000-000000000000",
      risk_level: "Caution",
      confidence_score: 0.9,
      primary_category: "General",
      delta: {
        deviation_summary: "Mock deviation summary.",
        risk_factors: ["Mock risk factor 1"],
        evidence: [{ quote: "mock quote", reasoning: "mock reasoning" }]
      },
      is_novel_clause: false
    };
    return mockAssessment as unknown as T;
  }
}

