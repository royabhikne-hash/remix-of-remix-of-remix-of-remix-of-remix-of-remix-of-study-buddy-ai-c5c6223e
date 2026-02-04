import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting (per isolate)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `chat:${userId}`;
  const limit = rateLimits.get(key);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
}

interface StudentContext {
  studentClass?: string;
  board?: string;
  subject?: string;
  chapter?: string;
}

const buildSystemPrompt = (
  pastSessions: any[], 
  weakAreas: string[], 
  strongAreas: string[], 
  currentTopic: string = "",
  studentContext: StudentContext = {}
) => {
  let personalizedContext = "";
  
  if (pastSessions.length > 0) {
    const recentTopics = [...new Set(pastSessions.slice(0, 10).map(s => s.topic))].slice(0, 5);
    personalizedContext = `
STUDENT'S LEARNING HISTORY:
- Recent topics studied: ${recentTopics.join(", ") || "None yet"}
- Weak areas needing revision: ${weakAreas.join(", ") || "None identified yet"}
- Strong areas: ${strongAreas.join(", ") || "None identified yet"}
- Total sessions: ${pastSessions.length}

Use this history to:
1. Reference previously studied topics when relevant
2. Suggest revising weak areas when appropriate
3. Build on strong areas to boost confidence
4. Provide personalized study recommendations
`;
  }

  // Student context from profile
  const studentInfo = studentContext.studentClass || studentContext.board ? `
STUDENT PROFILE (VERIFIED):
- Class: ${studentContext.studentClass || "Not specified"}
- Board: ${studentContext.board || "Not specified"}
${studentContext.subject ? `- Subject: ${studentContext.subject}` : ""}
${studentContext.chapter ? `- Active Chapter: ${studentContext.chapter}` : ""}
` : "";

  // Chapter-focused instruction
  const chapterInstruction = studentContext.chapter ? `
CRITICAL CHAPTER RESTRICTION - STRICT ENFORCEMENT:
You are ONLY allowed to teach "${studentContext.chapter}" for ${studentContext.subject || "this subject"}.

STRICT RULES:
1. If question is about "${studentContext.chapter}" - Answer it fully, helpfully, with examples
2. If question is OUTSIDE "${studentContext.chapter}":
   - DO NOT answer it at all
   - Politely say: "Ye question ${studentContext.chapter} ke bahar hai. Aapka current chapter ${studentContext.chapter} hai."
   - Redirect: "Chalo ${studentContext.chapter} pe focus karte hain. Ismein kya doubt hai?"
3. If student asks about different subject or class level:
   - Say: "Aap Class ${studentContext.studentClass || ""} ${studentContext.board || ""} ${studentContext.subject || ""} - ${studentContext.chapter} padh rahe hain. Please isi chapter se question pucho."
4. NEVER explain content from other chapters, subjects, or class levels
5. ALL examples, questions, explanations MUST be from "${studentContext.chapter}" only
` : "";

  const topicInstruction = currentTopic ? `
CURRENT STUDY TOPIC: ${currentTopic}
CRITICAL: Stay focused ONLY on "${currentTopic}". 
- DO NOT mix subjects (no biology if studying physics)
- If student asks about different subject, acknowledge but bring them back to ${currentTopic}
- All examples and explanations should be ONLY about ${currentTopic}
` : "";

  return `You are Study Buddy AI - a friendly and helpful personal tutor for Indian school students.
You help students with ANY study-related question they have. No topic restrictions!

${studentInfo}
${topicInstruction}

OPEN LEARNING - NO RESTRICTIONS:
- Students can freely ask about ANY subject, ANY topic, ANY chapter
- Help with homework, doubts, exam prep, concepts - anything study-related
- If student asks about Physics, help with Physics
- If student asks about History, help with History
- If student switches topics mid-conversation, that's perfectly fine!
- Be flexible and helpful with whatever they want to learn

TEACHING APPROACH:
- Teach at the student's class level (${studentContext.studentClass || "their level"})
- Adjust difficulty based on their board (${studentContext.board || "their board"})
- Simple Hinglish (Hindi-English mix)
- Step-by-step explanations with examples
- Practice questions when helpful
- Respectful tone (always "aap", "ji")

AFTER EXPLAINING:
Ask: "Samajh aa gaya? Koi aur doubt hai?"

WHAT TO AVOID:
- Non-study topics (games, movies, personal chat)
- Wrong or misleading information
- Being disrespectful

For non-study questions, politely say: "Main aapka study buddy hoon! Padhai se related kuch bhi pucho, main help karunga."

LANGUAGE RULES:
- ALWAYS use "aap" (respectful), never "tum/tu"
- Warm phrases: "Ji", "Dekhiye", "Samjhiye", "Bilkul sahi", "Bahut accha!"
- Encouraging and supportive

FORMATTING - PLAIN TEXT ONLY:
- NO markdown (no asterisks, underscores, backticks, hash)
- Write like WhatsApp chat
- Natural, conversational style

ANSWER EVALUATION:
- Accept answers with same meaning, different words
- Focus on concept understanding
- Be flexible with spelling mistakes
- Encourage partial correct answers

${personalizedContext}

YOUR GOAL: Help students learn anything they want to study. Be their supportive study partner!

Keep responses under 150 words. Be encouraging and helpful.`
};

