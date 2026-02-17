import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question } from '../types';

const getAi = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not set");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fallback questions
const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'f1',
    text: "איזה בעל חיים ידוע בכך שיש לו אישונים מלבניים?",
    correctAnswer: "עז",
    options: [
        {id: 'f1-1', text: 'עז', authorId: 'SYSTEM'},
        {id: 'f1-2', text: 'חתול', authorId: 'SYSTEM'},
        {id: 'f1-3', text: 'נחש', authorId: 'SYSTEM'},
        {id: 'f1-4', text: 'סוס', authorId: 'SYSTEM'}
    ],
    category: "חיות"
  },
  {
    id: 'f2',
    text: "מה היה הצעצוע הראשון שפורסם בטלוויזיה?",
    correctAnswer: "מר תפוח אדמה",
    options: [
        {id: 'f2-1', text: 'מר תפוח אדמה', authorId: 'SYSTEM'},
        {id: 'f2-2', text: 'ברבי', authorId: 'SYSTEM'},
        {id: 'f2-3', text: 'לגו', authorId: 'SYSTEM'},
        {id: 'f2-4', text: 'מונופול', authorId: 'SYSTEM'}
    ],
    category: "היסטוריה"
  }
];

export const generateQuestions = async (topic: string, count: number, mode: 'CLASSIC' | 'BLUFF'): Promise<Question[]> => {
  const ai = getAi();
  if (!ai) return FALLBACK_QUESTIONS.slice(0, count);

  try {
    const isClassic = mode === 'CLASSIC';
    
    const prompt = `Generate ${count} trivia questions in Hebrew about "${topic}". 
    ${isClassic 
      ? 'Mode: Classic Multiple Choice. Provide the correct answer and 3 distinct, plausible incorrect options (distractors).' 
      : 'Mode: Bluff. Provide ONLY the correct answer. The question should be obscure enough for players to invent fake answers.'}
    `;

    const questionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text in Hebrew" },
        correctAnswer: { type: Type.STRING, description: "The correct answer in Hebrew" },
        wrongOptions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Exactly 3 wrong options in Hebrew (Required for Classic mode, empty for Bluff)" 
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
    
    return rawData.map((q: any, index: number) => {
        // Construct options for Classic mode immediately so they are ready for the server
        let options: any[] = [];
        
        if (isClassic) {
             options = [
                { id: `q${index}-real`, text: q.correctAnswer, authorId: 'SYSTEM' },
                ...(q.wrongOptions || ["אופציה 1", "אופציה 2", "אופציה 3"]).slice(0, 3).map((opt: string, i: number) => ({
                    id: `q${index}-wrong-${i}`,
                    text: opt,
                    authorId: 'SYSTEM'
                }))
             ].sort(() => Math.random() - 0.5);
        }

        return {
            id: `gen-${Date.now()}-${index}`,
            text: q.text,
            correctAnswer: q.correctAnswer,
            category: topic,
            options: options // Send prepared options to server
        };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return FALLBACK_QUESTIONS.slice(0, count);
  }
};