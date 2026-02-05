
import { GoogleGenAI, Type } from "@google/genai";
import { Question, UserAnswer, GroundingLink } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIExplanationResult {
  text: string;
  links?: GroundingLink[];
}

// Utility to clean markdown fences from JSON responses
const cleanJsonOutput = (text: string): string => {
  // Remove markdown code fences
  let clean = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '');
  
  // Extract JSON object if wrapped in filler text
  const firstOpen = clean.indexOf('{');
  const lastClose = clean.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    clean = clean.substring(firstOpen, lastClose + 1);
  }
  
  return clean;
};

export const getAIExplanation = async (question: Question, userAnswer?: string | string[] | null, useWebSearch: boolean = false): Promise<AIExplanationResult> => {
  try {
    const prompt = `
      You are an expert CISSP instructor and mentor. 
      A student is practicing for their exam and needs a deep conceptual explanation for the following question.
      
      QUESTION: ${question.question_text}
      CHOICES: ${JSON.stringify(question.choices)}
      CORRECT ANSWER: ${question.correct_answer}
      STUDENT ANSWER: ${userAnswer || "None provided"}
      DATABASE EXPLANATION: ${question.explanation}
      DOMAIN: ${question.domain} / ${question.subDomain}
      
      ${useWebSearch ? "CRITICAL: The student has requested a REAL-TIME WEB VERIFICATION. Use Google Search to verify if the technical details in this question/explanation match the LATEST 2024/2025 CISSP exam objectives and security standards (e.g., NIST, ISO, GDPR). If the database info is outdated, point it out explicitly." : ""}

      Please provide:
      1. A simplified "In Plain English" summary of the core concept.
      2. Why the correct answer is right and why the specific student answer (if provided and incorrect) was wrong.
      3. A real-world scenario illustrating this principle.
      4. A "Memory Hook" or mnemonic to remember this concept.
      
      Keep the tone encouraging, professional, and concise. Format with clear headings and bullet points.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 6000,
        thinkingConfig: { thinkingBudget: 4000 },
        tools: useWebSearch ? [{ googleSearch: {} }] : []
      }
    });

    const text = response.text || "No explanation generated.";
    const links: GroundingLink[] = [];

    // Extract grounding links if present
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          links.push({ uri: chunk.web.uri, title: chunk.web.title });
        }
      });
    }

    return { text, links: links.length > 0 ? links : undefined };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { text: "I'm sorry, I couldn't generate an AI explanation right now. Please rely on the provided database explanation." };
  }
};

export const getAIStudyPlan = async (answers: UserAnswer[]) => {
  try {
    const performanceData = answers.map(a => ({
      domain: a.question.domain,
      subDomain: a.question.subDomain,
      isCorrect: a.isCorrect,
      confidence: a.confidence,
      isSkipped: a.isSkipped
    }));

    const prompt = `
      You are an expert CISSP Study Coach. Analyze the following quiz results and create a personalized study plan.
      
      RESULTS: ${JSON.stringify(performanceData)}
      
      Please provide a structured response in JSON format with the following keys:
      - "overallAssessment": A brief summary of the user's current readiness.
      - "topWeaknesses": An array of the top 3 domains or subdomains to focus on, with a brief reason why for each.
      - "studyStrategy": 3 actionable steps to improve before the next session.
      - "encouragement": A motivational closing sentence.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: { type: Type.STRING },
            topWeaknesses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["topic", "reason"]
              }
            },
            studyStrategy: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            encouragement: { type: Type.STRING }
          },
          required: ["overallAssessment", "topWeaknesses", "studyStrategy", "encouragement"]
        }
      }
    });

    const rawText = response.text || "{}";
    const cleanedText = cleanJsonOutput(rawText);
    return JSON.parse(cleanedText);

  } catch (error: any) {
    console.error("Gemini Study Plan Error:", error);
    // Return graceful fallback
    return {
      overallAssessment: "Could not generate AI analysis due to a parsing error.",
      topWeaknesses: [],
      studyStrategy: ["Please try again in a few moments."],
      encouragement: "Keep studying!"
    };
  }
};

export const getAIContextualAnalysis = async (answers: UserAnswer[]) => {
  try {
    // Filter for friction points (incorrect or low/medium confidence)
    const frictionPoints = answers.filter(a => !a.isCorrect || a.confidence !== 'high').map(a => ({
      text: a.question.question_text,
      explanation: a.question.explanation,
      domain: a.question.domain,
      subDomain: a.question.subDomain,
      topic: a.question.topic,
      isCorrect: a.isCorrect,
      confidence: a.confidence
    }));

    if (frictionPoints.length === 0) return null;

    const prompt = `
      You are an elite CISSP diagnostician. Your task is to perform "Contextual Cross-Referencing" on a student's mistakes.
      Look beyond simple Domain labels and identify the semantic "connective tissue" or "friction points" that are causing errors.
      
      DATA: ${JSON.stringify(frictionPoints)}
      
      Provide a response with:
      1. "The Root Misconception": A clear description of the specific technical link or conceptual thread the student is misunderstanding (e.g., "Confusion between Authorization vs. Authentication flows in SAML").
      2. "Evidence": Briefly reference 2-3 specific questions from the data that prove this pattern exists.
      3. "The 'Mental Pivot'": A specific shift in thinking required to resolve this pattern.
      
      Format with clean, professional Markdown. Use bolding for emphasis. Keep it targeted and impactful.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini Contextual Analysis Error:", error);
    return null;
  }
};