interface ChatMessage {
  role: string;
  content: string;
  imageUrl?: string;
}

interface AIMessage {
  role: string;
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studentId, analyzeSession, currentTopic, studentContext, subject, chapter, studentClass, studentBoard } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Rate limit check
    if (studentId && !checkRateLimit(studentId)) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please wait a moment before sending more messages.",
          response: "Thoda ruko ji! Bahut fast messages aa rahe hain. Ek minute mein try karo. 🙏"
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing study chat request with", messages?.length || 0, "messages");

    // Fetch student's past sessions and profile for personalization
    let pastSessions: any[] = [];
    let weakAreas: string[] = [];
    let strongAreas: string[] = [];
    let studentProfile: StudentContext = studentContext || {
      subject: subject,
      chapter: chapter,
      studentClass: studentClass,
      board: studentBoard
    };

    if (studentId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch student profile if not provided
        if (!studentContext?.studentClass) {
          const { data: student } = await supabase
            .from("students")
            .select("class, board")
            .eq("id", studentId)
            .single();
          
          if (student) {
            studentProfile.studentClass = student.class;
            studentProfile.board = student.board;
          }
        }

        const { data: sessions } = await supabase
          .from("study_sessions")
          .select("topic, subject, understanding_level, weak_areas, strong_areas, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (sessions) {
          pastSessions = sessions;
          
          // Aggregate weak and strong areas
          const weakSet = new Set<string>();
          const strongSet = new Set<string>();
          
          sessions.forEach(s => {
            (s.weak_areas || []).forEach((a: string) => weakSet.add(a));
            (s.strong_areas || []).forEach((a: string) => strongSet.add(a));
          });
          
          weakAreas = [...weakSet].slice(0, 5);
          strongAreas = [...strongSet].slice(0, 5);
        }

        console.log("Loaded student history:", { 
          sessions: pastSessions.length, 
          weakAreas, 
          strongAreas,
          studentProfile
        });
      } catch (err) {
        console.error("Error fetching student history:", err);
      }
    }

    // Build personalized system prompt with current topic and student context
    const systemPrompt = buildSystemPrompt(pastSessions, weakAreas, strongAreas, currentTopic || "", studentProfile);

    // Add analysis instruction if requested
    const analysisInstruction = analyzeSession ? `

IMPORTANT: At the end of your response, include a JSON analysis block in this exact format:
[ANALYSIS]{"understanding":"weak|average|good|excellent","topics":["topic1","topic2"],"weakAreas":["area1"],"strongAreas":["area1"]}[/ANALYSIS]

Analyze the student's understanding based on:
- Their questions (confused = weak, specific = good)
- Clarity of their responses
- Whether they're grasping concepts
Keep topics short (2-3 words max).` : "";

    // Build messages array
    const chatMessages: AIMessage[] = [
      { role: "system", content: systemPrompt + analysisInstruction },
    ];

    // Add conversation history (limit to last 6 messages for speed)
    if (messages && Array.isArray(messages)) {
      const recentMessages = messages.slice(-6);
      for (const msg of recentMessages as ChatMessage[]) {
        if (msg.imageUrl) {
          chatMessages.push({
            role: msg.role,
            content: [
              { type: "text", text: msg.content || "Please analyze this image from my study materials." },
              { type: "image_url", image_url: { url: msg.imageUrl } }
            ]
          });
        } else {
          chatMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // Use Gemini 3.0 Flash as primary model
    const PRIMARY_MODEL = "google/gemini-3-flash-preview";
    const FALLBACK_MODEL = "google/gemini-2.5-flash";

    const callLovableAI = async (model: string) => {
      console.log(`Calling Lovable AI with model: ${model}`);

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 800,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("AI gateway error:", resp.status, errorText);

        if (resp.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (resp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(`AI service error: ${resp.status}`);
      }

      const data = await resp.json();
      return { data };
    };

    let data: any;

    // Primary call (Gemini Flash - faster)
    {
      const result = await callLovableAI(PRIMARY_MODEL);
      if (result instanceof Response) return result;
      data = result.data;
    }

    let aiResponse = data?.choices?.[0]?.message?.content;

    // Fallback if empty
    if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
      console.error("No response content from primary AI, trying fallback");

      const result2 = await callLovableAI(FALLBACK_MODEL);
      if (result2 instanceof Response) return result2;

      const data2 = result2.data;
      aiResponse = data2?.choices?.[0]?.message?.content;

      if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
        console.error("No response content from fallback AI");
        throw new Error("No response from AI");
      }
    }

    console.log("AI response received successfully");

    // Extract analysis from response if present
    let sessionAnalysis = null;
    if (analyzeSession) {
      const analysisMatch = aiResponse.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
      if (analysisMatch) {
        try {
          sessionAnalysis = JSON.parse(analysisMatch[1]);
          // Remove analysis block from displayed response
          aiResponse = aiResponse.replace(/\[ANALYSIS\].*?\[\/ANALYSIS\]/s, "").trim();
        } catch (e) {
          console.error("Failed to parse analysis:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        sessionAnalysis,
        studentHistory: {
          recentTopics: pastSessions.slice(0, 5).map(s => s.topic),
          weakAreas,
          strongAreas
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Study chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred",
        response: "Oops! Kuch technical problem ho gaya. Thodi der baad try karo! 🙏"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});