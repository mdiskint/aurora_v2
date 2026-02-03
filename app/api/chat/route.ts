import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { callGemini, callGeminiWithSearch } from '@/lib/gemini';

export const maxDuration = 300;

const MODEL_CONFIG = {
  high: {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
  },
  low: {
    anthropic: 'claude-3-5-haiku-20241022',
    openai: 'gpt-4o-mini',
  }
};

async function safeAICall(anthropic: Anthropic, openai: OpenAI, params: any, complexity: 'high' | 'low' = 'high') {
  const modelToUse = complexity === 'high' ? MODEL_CONFIG.high : MODEL_CONFIG.low;
  const currentParams = { ...params, model: modelToUse.anthropic };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log(`🤖 Attempting Anthropic call (${complexity} tier: ${modelToUse.anthropic})...`);
      return await anthropic.messages.create(currentParams);
    } catch (error: any) {
      console.error('❌ Anthropic failed:', error.message);
      if (!process.env.OPENAI_API_KEY) throw error;
      console.log(`🔄 Fallback condition met, switching to OpenAI (${modelToUse.openai})...`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    console.log(`🚀 Executing OpenAI fallback (${modelToUse.openai})...`);
    const completion = await openai.chat.completions.create({
      model: modelToUse.openai,
      messages: [
        ...(params.system ? [{ role: "system", content: params.system }] : []),
        ...params.messages
      ],
      max_tokens: params.max_tokens,
      temperature: params.temperature || 0.7,
    });

    return {
      content: [{ type: 'text', text: completion.choices[0].message.content || '' }]
    };
  }

  throw new Error('No valid AI provider key available');
}

