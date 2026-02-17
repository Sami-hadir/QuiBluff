import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question } from '../types';

const getAi = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not set");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fallback questions to ensure game works even if AI fails
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
  },
  {
    id: 'f3',
    text: "מהי בירת אוסטרליה?",
    correctAnswer: "קנברה",
    options: [
        {id: 'f3-1', text: 'קנברה', authorId: 'SYSTEM'},
        {id: 'f3-2', text: 'סידני', authorId: 'SYSTEM'},
        {id: 'f3-3', text: 'מלבורן', authorId: 'SYSTEM'},
        {id: 'f3-4', text: 'פרת׳', authorId: 'SYSTEM'}
    ],
    category: "גיאוגרפיה"
  }
];

export const generateQuestions = async (topic: string, count: number, mode: 'CLASSIC' | 'BLUFF'): Promise<Question[]> => {
  const ai = getAi();
  if (!ai) return FALLBACK_QUESTIONS.slice(0, count);

  try {
    const isClassic = mode === 'CLASSIC';
    
    // Strict prompt to ensure 4 options in Classic mode
    const prompt = `Generate ${count} trivia questions in Hebrew about "${topic}". 
    
    MODE: ${isClassic ? 'CLASSIC (Multiple Choice)' : 'BLUFF'}.

    Instructions:
    1. Language: Hebrew only.
    2. Format: JSON array.
    3. If Mode is CLASSIC: You MUST provide 'correctAnswer' AND exactly 3 distinct 'wrongOptions' (distractors). The distractors must be plausible.
    4. If Mode is BLUFF: Provide 'correctAnswer'. 'wrongOptions' can be empty or ignored.
    `;

    const questionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text in Hebrew" },
        correctAnswer: { type: Type.STRING, description: "The correct answer in Hebrew" },
        wrongOptions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Exactly 3 distinct plausible wrong options in Hebrew. MANDATORY for Classic mode." 
        }
      },
      required: ["text", "correctAnswer", "wrongOptions"]
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
        let options: any[] = [];
        
        // --- LOGIC FOR CLASSIC MODE OPTIONS ---
        if (isClassic) {
             // 1. Get distractors (ensure we have 3)
             const distractors = (q.wrongOptions && Array.isArray(q.wrongOptions) && q.wrongOptions.length >= 3) 
                ? q.wrongOptions.slice(0, 3) 
                : ["אופציה 1", "אופציה 2", "אופציה 3"]; // Fail-safe

             // 2. Combine Correct + Distractors
             const rawOptions = [
                 { text: q.correctAnswer, isCorrect: true },
                 ...distractors.map((t: string) => ({ text: t, isCorrect: false }))
             ];

             // 3. Shuffle Options
             rawOptions.sort(() => Math.random() - 0.5);

             // 4. Map to AnswerOption format expected by Server/UI
             options = rawOptions.map((opt: any, i: number) => ({
                 id: `q${index}-opt${i}-${opt.isCorrect ? 'c' : 'w'}`, // unique ID
                 text: opt.text,
                 authorId: 'SYSTEM' // System generated
             }));
        }

        return {
            id: `gen-${Date.now()}-${index}`,
            text: q.text,
            correctAnswer: q.correctAnswer,
            category: topic,
            options: options // This array is now ready for Classic mode rendering
        };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return FALLBACK_QUESTIONS.slice(0, count);
  }
};