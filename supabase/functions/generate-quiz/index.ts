import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: string;
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, topic, studentLevel } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    console.log("Generating quiz for topic:", topic);
    console.log("Student level:", studentLevel);
    console.log("Chat messages count:", messages?.length || 0);

    // Build context from chat messages
    const chatContext = messages
      ?.filter((m: ChatMessage) => m.role === "user" || m.role === "assistant")
      .map((m: ChatMessage) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(-4000); // Limit context size

    const systemPrompt = `You are an adaptive quiz generator for Indian students. Generate quiz questions based on the study session conversation.

IMPORTANT RULES:
1. Generate exactly 10-15 questions (adaptive based on conversation depth)
2. Questions should be based ONLY on what was discussed in the chat
3. Mix question types: MCQ (multiple choice), True/False, Fill in blanks, Short answer
4. Difficulty should match student's level: ${studentLevel || "average"}
5. Questions should test understanding, not just memory
6. Include Hinglish phrases naturally (like "Ye concept samjha?")
7. Make questions engaging and relatable

OUTPUT FORMAT (strictly JSON):
{
  "questions": [
    {
      "id": 1,
      "type": "mcq" | "true_false" | "fill_blank" | "short_answer",
      "question": "Question text in Hinglish",
      "options": ["A", "B", "C", "D"] (only for mcq),
      "correct_answer": "The correct answer",
      "explanation": "Brief explanation in Hinglish",
      "difficulty": "easy" | "medium" | "hard",
      "topic": "Specific topic being tested"
    }
  ],
  "total_questions": number,
  "topics_covered": ["topic1", "topic2"],
  "difficulty_distribution": {"easy": n, "medium": n, "hard": n}
}

CHAT CONTEXT:
${chatContext || "General study session on " + (topic || "various topics")}

Generate adaptive questions now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate quiz questions for the study session on "${topic || 'General Study'}". The student's understanding level is ${studentLevel || 'average'}.` }
        ],
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error("No response content from AI:", data);
      throw new Error("No response from AI");
    }

    console.log("Quiz generation response received");

    // Extract JSON from response
    let quizData;
    try {
      // Try to find JSON in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("Failed to parse quiz JSON:", e);
      // Generate fallback questions
      quizData = {
        questions: [
          {
            id: 1,
            type: "mcq",
            question: `${topic || "Is session"} ke baare mein sabse important point kya hai?`,
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct_answer: "Option A",
            explanation: "Ye session ka main concept hai.",
            difficulty: "medium",
            topic: topic || "General"
          }
        ],
        total_questions: 1,
        topics_covered: [topic || "General"],
        difficulty_distribution: { easy: 0, medium: 1, hard: 0 }
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        quiz: quizData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Quiz generation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});