export async function POST(request: NextRequest) {
  try {
    // Force rebuild
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('❌ No API keys defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('✅ API key found, initializing clients');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'missing',
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const body = await request.json();
    console.log('📦 Full request body:', JSON.stringify(body, null, 2));

    const { messages, conversationContext, mode, explorationMode, previousQuestions, conversationHistory, nodeDepth } = body;
    console.log('📨 Message count:', messages?.length);
    console.log('🧠 Has context:', !!conversationContext);
    console.log('🌌 Mode:', mode);
    console.log('🎓 Exploration Mode:', explorationMode);
    console.log('📋 Previous questions:', previousQuestions?.length || 0);
    console.log('📚 Conversation history:', conversationHistory?.length || 0);

    // 🧠 GAP modes use different request structure (question + graphStructure)
    // Skip messages validation for GAP modes
    const isGapMode = mode === 'gap-analyze' || mode === 'gap-parallel' || mode === 'gap-single' || mode === 'gap-synthesize';

    let userMessage: string;

    if (isGapMode) {
      // GAP modes don't use messages array, skip validation
      console.log('🧠 GAP mode detected, skipping messages validation');
      userMessage = ''; // Will be populated by GAP mode handlers
    } else {
      // Standard modes require messages array
      if (messages && Array.isArray(messages) && messages.length > 0) {
        userMessage = messages[messages.length - 1].content;
        console.log('📨 Extracted from messages array:', userMessage);
      } else {
        console.error('❌ No valid message found in request');
        return NextResponse.json(
          { error: 'Message is required' },
          { status: 400 }
        );
      }

      if (!userMessage || userMessage.trim() === '') {
        console.error('❌ Message is empty');
        return NextResponse.json(
          { error: 'Message cannot be empty' },
          { status: 400 }
        );
      }
    }

    // 🌌 SPATIAL MODE: Explicitly triggered by mode parameter
    const isSpatialMode = mode === 'spatial';

    if (isSpatialMode) {
      console.log('🌌 SPATIAL MODE ACTIVATED - Generating universe structure');

      // Use full message for topic
      const userTopic = userMessage;

      console.log('🎯 Topic for universe:', userTopic);


      // 🔍 CHECK FOR MANUAL MODE: User provided ** structure
      if (userTopic.includes('**')) {
        console.log('✋ MANUAL MODE: Parsing ** delimiters');
        console.log('📝 Raw input:', userTopic);

        const sections = userTopic.split('**').filter(s => s.trim());
        console.log('📊 Split sections:', sections.length, sections);

        if (sections.length < 2) {
          console.error('❌ Invalid ** format: need at least nexus title and one node');
          return NextResponse.json(
            { error: 'Manual mode requires at least: **Nexus Title **Node 1 content' },
            { status: 400 }
          );
        }

        // First section = Nexus ONLY
        const nexus = sections[0].trim();
        // Remaining sections = Nodes ONLY (excludes first section)
        const nodeContents = sections.slice(1).map(s => s.trim());

        console.log('🏛️ Nexus section (index 0):', nexus);
        console.log('📦 Node sections (index 1+):', nodeContents);

        // Enrich each node with Gemini + Google Search grounding
        console.log('🔍 Enriching nodes with cross-references and Google Search grounding...');

        const enrichedNodes = await Promise.all(
          nodeContents.map(async (content, idx) => {
            const siblingContext = nodeContents
              .filter((_, i) => i !== idx)
              .map(s => `- ${s.substring(0, 150)}`)
              .join('\n');

            const depth = typeof nodeDepth === 'number' ? nodeDepth : 1;
            const useWebSearch = depth >= 2;

            const enrichPrompt = useWebSearch
              ? `You are enriching a node in a learning universe.

Universe Topic: "${nexus}"

THIS NODE's raw content:
"${content}"

SIBLING NODES in the same universe:
${siblingContext}

Your task: Expand and enrich this node's content by:
1. Adding depth and detail to the core concept (2-3 paragraphs)
2. Referencing connections to sibling nodes where relevant
3. Including any current real-world context or recent developments (use your search capability)
4. Adding concrete examples or applications

Return ONLY the enriched content text. No JSON, no formatting instructions, no preamble.`
              : `You are enriching a node in a learning universe.

Universe Topic: "${nexus}"

THIS NODE's raw content:
"${content}"

SIBLING NODES in the same universe:
${siblingContext}

Your task: Expand and enrich this node's content by:
1. Adding depth and detail to the core concept (2-3 paragraphs)
2. Referencing connections to sibling nodes where relevant
3. Adding concrete examples or applications

Do NOT use web search or external sources. Generate content purely from the conversation context and the user's input.

Return ONLY the enriched content text. No JSON, no formatting instructions, no preamble.`;

            const systemPrompt = useWebSearch
              ? 'You are an expert educator enriching learning content. Add depth, cross-references to sibling topics, and current real-world context using web search. Be concise but substantive.'
              : 'You are an expert educator enriching learning content. Add depth, cross-references to sibling topics, and concrete examples. Do NOT use web search or external sources. Generate content purely from the provided context. Be concise but substantive.';

            try {
              const enriched = await callGeminiWithSearch(
                enrichPrompt,
                systemPrompt
              );
              console.log(`   ✅ Node ${idx + 1} enriched (${enriched.length} chars)`);
              return { content: enriched || content };
            } catch (error: any) {
              console.error(`   ❌ Node ${idx + 1} enrichment failed:`, error.message);
              return { content };
            }
          })
        );

        const spatialData = {
          nexusTitle: nexus.substring(0, 50),
          nexusContent: nexus,
          nodes: enrichedNodes
        };

        console.log('✅ Parsed and enriched manual structure:');
        console.log(`   - Nexus: "${spatialData.nexusTitle}"`);
        console.log(`   - Nodes: ${spatialData.nodes.length} (Gemini-enriched with Google Search grounding)`);

        return NextResponse.json({
          response: `Created manual universe with ${spatialData.nodes.length} enriched nodes`,
          spatialData
        });
      }

      // 🤖 AI MODE: Generate structure automatically
      console.log('🤖 AI MODE: Generating universe structure');

      const spatialPrompt = `User wants to explore: "${userTopic}"

CRITICAL: Ignore any formatting (numbers, bullet points, dashes) in the user's input. Treat the ENTIRE text as ONE TOPIC to explore and break down into your own logical subtopics.

You will create a Leopold Teaching Doctrine structure with ATOMIZED PRACTICE NODES for each doctrine (concept).

Assess the topic and decide 2-8 core doctrines (learning concepts) based on:
- How many fundamental principles or concepts does this topic contain?
- Simple topics (e.g., "primary colors"): 2-3 doctrines
- Medium complexity (e.g., "photosynthesis"): 3-5 doctrines
- Complex topics (e.g., "quantum mechanics"): 6-8 doctrines

For EACH doctrine, create 5 atomized practice children following Leopold Teaching methodology:
1. **intuition-example**: A concrete, relatable example to build intuition (2-3 sentences)
2. **model-answer**: Show the correct reasoning pattern or approach (2-3 sentences)
3. **imitate**: A practice prompt where students apply the pattern ("Now you try...")
4. **quiz-mc**: A multiple choice question testing understanding
5. **synthesis**: A real-world application scenario that serves as synthesis/reflection (3-4 sentences combining all previous concepts)

NOTE: These children are METADATA for guided practice. They will NOT be created as nodes initially - only when the student completes each practice step.

Format your response as VALID JSON (and ONLY JSON, no other text):
{
  "nexusTitle": "brief title (3-7 words)",
  "nexusContent": "overview paragraph explaining the topic",
  "nodes": [
    {
      "content": "Doctrine 1 Title\\n\\nCore concept explanation (2-3 sentences)",
      "nodeType": "doctrine",
      "children": [
        {"content": "Concrete example to build intuition...", "nodeType": "intuition-example"},
        {"content": "Here's the correct reasoning pattern...", "nodeType": "model-answer"},
        {"content": "Now you try: Apply this pattern to...", "nodeType": "imitate"},
        {"content": "Question: ...", "nodeType": "quiz-mc", "options": ["A", "B", "C", "D"], "correctOption": "B"},
        {"content": "Real-world application scenario combining all concepts: ...", "nodeType": "synthesis"}
      ]
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Use \\n for line breaks within strings (NOT literal newlines)
- Create 2-8 doctrine nodes, each with exactly 5 atomized children
- Each child must have explicit "nodeType" field
- DO NOT create one node per line from user input - create your own logical doctrines
- The "synthesis" step is now the final application scenario that synthesizes all learning`;

      console.log('📤 Sending spatial universe generation prompt...');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192, // Increased to handle atomized children
        system: 'You are Astryon AI, a Leopold Teaching Doctrine architect. Generate structured learning universes with atomized practice nodes. For each core concept (doctrine), create 5 practice children: intuition-example, model-answer, imitate, quiz-mc, and synthesis (which combines application scenario with reflection). Always return ONLY valid JSON with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: spatialPrompt }],
      }, 'low');

      console.log('✅ Got response from Claude');

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('📝 Raw AI response:', rawResponse);

      try {
        // Sanitize JSON: Try parsing as-is first, then with cleanup if needed
        // Updated: Fixed regex pattern for newline handling
        let spatialData;
        try {
          spatialData = JSON.parse(rawResponse);
        } catch (firstError) {
          console.log('⚠️ Initial parse failed, attempting cleanup...');

          // Extract JSON from markdown code blocks if present
          let cleanedResponse = rawResponse.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```$/, '');
          }

          // 🔥 FIX: Sanitize literal newlines in JSON strings
          // Replace literal newlines inside JSON string values with escaped \n
          console.log('🧹 Sanitizing literal newlines in JSON...');

          // Strategy: Replace newlines inside quoted strings only
          // Use a more robust regex that handles newlines within strings
          cleanedResponse = cleanedResponse.replace(
            /"((?:[^"\\]|\\.)*)"/g,  // Match string values with proper escaping
            (match) => {
              return match
                .replace(/\r\n/g, '\\n')  // Windows line endings
                .replace(/\n/g, '\\n')    // Unix line endings
                .replace(/\r/g, '\\n')    // Old Mac line endings
                .replace(/\t/g, '\\t');   // Tabs
            }
          );

          console.log('🧹 Cleaned response (first 500 chars):', cleanedResponse.substring(0, 500));

          // Parse the cleaned response
          spatialData = JSON.parse(cleanedResponse);
        }

        console.log('✅ Successfully parsed spatial JSON:', spatialData);

        return NextResponse.json({
          response: `Generated universe for: ${userTopic}`,
          spatialData
        });
      } catch (parseError) {
        console.error('❌ Failed to parse spatial JSON:', parseError);
        console.error('Raw response was:', rawResponse);
        return NextResponse.json(
          { error: 'Failed to parse universe structure from AI' },
          { status: 500 }
        );
      }
    }

    // 🚀 BREAK-OFF MODE: Transform node into new universe
    if (mode === 'break-off') {
      console.log('🚀 BREAK-OFF MODE ACTIVATED - Generating new universe from node');

      const nodeContent = userMessage;
      console.log('📄 Node content:', nodeContent);

      const breakOffPrompt = `A user is breaking off this node into its own universe. The node contains:
"${nodeContent}"

Create a NEW universe that explores this content in depth. Generate a nexus and 5-12 child nodes that comprehensively explore different aspects, subtopics, or implications of this content.

Format your response as VALID JSON (and ONLY JSON, no other text):
{
  "nexusTitle": "brief title (3-7 words) summarizing the new universe",
  "nexusContent": "overview paragraph that expands on the original node content",
  "nodes": [
    {"content": "Subtopic 1: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    {"content": "Subtopic 2: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    ...
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Use \\n for line breaks within strings (NOT literal newlines)
- Each node should be substantive (2-3 sentences minimum)
- Create 5-12 nodes that deeply explore the content`;

      console.log('📤 Sending break-off universe generation prompt...');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are Astryon AI, a universe architect. Generate structured spatial knowledge graphs that explore content deeply. Always return ONLY valid JSON with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: breakOffPrompt }],
      });

      console.log('✅ Got response from Claude for break-off');

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('📝 Raw AI response:', rawResponse);

      try {
        let newUniverse;
        try {
          newUniverse = JSON.parse(rawResponse);
        } catch (firstError) {
          console.log('⚠️ Initial parse failed, attempting cleanup...');

          let cleanedResponse = rawResponse.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```$/, '');
          }

          cleanedResponse = cleanedResponse.replace(
            /"((?:[^"\\]|\\.)*)"/g,
            (match) => {
              return match
                .replace(/\r\n/g, '\\n')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\n')
                .replace(/\t/g, '\\t');
            }
          );

          newUniverse = JSON.parse(cleanedResponse);
        }

        console.log('✅ Successfully parsed break-off universe:', newUniverse);

        return NextResponse.json({
          response: `Generated new universe from node`,
          newUniverse
        });
      } catch (parseError) {
        console.error('❌ Failed to parse break-off JSON:', parseError);
        console.error('Raw response was:', rawResponse);
        return NextResponse.json(
          { error: 'Failed to parse break-off universe structure from AI' },
          { status: 500 }
        );
      }
    }

    // 🧠 DEEP THINKING MODE: Generate exploratory question with progressive depth
    if (mode === 'deep-thinking' && !userMessage.includes('Previous question:')) {
      console.log('🧠 DEEP THINKING: Generating exploratory question with history');
      console.log('📚 Previous rounds:', conversationHistory?.length || 0);

      const deepThinkingQuestionPrompt = `You are a Socratic teacher helping explore ideas deeply.

Content to explore:
"${userMessage}"

${conversationHistory && conversationHistory.length > 0 ? `
Previous exploration:
${conversationHistory.map((exchange: any, i: number) =>
        `Round ${i + 1}:\nQ: ${exchange.question}\nA: ${exchange.userAnswer}\nInsight: ${exchange.aiEngagement}`
      ).join('\n\n')}

Based on where we've been, go DEEPER on the most interesting thread.
` : 'This is the first question - start with what seems most thought-provoking.'}

Your task: Ask ONE exploratory question that:
- Builds on previous insights (if any)
- Challenges assumptions
- Makes unexpected connections
- Reveals deeper patterns
- Encourages novel thinking

${conversationHistory && conversationHistory.length > 0 ? 'Avoid repeating questions or going in circles. Each question should advance the exploration to new territory.' : ''}

Question types to use:
- "What assumptions underlie [X]?"
- "How might [concept from discussion] apply to [new context]?"
- "What patterns emerge when we consider [A] and [B] together?"
- "What happens if we reverse [logic they mentioned]?"
- "What does [their insight] reveal about [bigger principle]?"
- "If we push this further, what questions arise?"

CRITICAL: Output ONLY the question, nothing else. No preamble, no explanation.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: 'You are a Socratic teacher who guides deep exploration through progressively deeper questions. Each question should build on what came before.',
        messages: [{ role: 'user', content: deepThinkingQuestionPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const question = textContent && 'text' in textContent ? textContent.text.trim() : 'Unable to generate question.';

      console.log('✅ Generated deep thinking question:', question.substring(0, 80) + '...');

      return NextResponse.json({
        response: question,
        isDeepThinkingQuestion: true
      });
    }

    // 🧠 DEEP THINKING MODE: Handle conversational Socratic dialogue
    if (mode === 'deep-thinking' && userMessage.includes('Previous question:')) {
      console.log('🧠 DEEP THINKING MODE - Engaging with user\'s thinking');

      const questionMatch = userMessage.match(/Previous question: "(.+?)"/);
      const answerMatch = userMessage.match(/User's answer: "(.+?)"/);

      if (!questionMatch || !answerMatch) {
        console.error('❌ Could not parse deep thinking question/answer');
        return NextResponse.json(
          { error: 'Invalid deep thinking answer format' },
          { status: 400 }
        );
      }

      const question = questionMatch[1];
      const userAnswer = answerMatch[1];

      console.log('❓ Question:', question.substring(0, 50) + '...');
      console.log('✍️ User answer:', userAnswer.substring(0, 50) + '...');

      const deepThinkingPrompt = `You are a Socratic teacher guiding a student through deep exploration and discovery.

${conversationHistory && conversationHistory.length > 0 ? `
Previous exploration rounds:
${conversationHistory.map((exchange: any, i: number) =>
        `Round ${i + 1}:\nQ: ${exchange.question}\nA: ${exchange.userAnswer}\nInsight: ${exchange.aiEngagement}`
      ).join('\n\n')}

` : ''}Your most recent question:
"${question}"

Their latest response:
"${userAnswer}"

Your role:
1. ENGAGE with their thinking (2-4 sentences):
   - Acknowledge interesting insights they've shared
   - Build on their ideas and previous rounds
   - Highlight connections they're making across the conversation
   - Challenge assumptions if needed
   - Show how their thinking is progressing

2. ASK the next exploratory question:
   - Build naturally from what they just said
   - Go deeper on the most interesting thread
   - Help them discover something new
   - Advance to new territory (avoid repeating previous ground)
   - Make it feel like a flowing conversation

Format your response exactly like this:

[Your engagement with their answer - validate, build on, or challenge their thinking. 2-4 sentences.]

[Your next exploratory question that naturally follows from their response and builds on the full conversation.]

Keep it conversational and Socratic - you're exploring ideas together, not testing them.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are a Socratic teacher who engages deeply with student thinking. Build on their insights and guide discovery through thoughtful questions.',
        messages: [{ role: 'user', content: deepThinkingPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const fullResponse = textContent && 'text' in textContent ? textContent.text : 'Unable to continue exploration.';

      console.log('✅ Deep thinking response:', fullResponse.substring(0, 100) + '...');

      return NextResponse.json({
        response: fullResponse,
        isDeepThinking: true
      });
    }

    // 🎓 QUIZ MODE: Generate diverse question (QUESTION ONLY, NO ANSWER)
    if (mode === 'quiz' && !userMessage.includes('Previous question:')) {
      console.log('📝 QUIZ MODE: Generating diverse question (NO ANSWER)');
      console.log('📋 Questions asked so far:', previousQuestions?.length || 0);

      // Check if we've reached completion threshold (7 questions)
      const maxQuestions = 7;
      const questionCount = previousQuestions?.length || 0;
      const hasCompletedCycle = questionCount >= maxQuestions;

      const quizQuestionPrompt = hasCompletedCycle ? `You are a teacher who has just guided a student through comprehensive quiz on content.

The student has answered ${questionCount} questions covering all major aspects!

Your task: Acknowledge their completion warmly and offer to start fresh.

Output exactly this message (customize based on what they covered):

"🎉 Excellent work! You've completed a comprehensive quiz covering all major aspects of this content through ${questionCount} questions.

You've demonstrated understanding of:
• Core facts and details
• Key concepts and definitions
• Reasoning and analysis
• Applications and implications
• Significance and impact

Ready to test your retention? I can start over with fresh questions on the same topics to reinforce your learning.

Would you like to continue with a new quiz cycle?"

Just output this completion message.` : `You are a teacher creating quiz questions to thoroughly test student knowledge.

Content to quiz on:
"${userMessage}"

${previousQuestions && previousQuestions.length > 0 ? `
Previously asked questions (${questionCount}/${maxQuestions} - ask about a DIFFERENT aspect):
${previousQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}
` : 'This is the first question about this content.'}

Your task: Ask ONE clear question that tests a DIFFERENT aspect than previous questions.

For legal content, systematically cover these aspects:
1. **Facts**: What happened? Who were the parties? What was the dispute?
2. **Procedural Posture**: How did the case get to this court?
3. **Holdings**: What did the court decide?
4. **Reasoning**: Why? What was the legal analysis?
5. **Tests/Frameworks**: What legal test was established or applied?
6. **Doctrine**: What principle or rule emerged?
7. **Significance**: Why does this matter? What did it change?
8. **Distinctions**: How does this differ from related cases?
9. **Application**: How would this apply to a hypothetical?

For non-legal content, systematically cover:
- Core concept/definition
- Key components or elements
- How it works (mechanism/process)
- Why it matters (significance/impact)
- Real-world applications
- Common misconceptions
- Historical context
- Relationships to other concepts

Choose the next uncovered aspect and ask a specific, testable question.

CRITICAL RULES:
- Ask ONLY the question - do NOT provide the answer
- Do NOT explain anything - just ask the question
- Do NOT say "Here's a question:" or any preamble
- Make it testable - the student should be able to give a specific answer
- Focus on an aspect different from what's already been asked

Output format: Just the question, nothing else.

Example GOOD output:
"What was Chief Justice Marshall's three-part reasoning in Marbury v. Madison?"

Example BAD output:
"What was the holding? The holding was that judicial review exists because..." ← NO! Don't give the answer!

Now ask your question (QUESTION ONLY, NO ANSWER):`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: hasCompletedCycle ? 500 : 300,  // More tokens for completion message
        system: hasCompletedCycle
          ? 'You are a supportive teacher acknowledging quiz completion. Be warm and encouraging.'
          : 'You are a teacher creating diverse quiz questions. Ask ONLY the question, never provide the answer. Each question should test a different aspect of the content.',
        messages: [{ role: 'user', content: quizQuestionPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const question = textContent && 'text' in textContent ? textContent.text.trim() : 'Unable to generate question.';

      console.log(hasCompletedCycle
        ? '🎉 Generated completion message'
        : `✅ Generated diverse question (${questionCount + 1}/${maxQuestions}):`,
        question.substring(0, 80) + '...');

      return NextResponse.json({
        response: question,
        isQuizQuestion: true,
        isCompletion: hasCompletedCycle,
        questionCount: questionCount
      });
    }

    // 📝 MULTIPLE CHOICE QUIZ MODE: Generate MC questions with JSON
    if (mode === 'quiz-mc') {
      console.log('📝 QUIZ-MC MODE: Generating multiple choice questions');

      const { numberOfQuestions = 5, questionNumber = 1 } = body;
      const userTopic = userMessage;

      // 🎯 RANDOMIZE DIFFICULTY based on question number (UWorld style)
      // Questions 1-2: Easy
      // Questions 3-4: Medium
      // Questions 5+: Hard
      let difficultyLevel: 'easy' | 'medium' | 'hard';
      if (questionNumber <= 2) {
        difficultyLevel = 'easy';
      } else if (questionNumber <= 4) {
        difficultyLevel = 'medium';
      } else {
        difficultyLevel = 'hard';
      }

      console.log(`📊 Question ${questionNumber}: Difficulty = ${difficultyLevel.toUpperCase()}`);

      // Difficulty-specific instructions following UWorld patterns
      const difficultyInstructions = {
        easy: `**EASY DIFFICULTY** (Question ${questionNumber}/5):
- **STRAIGHTFORWARD FACT PATTERN** (1-2 paragraphs, 100-200 words):
  - Simple, clear scenario with essential facts only
  - Limited number of parties or elements
  - Direct application of core principles

- **DIRECT RECALL & BASIC APPLICATION**:
  - Test fundamental understanding of key concepts
  - "What is the rule?" or "What is the basic outcome?"
  - Should be answerable with solid understanding of core material
  - One clearly correct answer based on fundamental principles

- **ANSWER CHOICES**:
  - One obviously correct answer
  - Three plausible but clearly wrong distractors
  - Distractors should test common misconceptions
  - Clear distinctions between options`,

        medium: `**MEDIUM DIFFICULTY** (Question ${questionNumber}/5):
- **MODERATE FACT PATTERN** (2-3 paragraphs, 200-350 words):
  - Realistic scenario with relevant details
  - Multiple parties or elements to consider
  - Some extraneous information mixed with key facts

- **APPLICATION & ANALYSIS**:
  - Require applying principles to moderately complex facts
  - "What is the most likely outcome?" or "Which argument is strongest?"
  - May involve balancing competing considerations
  - Requires distinguishing between closely related concepts

- **ANSWER CHOICES**:
  - Include some partially correct answers as strong distractors
  - Test ability to distinguish between similar principles
  - Options should require careful analysis
  - Two options may seem plausible at first glance`,

        hard: `**HARD DIFFICULTY** (Question ${questionNumber}/5):
- **COMPLEX FACT PATTERN** (3-4 paragraphs, 350-500 words):
  - Multi-layered scenario with intricate details
  - Multiple parties, transactions, or time periods
  - Significant extraneous information to filter through
  - May involve procedural complexities or exceptions

- **MULTI-STEP REASONING & SYNTHESIS**:
  - Require synthesizing multiple concepts or doctrines
  - "Given these facts, what is the best argument?" or "What is the correct legal analysis?"
  - May involve exceptions to general rules
  - Requires nuanced understanding of how principles interact
  - May test edge cases or less obvious applications

- **ANSWER CHOICES**:
  - Multiple answers may appear correct on initial reading
  - Test subtle distinctions between closely related doctrines
  - Include answers that are correct but for wrong reasons
  - Require careful elimination and deep understanding
  - May involve two-step reasoning to identify correct answer`
      };

      const mcQuizPrompt = `Generate exactly ONE UWorld-style multiple choice question about this content:

"${userTopic}"

${difficultyInstructions[difficultyLevel]}

Create an exam-level question that follows these general principles:

1. **GOOD ANSWER CHOICES** (all difficulties):
   - All 4 options should be grammatically parallel and clear
   - Options should be similar in length
   - Test understanding of key distinctions
   - Avoid "all of the above" or "none of the above"

2. **CLEAR EXPLANATIONS**:
   - Explain why the correct answer is right (1-2 sentences)
   - Briefly explain why each other answer is incorrect
   - Reference key facts from the hypothetical
   - Cite relevant legal principles or rules

CRITICAL: You MUST respond in this EXACT format with NO additional text, NO introductions, NO thank you messages:

**Question:**
[The full question text including fact pattern]

**Options:**
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]

**Correct Answer:** [A, B, C, or D - just the letter]

**Explanation:**
[2-4 sentences explaining why the correct answer is right and why the others are wrong]

IMPORTANT:
- Return ONLY the question in the format shown above
- NO markdown code blocks, NO JSON, NO extra text
- Follow the ${difficultyLevel.toUpperCase()} difficulty requirements
- Make the question appropriately challenging for ${difficultyLevel} level`;

      console.log('📤 Sending MC quiz generation prompt...');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6144,
        system: `You are an expert exam question writer creating UWorld-style multiple choice questions for law students. You excel at creating questions with varied difficulty levels (easy, medium, hard) following UWorld's progressive challenge model. Your questions test understanding through application, with appropriately complex fact patterns and clear explanations. Always return questions in the EXACT markdown format requested with NO additional text, introductions, or conversational responses.`,
        messages: [{ role: 'user', content: mcQuizPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('✅ MC quiz response received:', rawResponse.substring(0, 200));

      return NextResponse.json({ content: rawResponse });
    }

    // 📝 SHORT ANSWER QUIZ MODE: Generate short answer questions
    if (mode === 'quiz-short-answer') {
      console.log('📝 QUIZ-SHORT-ANSWER MODE: Generating short answer questions');

      const { numberOfQuestions = 2, questionNumber = 1 } = body;
      const userTopic = userMessage;

      console.log(`📊 Generating Short Answer ${questionNumber}/${numberOfQuestions}`);

      const shortAnswerPrompt = `Generate exactly ONE short answer question about this content:

"${userTopic}"

Create a thoughtful short answer question that:
- Tests deep understanding and ability to explain concepts
- Requires a paragraph-length response (3-5 sentences)
- Cannot be answered with simple yes/no or one-word answers
- Focuses on application, analysis, or synthesis of ideas

CRITICAL: You MUST respond in this EXACT format with NO additional text, NO introductions, NO thank you messages:

**Question:**
[The question text - should be clear and specific about what is being asked]

**Sample Answer:**
[A comprehensive sample answer showing the key points that should be covered, written in 3-5 sentences. This serves as a rubric for grading.]

IMPORTANT:
- Return ONLY the question in the format shown above
- NO markdown code blocks, NO JSON, NO extra text
- The sample answer should demonstrate the level of depth expected
- Focus on conceptual understanding, not just facts`;

      console.log('📤 Sending short answer generation prompt...');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are an expert exam question writer creating thoughtful short answer questions for students. You excel at creating questions that test deep understanding and require explanation rather than simple recall. Always return questions in the EXACT markdown format requested with NO additional text, introductions, or conversational responses.`,
        messages: [{ role: 'user', content: shortAnswerPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('✅ Short answer response received:', rawResponse.substring(0, 200));

      return NextResponse.json({ content: rawResponse });
    }

    // 🔬 ANALYZE UNIVERSE MODE: Extract topics, cases, and doctrines
    if (mode === 'analyze-universe') {
      console.log('🔬 ANALYZE-UNIVERSE MODE: Analyzing universe content');

      const userContent = userMessage;

      const analyzePrompt = `You are analyzing a law student's knowledge universe. Extract and categorize the following from all content:

1. **Topics**: Broad legal topics or areas of law (e.g., "Constitutional Law", "Dormant Commerce Clause", "Preemption")
2. **Cases**: Specific legal cases mentioned (e.g., "Youngstown Sheet", "City of Philadelphia v. New Jersey")
3. **Doctrines**: Legal doctrines, tests, or rules (e.g., "Strict Scrutiny", "Pike Balancing Test", "Field Preemption")

For each item found, provide:
- A unique ID (lowercase-kebab-case)
- The name
- A brief description/summary/explanation
- Empty nodeIds array (we'll fill this later)

Return ONLY valid JSON in this exact format:
{
  "topics": [
    {"id": "topic-id", "name": "Topic Name", "description": "Brief description", "nodeIds": []}
  ],
  "cases": [
    {"id": "case-id", "name": "Case Name", "summary": "Brief summary", "nodeIds": []}
  ],
  "doctrines": [
    {"id": "doctrine-id", "name": "Doctrine Name", "explanation": "Brief explanation", "nodeIds": []}
  ]
}

Content to analyze:
${userContent}`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8096,
        system: 'You are a legal education expert who analyzes and categorizes legal content. Always return ONLY valid JSON with no additional text.',
        messages: [{ role: 'user', content: analyzePrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('🔬 Analysis complete');

      return NextResponse.json({ response: rawResponse });
    }

    // 🎯 APPLICATION LAB: Generate practice scenario
    if (mode === 'application-scenario') {
      console.log('🎯 APPLICATION-SCENARIO MODE: Generating practice scenario');

      const userContent = userMessage;

      const scenarioPrompt = `You are a law professor creating a practice scenario for a student. Based on the topics, cases, and doctrines provided, create a NEW hypothetical scenario that requires applying these legal principles.

${userContent}

Create a realistic hypothetical scenario that:
1. Is different from any cases mentioned above
2. Requires applying 2-3 of the doctrines/principles listed
3. Has factual complexity that mirrors real legal analysis
4. Is 3-5 paragraphs long

Return ONLY valid JSON in this exact format:
{
  "focus": "Brief description of what doctrine/principle to apply (e.g., 'Apply the Pike Balancing Test')",
  "question": "The full hypothetical scenario text (3-5 paragraphs)"
}`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are a law professor creating practice scenarios. Always return ONLY valid JSON with no additional text.',
        messages: [{ role: 'user', content: scenarioPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('🎯 Scenario generated');

      return NextResponse.json({ response: rawResponse });
    }

    // 🎯 APPLICATION LAB: Grade student answer
    if (mode === 'application-grade') {
      console.log('🎯 APPLICATION-GRADE MODE: Grading student answer');

      const userContent = userMessage;

      const gradingPrompt = `You are a law professor grading a student's application of legal doctrines to a hypothetical scenario.

${userContent}

Provide constructive feedback that:
1. Identifies which doctrines/principles the student correctly identified
2. Evaluates how well they applied those principles to the facts
3. Points out what they missed or got wrong
4. Explains the correct analysis
5. Is encouraging but honest

Format your feedback in a clear, structured way (but NOT as JSON - just formatted text with paragraphs and bullet points if needed).`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are a supportive law professor providing detailed, constructive feedback on legal analysis.',
        messages: [{ role: 'user', content: gradingPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('🎯 Grading complete');

      return NextResponse.json({ response: rawResponse });
    }

    // 📝 COURSE BUILDER: Generate application essay question and rubric
    if (mode === 'application-essay') {
      console.log('📝 APPLICATION-ESSAY MODE: Generating essay question and grading rubric');

      const userContent = userMessage;

      const essayPrompt = `You are a law professor creating an application essay question for a course. Based on the course content provided, create a comprehensive essay question that requires students to apply the legal doctrines and principles they learned to a new scenario.

${userContent}

Create:
1. A challenging essay question that:
   - Presents a realistic hypothetical scenario
   - Requires applying multiple doctrines/principles from the course
   - Has sufficient factual complexity for in-depth analysis
   - Is appropriate for a final assessment

2. A detailed grading rubric that:
   - Lists the key issues students should identify
   - Specifies which doctrines/principles should be applied
   - Outlines the expected analysis steps
   - Provides clear criteria for what constitutes a strong answer

CRITICAL: Return ONLY raw JSON with NO markdown formatting, NO code blocks, NO explanation text.
Do NOT wrap the JSON in \`\`\`json or \`\`\` markers.
Return ONLY this exact JSON structure:
{
  "question": "The full essay question including the hypothetical scenario (4-6 paragraphs)",
  "rubric": "Detailed grading rubric with key issues, relevant doctrines, and evaluation criteria (structured with clear sections)"
}

Your entire response must be valid, parseable JSON starting with { and ending with }. Nothing else.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: 'You are an experienced law professor creating comprehensive assessments. CRITICAL: Your response must be ONLY valid, parseable JSON with no markdown code blocks, no explanation text, and no additional formatting. Start with { and end with }. Nothing else.',
        messages: [{ role: 'user', content: essayPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📝 Application essay generated');

      return NextResponse.json({ content: rawResponse });
    }

    // 📊 GRADE APPLICATION ESSAY: Grade student essay using rubric
    if (mode === 'grade-application-essay') {
      console.log('📊 GRADE-APPLICATION-ESSAY MODE: Grading student essay with rubric');

      const userContent = userMessage;

      const gradingPrompt = `You are a law professor grading a student's application essay. You have the essay question, the grading rubric, and the student's answer.

${userContent}

Provide comprehensive feedback that:
1. Evaluates the student's answer against each criterion in the rubric
2. Identifies which legal issues and doctrines they correctly addressed
3. Points out what they missed or misunderstood
4. Explains the correct analysis for any gaps
5. Provides specific suggestions for improvement
6. Assigns an overall assessment (e.g., Excellent, Good, Needs Improvement)

Format your feedback in clear, structured paragraphs with headers. Be constructive, specific, and encouraging while maintaining academic rigor.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: 'You are an experienced law professor providing detailed, constructive feedback on application essays. Your feedback should be thorough, specific, and help students understand both their strengths and areas for improvement.',
        messages: [{ role: 'user', content: gradingPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📊 Essay graded successfully');

      return NextResponse.json({ response: rawResponse });
    }

    // 📊 GRADE ESSAY (BASIC): Grade student essay without rubric (Application Lab)
    if (mode === 'grade-essay-basic') {
      console.log('📊 GRADE-ESSAY-BASIC MODE: Grading student essay without rubric');

      const userContent = userMessage;

      const gradingPrompt = `You are a law professor grading a student's application essay. You have the essay question and the student's answer, but no explicit rubric.

${userContent}

Provide comprehensive feedback that:
1. Evaluates whether the student addressed the question thoroughly
2. Identifies key legal issues, doctrines, or concepts they correctly applied
3. Points out what they missed or misunderstood
4. Explains what a strong answer should include
5. Provides specific suggestions for improvement
6. Assigns an overall assessment (e.g., Excellent, Good, Needs Improvement)

Format your feedback in clear, structured paragraphs with headers. Be constructive, specific, and encouraging while maintaining academic rigor.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: 'You are an experienced law professor providing detailed, constructive feedback on application essays. Your feedback should be thorough, specific, and help students understand both their strengths and areas for improvement.',
        messages: [{ role: 'user', content: gradingPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📊 Essay graded successfully (basic mode)');

      return NextResponse.json({ response: rawResponse });
    }

    // 📝 APPLICATION LAB: Generate essay question
    if (mode === 'essay-question') {
      console.log('📝 ESSAY-QUESTION MODE: Generating essay question based on analysis');

      const userContent = userMessage;

      const essayPrompt = `Based on this analyzed material, create ONE realistic law school exam-style essay question:

${userContent}

CRITICAL: This MUST be a law school exam-style question with a detailed fact pattern, NOT an academic essay asking students to explain or apply rules in the abstract.

Requirements:
1. **Realistic Fact Pattern**: Create a 2-3 paragraph hypothetical scenario with specific facts that raise legal issues related to the analyzed material
2. **Multiple Interrelated Issues**: The facts should implicate 2-4 different doctrines/concepts from the material in realistic ways
3. **Issue Spotting Required**: Don't explicitly state what legal issues are raised - the student must identify them from the facts
4. **Ambiguity**: Include facts that could support different outcomes or require weighing competing considerations
5. **Law School Exam Style**: Should resemble actual law school exam questions where students must: (a) identify legal issues, (b) state relevant rules, (c) apply rules to facts, (d) reach conclusions

Format:
- Present the fact pattern (2-3 paragraphs describing a realistic situation)
- End with: "Please analyze [Party Name]'s potential claims/defenses." OR "What is the likely outcome?" OR similar call question

EXAMPLES OF WHAT TO DO:
✓ "Alice and Bob entered into a contract for the sale of Alice's home. The contract included a clause stating... Three weeks before closing, Alice discovered... Bob now claims... Analyze the parties' rights and obligations."
✓ "XYZ Corp filed a lawsuit challenging a federal regulation. The regulation was promulgated by... The agency's enabling statute states... XYZ argues... Evaluate XYZ's chances of success."

EXAMPLES OF WHAT NOT TO DO:
✗ "Discuss the doctrine of [X] and how it applies to cases involving [Y]."
✗ "Explain the test for [Z] and provide examples of how courts have applied it."
✗ "Compare and contrast the approaches taken in [Case A] and [Case B]."

DO NOT include answer guidance, rubrics, or discussion of issues - ONLY the fact pattern and question.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'You are an experienced law professor who writes realistic law school exam questions. Your questions always include detailed fact patterns with specific scenarios that require students to spot issues, apply legal rules to facts, and analyze outcomes - NOT academic essays asking students to explain doctrines in the abstract.',
        messages: [{ role: 'user', content: essayPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📝 Essay question generated');

      return NextResponse.json({ response: rawResponse });
    }

    // 💡 INTUITION-QUESTION MODE: Generate engaging intuition question for guided practice
    if (mode === 'intuition-question') {
      console.log('💡 INTUITION-QUESTION MODE: Generating engaging intuition question');

      const doctrineContent = userMessage;

      const intuitionPrompt = `Based on this legal doctrine/concept, create an engaging intuition-building question that helps students connect emotionally and morally with the material:

${doctrineContent}

Create a question that:
1. **Engages feelings** - Taps into moral compass, sense of justice/injustice, fairness, power dynamics
2. **Varies tone** - Mix of provocative, exploratory, and personal approaches
3. **Goes beyond binary** - More interesting than just "right/wrong" or "fair/unfair"
4. **Connects to lived experience** - Helps students find personal relevance

Format your response as JSON:
{
  "question": "The main provocative/thoughtful question (1-2 sentences)",
  "options": [
    "Option 1 - a specific perspective or reaction (10-20 words)",
    "Option 2 - a different angle or viewpoint (10-20 words)",
    "Option 3 - another distinct perspective (10-20 words)",
    "Option 4 - a contrarian or nuanced view (10-20 words)"
  ]
}

Examples of good question styles:
- "Who benefits most when this doctrine is applied strictly? Who loses?"
- "If you were the losing party, what would feel most unjust about this outcome?"
- "What tension is this rule trying to balance, and which side do you instinctively favor?"
- "When might following this rule lead to an outcome that feels deeply wrong?"
- "What kind of person would have written this rule, and what were they afraid of?"

Make the options represent genuinely different perspectives, not just variations of the same idea. Include one option that challenges conventional thinking.

Return ONLY valid JSON, no other text.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a thoughtful legal educator who creates engaging questions that help students connect emotionally and morally with legal doctrines. Your questions should provoke genuine reflection about justice, fairness, and values. Return only valid JSON.',
        messages: [{ role: 'user', content: intuitionPrompt }],
      });

      const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('💡 Intuition question generated');

      // Parse JSON from response
      try {
        const parsed = JSON.parse(rawResponse);
        return NextResponse.json({ response: parsed });
      } catch {
        console.error('Failed to parse intuition question JSON:', rawResponse);
        return NextResponse.json({
          response: {
            question: "What's your gut reaction to this doctrine? Does it feel fair or problematic?",
            options: [
              "This seems like a reasonable balance of interests",
              "This feels like it protects the powerful at the expense of the vulnerable",
              "This creates necessary but uncomfortable tradeoffs",
              "The real-world effects probably differ from the stated purpose"
            ]
          }
        });
      }
    }

    // 🌱 NEXUS-SUMMARIZE MODE: Generate mastery summary for completed nexus
    if (mode === 'nexus-summarize') {
      console.log('🌱 NEXUS-SUMMARIZE MODE: Generating mastery summary');

      const summaryPrompt = `${userMessage}`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are an expert learning scientist creating personalized "What You've Learned" summaries.

Your task is to synthesize a learning conversation into a comprehensive mastery summary that:
- Uses second person ("You now understand...", "You can now...")
- Focuses on LEARNING OUTCOMES and CAPABILITIES gained, not just topics discussed
- Explains the core concepts, frameworks, and mental models the student has developed
- Shows how different pieces connect and build on each other
- Describes what kinds of problems/scenarios the student can now handle
- Highlights 1-2 key pitfalls or common mistakes to watch out for
- Is 3-5 well-structured paragraphs

Write in a warm, encouraging tone that celebrates the student's progress while being substantive and specific.`,
        messages: [{ role: 'user', content: summaryPrompt }],
      }, 'low');

      const masterySummary = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('✨ Mastery summary generated:', masterySummary.substring(0, 100) + '...');

      return NextResponse.json({ message: masterySummary, response: masterySummary });
    }

    // 🎓 NEXUS-APPLICATION-LAB MODE: Generate Application Lab for completed nexus
    if (mode === 'nexus-application-lab') {
      console.log('🎓 NEXUS-APPLICATION-LAB MODE: Generating Application Lab');

      const labPrompt = `${userMessage}`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are an expert learning scientist creating personalized Application Labs that help students apply what they've learned.

Your task is to synthesize a learning conversation into a comprehensive Application Lab that:
1. Summarizes the core concepts and capabilities the student has developed
2. Provides 2-5 progressively challenging scenario-based questions
3. Includes a final capstone essay prompt that requires synthesis
4. Optionally includes a grading rubric

You must return ONLY valid JSON with NO additional text before or after. The JSON must match this exact structure:

{
  "doctrineSummary": "A 2-4 paragraph summary using second person ('You now understand...') that explains the core concepts, frameworks, and mental models the student has developed. Focus on learning outcomes and capabilities gained, not just topics discussed.",
  "scenarios": [
    {
      "id": "scenario-1",
      "prompt": "A concrete scenario that tests application of the concepts in a realistic situation. Should be specific and require thoughtful analysis.",
      "guidance": "Optional hints or framework for thinking through this scenario. Help the student know where to start."
    }
  ],
  "finalEssayPrompt": "A capstone application essay prompt that requires synthesizing multiple concepts and applying them to a complex, realistic challenge. Should be open-ended and require deep engagement with the material. Make it intellectually stimulating.",
  "rubric": "Optional grading rubric that explains what excellent, good, and weak responses would demonstrate. Focus on quality of reasoning and application, not just coverage."
}

Guidelines:
- Generate 2-5 scenarios that progressively increase in complexity
- Each scenario should test different aspects or combinations of what was learned
- Make scenarios concrete and realistic, not generic or theoretical
- The final essay prompt should be the most challenging and comprehensive
- Write in a warm, encouraging tone that celebrates the student's progress
- Be specific about what the student now understands and can do

Remember: Return ONLY the JSON object, nothing else.`,
        messages: [{ role: 'user', content: labPrompt }],
      });

      const applicationLab = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('✨ Application Lab generated:', applicationLab.substring(0, 150) + '...');

      return NextResponse.json({ message: applicationLab, response: applicationLab });
    }

    // 📚 ATOMIZE-CONTENT MODE: Generate learning blueprint using Leopold Teaching Doctrines
    if (mode === 'atomize-content') {
      console.log('📚 ATOMIZE-CONTENT MODE: Generating atomization blueprint');

      const contentToAtomize = `${userMessage}`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: `You are an expert educational designer who atomizes content into structured learning experiences using the Leopold Teaching Doctrines.

**LEOPOLD TEACHING DOCTRINES:**
1. Understanding Before Memorization
2. Ear Before Eye (Intuition Before Rule)
3. Chunk First, Then Whole
4. Imitation, Then Transformation
5. Practice Disguised as Play
6. Technique Serves Expression
7. Integrated Skills, Not Silos
8. Micro-Steps, Macro-Arc
9. Immediate Feedback, Minimal Shame
10. Expose the Student to Masters Early
11. Multiple Instruments, One Mind
12. Hidden Curriculum
13. Regularity Over Heroics
14. Structure First, Freedom Inside It
15. Child-Sized Tasks, Adult-Sized Content

**YOUR TASK:**
Analyze the provided educational content and produce a JSON blueprint for atomizing it into an Astryon learning universe.

**OUTPUT FORMAT (JSON only, no other text):**
{
  "topic": "string - the main subject",
  "doctrines": [
    {
      "id": "doctrine-1",
      "title": "Doctrine Title",
      "role": "concept",
      "summary": "short explanation",
      "content": "full concept explanation",
      "metaSkillTags": ["issue-spotting", "rule-articulation", "etc"],
      "children": [
        {
          "id": "intuition-1",
          "role": "intuition-example",
          "summary": "short description",
          "content": "concrete example that builds intuition",
          "metaSkillTags": ["intuition", "pattern-recognition"]
        },
        {
          "id": "model-1",
          "role": "model-answer",
          "content": "model reasoning pattern to demonstrate",
          "metaSkillTags": ["modeling", "structure"]
        },
        {
          "id": "imitate-1",
          "role": "imitate",
          "prompt": "ask student to imitate the reasoning",
          "metaSkillTags": ["reasoning", "application"]
        },
        {
          "id": "quiz-mc-1",
          "role": "quiz-mc",
          "question": "question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctOption": "A",
          "explanation": "why that option is correct",
          "metaSkillTags": ["testing", "memory"]
        },
        {
          "id": "quiz-sa-1",
          "role": "quiz-short-answer",
          "question": "short answer prompt",
          "sampleAnswer": "model answer",
          "metaSkillTags": ["precision", "rule-articulation"]
        },
        {
          "id": "scenario-1",
          "role": "application-scenario",
          "prompt": "realistic fact pattern",
          "guidance": "how to approach it",
          "metaSkillTags": ["issue-spotting", "fact-application", "judgment"]
        },
        {
          "id": "synthesis-1",
          "role": "synthesis",
          "content": "what this doctrine means and how it connects",
          "metaSkillTags": ["synthesis", "big-picture"]
        }
      ]
    }
  ],
  "finalSynthesis": {
    "role": "synthesis",
    "title": "Overall Understanding",
    "content": "Macro-level explanation of what student now understands",
    "metaSkillTags": ["big-picture", "integration"]
  },
  "applicationLabSuggestion": {
    "doctrineSummary": "Second-person summary of learning outcomes",
    "scenarios": [
      {
        "id": "scenario-id",
        "prompt": "applied fact pattern",
        "guidance": "how to approach"
      }
    ],
    "finalEssayPrompt": "comprehensive essay prompt",
    "rubric": "grading criteria"
  }
}

**ATOMIZATION RULES:**
1. Break content into 4-15 doctrines (mini-units)
2. Each doctrine must have ALL child types: intuition-example, model-answer, imitate, at least one quiz, application-scenario, synthesis
3. Every node needs metaSkillTags from: issue-spotting, rule-articulation, distinguishing, analogical-reasoning, fact-application, pattern-recognition, synthesis, judgment, modeling, memory, precision, self-explanation, integration
4. Apply Leopold principles: concept before quiz, intuition before rule, model before imitate, vivid examples
5. Include applicationLabSuggestion for final evolution

**IMPORTANT:** Output ONLY valid JSON, nothing else. No markdown, no commentary.`,
        messages: [{ role: 'user', content: contentToAtomize }],
      });

      const atomizationBlueprint = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('✨ Atomization blueprint generated:', atomizationBlueprint.substring(0, 200) + '...');

      return NextResponse.json({ message: atomizationBlueprint, response: atomizationBlueprint });
    }

    // 🎓 LEOPOLD-PRACTICE MODE: Generate atomized practice steps for a single node (No map pollution)
    if (mode === 'leopold-practice') {
      console.log('🎓 LEOPOLD-PRACTICE MODE: Generating targeted practice steps');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `You are a Leopold Teaching Doctrine architect. Your task is to generate a high-quality, 5-step guided practice sequence for the provided content.

LEOPOLD TEACHING DOCTRINES:
1. Understanding Before Memorization
2. Intuition Before Rule
3. Model Before Imitate
4. Practice Disguised as Play
5. Immediate Feedback

YOUR TASK:
Generate a JSON object containing 5 practice steps for the provided topic/content.

OUTPUT FORMAT (JSON only):
{
  "practiceSteps": [
    {
      "nodeType": "intuition-example",
      "content": "A concrete, relatable analogy or scenario that builds gut-level intuition for the concept. (2-4 sentences)"
    },
    {
      "nodeType": "model-answer",
      "content": "A clear demonstration of the correct reasoning pattern or approach. (2-4 sentences)"
    },
    {
      "nodeType": "imitate",
      "content": "A 'Now you try' prompt where the student applies the pattern to a similar but fresh example."
    },
    {
      "nodeType": "quiz-mc",
      "content": "A multiple-choice question testing the core intuition.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOption": "A",
      "explanation": "Why this is the correct intuition."
    },
    {
      "nodeType": "synthesis",
      "content": "A final scenario that combines everything, asking the student to reflect on the 'why' and the 'how' together. (3-4 sentences)"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON.
- Do NOT include any markdown code blocks or commentary.
- Ensure 'nodeType' matches the allowed internal types exactly.`,
        messages: [{ role: 'user', content: userMessage }],
      });

      const practiceJson = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('✨ Leopold practice steps generated');

      try {
        const parsed = JSON.parse(practiceJson);
        return NextResponse.json({ response: parsed });
      } catch (err) {
        console.error('Failed to parse practice JSON:', practiceJson);
        return NextResponse.json({
          error: 'Failed to generate valid practice steps',
          raw: practiceJson
        }, { status: 500 });
      }
    }

    // 🎓 QUIZ MODE: Handle quiz grading (PROVIDE ANSWER HERE)
    if (mode === 'quiz' && userMessage.includes('Previous question:')) {
      console.log('📝 QUIZ GRADING MODE - Evaluating student answer');

      // Extract question and answer from the message
      const questionMatch = userMessage.match(/Previous question: "(.+?)"/);
      const answerMatch = userMessage.match(/User's answer: "(.+?)"/);

      if (!questionMatch || !answerMatch) {
        console.error('❌ Could not parse quiz question/answer');
        return NextResponse.json(
          { error: 'Invalid quiz answer format' },
          { status: 400 }
        );
      }

      const question = questionMatch[1];
      const userAnswer = answerMatch[1];

      console.log('❓ Question:', question.substring(0, 50) + '...');
      console.log('✍️ User answer:', userAnswer.substring(0, 50) + '...');

      const gradingPrompt = `You are a law professor grading a student's answer.

Question: "${question}"
Student's Answer: "${userAnswer}"

Grade their answer and provide the correct answer:

1. FEEDBACK (2-3 sentences):
   - If CORRECT: Start with "✓ Correct!" and affirm what they got right
   - If PARTIALLY CORRECT: Start with "Partially correct." Explain what they got right and what they missed
   - If INCORRECT: Start with "Not quite." Explain what was wrong

2. CORRECT ANSWER (3-5 sentences):
   After your feedback, provide a clear, complete correct answer under a "The Complete Answer:" heading.

3. End by asking: "Would you like another question?"

Format your response exactly like this:
[Grade and Feedback - 2-3 sentences]

The Complete Answer:
[Full correct answer - 3-5 sentences providing the complete explanation the student should learn]

Would you like another question?`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a supportive law professor providing quiz feedback. Be encouraging but honest. Always teach what the correct answer is so students learn from their mistakes.',
        messages: [{ role: 'user', content: gradingPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const feedback = textContent && 'text' in textContent ? textContent.text : 'Unable to grade answer.';

      console.log('✅ Quiz feedback:', feedback.substring(0, 100) + '...');

      return NextResponse.json({
        response: feedback,
        isQuizFeedback: true
      });
    }

    // 🧠 GAP MODE: gap-analyze - Analyze query with graph structure (MULTI-UNIVERSE)
    if (mode === 'gap-analyze') {
      console.log('🧠 GAP MODE: gap-analyze - Analyzing query with multi-universe context');

      const { currentGraph, activatedGraphs, question } = body;

      console.log('🧠 Multi-universe context:', {
        hasCurrentGraph: !!currentGraph,
        activatedCount: activatedGraphs?.length || 0,
        question: question?.substring(0, 50)
      });

      // Build context from multiple universes
      const contextSections: string[] = [];

      if (currentGraph) {
        contextSections.push(`CURRENT UNIVERSE (on canvas):
Nexus: ${currentGraph.nexus.title}
${currentGraph.nexus.content}

Nodes (${currentGraph.nodes.length}):
${currentGraph.nodes.slice(0, 10).map((n: any, i: number) =>
          `${i + 1}. ${n.type}: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`
        ).join('\n')}
${currentGraph.nodes.length > 10 ? `... and ${currentGraph.nodes.length - 10} more nodes` : ''}`);
      }

      if (activatedGraphs && activatedGraphs.length > 0) {
        contextSections.push(`\nACTIVATED SOURCE UNIVERSES (${activatedGraphs.length}):`);
        activatedGraphs.forEach((graph: any, idx: number) => {
          contextSections.push(`
Universe ${idx + 1}: ${graph.nexus.title}
${graph.nexus.content}
Nodes (${graph.nodes.length}):
${graph.nodes.slice(0, 5).map((n: any, i: number) =>
            `  - ${n.type}: ${n.content.substring(0, 80)}...`
          ).join('\n')}
${graph.nodes.length > 5 ? `  ... and ${graph.nodes.length - 5} more nodes` : ''}`);
        });
      }

      const graphContext = contextSections.join('\n');

      const analyzePrompt = `You are analyzing a user's question across multiple knowledge universes.

${graphContext}

USER QUESTION: "${question}"

Analyze this question and determine:
1. Can this question be broken into 2-5 INDEPENDENT parallel explorations?
2. Or should it be answered as a single cohesive response?

Criteria for PARALLEL:
- Question explicitly asks about multiple things ("explore X, Y, and Z")
- Question can naturally split into independent subtopics
- Each subtopic can be explored independently without depending on others
- User says "explore", "break down", "analyze different aspects"
${activatedGraphs && activatedGraphs.length > 0 ? '- With multiple universes activated, consider tasks that find connections between them' : ''}

Criteria for SINGLE:
- Question asks for one coherent answer
- Question requires synthesis across topics
- Question is about relationships between things (needs integrated answer)
- Question is a follow-up that builds on existing conversation
${activatedGraphs && activatedGraphs.length > 0 ? '- Question asks for cross-universe synthesis or comparison' : ''}

Respond in VALID JSON format:
{
  "type": "parallel" OR "single",
  "reasoning": "brief explanation of why",
  "tasks": ["task 1", "task 2", "task 3"] (ONLY if type is "parallel", otherwise omit)
}

IMPORTANT: Return ONLY the JSON, no other text.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a graph-aware AI analyzer. Assess whether questions should be answered in parallel or as a single response.',
        messages: [{ role: 'user', content: analyzePrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      try {
        const analysisResult = JSON.parse(rawResponse.trim());
        console.log('🧠 Analysis result:', analysisResult);

        return NextResponse.json(analysisResult);
      } catch (error) {
        console.error('❌ Failed to parse gap-analyze response:', error);
        console.error('Raw response:', rawResponse);
        return NextResponse.json(
          { error: 'Failed to parse analysis response' },
          { status: 500 }
        );
      }
    }

    // 🧠 GAP MODE: gap-parallel - Execute one parallel task with multi-universe awareness
    if (mode === 'gap-parallel') {
      console.log('🧠 GAP MODE: gap-parallel - Executing parallel task with multi-universe context');

      const { currentGraph, activatedGraphs, task } = body;

      if (!task) {
        return NextResponse.json(
          { error: 'Task required for gap-parallel mode' },
          { status: 400 }
        );
      }

      console.log('🧠 Executing task:', task.substring(0, 50) + '...');
      console.log('🧠 Multi-universe context:', {
        hasCurrentGraph: !!currentGraph,
        activatedCount: activatedGraphs?.length || 0
      });

      // Build context from multiple universes
      const contextSections: string[] = [];

      if (currentGraph) {
        contextSections.push(`CURRENT UNIVERSE:
Nexus: ${currentGraph.nexus.title}
${currentGraph.nexus.content}

Existing nodes (${currentGraph.nodes.length}):
${currentGraph.nodes.slice(0, 8).map((n: any, i: number) =>
          `- ${n.content.substring(0, 80)}...`
        ).join('\n')}
${currentGraph.nodes.length > 8 ? `... and ${currentGraph.nodes.length - 8} more` : ''}`);
      }

      if (activatedGraphs && activatedGraphs.length > 0) {
        contextSections.push(`\nACTIVATED UNIVERSES (${activatedGraphs.length} source${activatedGraphs.length > 1 ? 's' : ''}):`);
        activatedGraphs.forEach((graph: any, idx: number) => {
          contextSections.push(`
${idx + 1}. ${graph.nexus.title}
   ${graph.nexus.content.substring(0, 150)}...
   Key nodes: ${graph.nodes.slice(0, 3).map((n: any) => n.content.substring(0, 60)).join(' | ')}...`);
        });
      }

      const graphContext = contextSections.join('\n');

      const parallelPrompt = `You are exploring a specific aspect across multiple knowledge universes.

${graphContext}

YOUR TASK: ${task}

Provide a comprehensive response (3-5 paragraphs) that:
1. Explores this specific aspect in depth
2. ${activatedGraphs && activatedGraphs.length > 0 ? 'Draws connections and insights across the activated universes' : 'Connects to the broader graph context when relevant'}
3. ${activatedGraphs && activatedGraphs.length > 0 ? 'Identifies patterns, contrasts, or synthesis opportunities between universes' : 'Fills gaps in the existing knowledge structure'}
4. Provides actionable insights or concrete examples

${activatedGraphs && activatedGraphs.length > 0 ? 'IMPORTANT: You have access to multiple universes - find non-obvious connections and synthesize insights across them.' : ''}

Write naturally and substantively. This will become a node in the graph.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'You are a graph-aware AI exploring specific aspects of knowledge. Provide deep, contextual insights.',
        messages: [{ role: 'user', content: parallelPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const content = textContent && 'text' in textContent ? textContent.text : '';

      console.log('✅ Parallel task completed:', content.substring(0, 100) + '...');

      return NextResponse.json({ content });
    }

    // 🌌 GAP MODE: gap-synthesize - Create synthesis universe from activated universes (empty canvas)
    if (mode === 'gap-synthesize') {
      console.log('🌌 GAP MODE: gap-synthesize - Creating synthesis universe from activated universes');

      const { activatedGraphs, question } = body;

      if (!activatedGraphs || activatedGraphs.length === 0) {
        return NextResponse.json(
          { error: 'Activated universes required for synthesis mode' },
          { status: 400 }
        );
      }

      console.log('🌌 Synthesizing from', activatedGraphs.length, 'universes');
      console.log('🌌 User question:', question?.substring(0, 50));

      // Build context from activated universes
      const universeContexts = activatedGraphs.map((graph: any, idx: number) => `
UNIVERSE ${idx + 1}: ${graph.nexus.title}
Overview: ${graph.nexus.content}

Key Insights (${graph.nodes.length} nodes):
${graph.nodes.slice(0, 8).map((n: any) => `- ${n.content.substring(0, 120)}...`).join('\n')}
${graph.nodes.length > 8 ? `... and ${graph.nodes.length - 8} more insights` : ''}
`).join('\n---\n');

      const synthesisPrompt = `You are creating a NEW synthesis universe that combines insights from multiple activated universes.

USER QUESTION/GOAL: "${question}"

SOURCE UNIVERSES:
${universeContexts}

Your task: Create a synthesis universe that:
1. Weaves together the most important insights from ALL source universes
2. Finds non-obvious connections and patterns across universes
3. Creates something greater than the sum of its parts
4. Organizes insights into 5-12 coherent nodes
5. Addresses the user's question/goal through this synthesis

Format as VALID JSON (ONLY JSON, no other text):
{
  "nexusTitle": "Synthesis: [brief title capturing the cross-universe insight]",
  "nexusContent": "Overview paragraph explaining how this synthesis combines insights from the ${activatedGraphs.length} source universes",
  "nodes": [
    {"content": "Synthesis Point 1: Title\\n\\nExplanation that draws from multiple source universes (2-3 sentences)"},
    {"content": "Synthesis Point 2: Title\\n\\nExplanation that draws from multiple source universes (2-3 sentences)"},
    ...
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown blocks
- Use \\n for line breaks (NOT literal newlines)
- Each node should synthesize across multiple source universes
- Create 5-12 nodes that comprehensively address the synthesis
- Node titles should reflect the cross-universe nature of the insights`;

      console.log('📤 Sending synthesis universe generation prompt...');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are Astryon AI, a universe synthesis architect. You create new knowledge structures that synthesize insights from multiple source universes. Always return ONLY valid JSON with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: synthesisPrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('📝 Raw synthesis response:', rawResponse.substring(0, 200));

      try {
        let spatialData;
        try {
          spatialData = JSON.parse(rawResponse);
        } catch (firstError) {
          console.log('⚠️ Initial parse failed, attempting cleanup...');

          let cleanedResponse = rawResponse.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```$/, '');
          }

          cleanedResponse = cleanedResponse.replace(
            /"((?:[^"\\]|\\.)*)"/g,
            (match) => {
              return match
                .replace(/\r\n/g, '\\n')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\n')
                .replace(/\t/g, '\\t');
            }
          );

          spatialData = JSON.parse(cleanedResponse);
        }

        console.log('✅ Successfully parsed synthesis universe:', {
          title: spatialData.nexusTitle,
          nodeCount: spatialData.nodes?.length || 0
        });

        return NextResponse.json({
          response: `Created synthesis universe from ${activatedGraphs.length} source universes`,
          spatialData
        });
      } catch (parseError) {
        console.error('❌ Failed to parse synthesis JSON:', parseError);
        console.error('Raw response was:', rawResponse);
        return NextResponse.json(
          { error: 'Failed to parse synthesis universe structure' },
          { status: 500 }
        );
      }
    }

    // 🧠 GAP MODE: gap-single - Execute single task with multi-universe awareness
    if (mode === 'gap-single') {
      console.log('🧠 GAP MODE: gap-single - Executing single task with multi-universe context');

      const { currentGraph, activatedGraphs, question } = body;

      if (!question) {
        return NextResponse.json(
          { error: 'Question required for gap-single mode' },
          { status: 400 }
        );
      }

      console.log('🧠 Question:', question.substring(0, 50) + '...');
      console.log('🧠 Multi-universe context:', {
        hasCurrentGraph: !!currentGraph,
        activatedCount: activatedGraphs?.length || 0
      });

      // Build context from multiple universes
      const contextSections: string[] = [];

      if (currentGraph) {
        contextSections.push(`CURRENT UNIVERSE:
Nexus: ${currentGraph.nexus.title}
${currentGraph.nexus.content}

Existing nodes (${currentGraph.nodes.length}):
${currentGraph.nodes.map((n: any, i: number) =>
          `${i + 1}. ${n.type}: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`
        ).join('\n')}`);
      }

      if (activatedGraphs && activatedGraphs.length > 0) {
        contextSections.push(`\nACTIVATED SOURCE UNIVERSES (${activatedGraphs.length}):`);
        activatedGraphs.forEach((graph: any, idx: number) => {
          contextSections.push(`
Universe ${idx + 1}: ${graph.nexus.title}
${graph.nexus.content}
Key nodes: ${graph.nodes.slice(0, 5).map((n: any, i: number) =>
            `${n.type}: ${n.content.substring(0, 100)}...`
          ).join(' | ')}`);
        });
      }

      const graphContext = contextSections.join('\n');

      const singlePrompt = `You are responding to a question across multiple knowledge universes.

${graphContext}

USER QUESTION: "${question}"

Provide a comprehensive response that:
1. Directly answers the question
2. ${activatedGraphs && activatedGraphs.length > 0 ? 'Synthesizes insights from all activated universes' : 'Builds on existing knowledge in the graph'}
3. ${activatedGraphs && activatedGraphs.length > 0 ? 'Identifies patterns, contrasts, and connections across universes' : 'Identifies gaps and suggests new directions'}
4. ${activatedGraphs && activatedGraphs.length > 0 ? 'Creates a unified synthesis that transcends individual universes' : 'Synthesizes connections across the graph when relevant'}
5. Provides concrete examples or actionable insights

${activatedGraphs && activatedGraphs.length > 0 ? 'IMPORTANT: You have access to multiple universes - your response should weave together insights from all sources to create something greater than the sum of its parts.' : ''}

Write naturally (3-6 paragraphs). This will become a node in the graph.`;

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'You are a graph-aware AI that provides contextual, synthesized responses based on the entire knowledge structure.',
        messages: [{ role: 'user', content: singlePrompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const content = textContent && 'text' in textContent ? textContent.text : '';

      console.log('✅ Single task completed:', content.substring(0, 100) + '...');

      return NextResponse.json({ content });
    }

    // ⚖️ DOCTRINE MODE: Generate doctrinal map with JSON structure
    if (mode === 'doctrine') {
      console.log('⚖️ DOCTRINE MODE ACTIVATED - Generating doctrinal map');

      const response = await safeAICall(anthropic, openai, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are a legal research assistant. Generate comprehensive doctrinal analysis in valid JSON format with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: userMessage }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const aiResponse = textContent && 'text' in textContent ? textContent.text : 'No response';

      console.log('✅ Doctrine mode response:', aiResponse.substring(0, 100) + '...');

      return NextResponse.json({ response: aiResponse });
    }

    // Standard chat mode
    console.log('📤 Sending to Claude API...');

    // 🧠 NEW: Build system message with full context
    const systemMessage = conversationContext
      ? `You are Astryon AI, helping users explore ideas in 3D space. You have access to the full conversation context below:\n\n${conversationContext}\n\nRespond naturally based on this full context.`
      : 'You are Astryon AI, helping users explore ideas in 3D space.';

    console.log('🤖 Using Anthropic Claude');

    const response = await safeAICall(anthropic, openai, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemMessage,
      messages: [{ role: 'user', content: userMessage }],
    });

    console.log('✅ Got response from Claude');

    const textContent = response.content.find((block) => block.type === 'text');
    const aiResponse = textContent && 'text' in textContent ? textContent.text : 'No response';

    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    console.error('❌ Error calling Anthropic API:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);

    return NextResponse.json(
      { error: error.message || 'Failed to get response from Claude' },
      { status: 500 }
    );
  }
}