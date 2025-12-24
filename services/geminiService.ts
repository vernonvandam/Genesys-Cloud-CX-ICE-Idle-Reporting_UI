
import { GoogleGenAI, Type } from "@google/genai";
import { Agent, AIAnalysis } from "../types";

export const analyzeIdleData = async (agents: Agent[]): Promise<AIAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const agentSummary = agents.map(a => ({
    name: a.name,
    queue: a.queue,
    idleTime: a.idleMinutes,
    status: a.routingStatus,
    score: a.efficiencyScore
  }));

  const prompt = `
    Analyze the following Genesys Cloud CX agent activity data:
    ${JSON.stringify(agentSummary)}
    
    Provide a detailed analysis including:
    1. A concise summary of the current floor state.
    2. Specific recommendations to reduce idle time.
    3. Potential bottlenecks or agents needing intervention.
    
    Respond in strict JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            bottlenecks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "recommendations", "bottlenecks"]
        }
      }
    });

    return JSON.parse(response.text) as AIAnalysis;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      summary: "Error generating AI analysis. Please check your API configuration.",
      recommendations: ["Ensure agents are properly logging off", "Check queue assignments"],
      bottlenecks: ["Data analysis unavailable"]
    };
  }
};
