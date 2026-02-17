import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question } from '../types';

const getAi = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not set");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fallback questions if API fails or no key - Translated to Hebrew
const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'f1',
    text: "איזה בעל חיים ידוע בכך שיש לו אישונים מלבניים?",
    correctAnswer: "עז",
    options: [],
    category: "חיות"
  },
  {
    id: 'f2',
    text: "מה היה הצעצוע הראשון שפורסם בטלוויזיה?",
    correctAnswer: "מר תפוח אדמה",
    options: [],
    category: "היסטוריה"
  },
  {
    id: 'f3',
    text: "במדינת ג'ורג'יה, לא חוקי לאכול את המאכל הזה עם מזלג?",
    correctAnswer: "עוף מטוגן",
    options: [],
    category: "חוקים"
  }
];

export const generateQuestions = async (topic: string, count: number, mode: 'CLASSIC' | 'BLUFF'): Promise<Question[]> => {
  const ai = getAi();
  if (!ai) return FALLBACK_QUESTIONS.slice(0, count);

  try {
    // Updated prompt for Hebrew content
    const prompt = `Generate ${count} trivia questions in Hebrew about "${topic}". 
    ${mode === 'BLUFF' 
      ? 'The questions should be obscure, open-ended enough that players can invent plausible fake answers. Only provide the correct answer.' 
      : 'Provide the correct answer and 3 incorrect but plausible options.'}
    `;

    const questionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text in Hebrew" },
        correctAnswer: { type: Type.STRING, description: "The correct answer in Hebrew" },
        wrongOptions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3 wrong options in Hebrew (only if Classic mode, otherwise empty array)" 
        }
      },
      required: ["text", "correctAnswer"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: questionSchema
        }
      }
    });

    if (!response.text) throw new Error("No response from AI");

    const rawData = JSON.parse(response.text);
    
    return rawData.map((q: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      text: q.text,
      correctAnswer: q.correctAnswer,
      category: topic,
      options: mode === 'CLASSIC' ? [
          { id: 'correct', text: q.correctAnswer, authorId: 'SYSTEM' },
          ...(q.wrongOptions || []).map((opt: string, i: number) => ({ id: `wrong-${i}`, text: opt, authorId: 'SYSTEM' }))
      ].sort(() => Math.random() - 0.5) : []
    }));

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return FALLBACK_QUESTIONS.slice(0, count);
  }
};