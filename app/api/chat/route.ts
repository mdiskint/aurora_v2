import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Force rebuild
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('✅ API key found, initializing Anthropic client');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const body = await request.json();
    console.log('📦 Full request body:', JSON.stringify(body, null, 2));

    const { messages, conversationContext, mode, explorationMode, previousQuestions, conversationHistory } = body;
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

    // 🌌 SPATIAL MODE: Detect "Explore:" prefix or explicit spatial mode
    const isSpatialMode = mode === 'spatial' || userMessage.toLowerCase().startsWith('explore:');

    if (isSpatialMode) {
      console.log('🌌 SPATIAL MODE ACTIVATED - Generating universe structure');

      // Extract topic from "Explore: topic" or use full message
      const userTopic = userMessage.toLowerCase().startsWith('explore:')
        ? userMessage.substring(8).trim()
        : userMessage;

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
        const nexusSection = sections[0].trim();
        // Remaining sections = Nodes ONLY (excludes first section)
        const nodeSections = sections.slice(1);

        console.log('🏛️ Nexus section (index 0):', nexusSection);
        console.log('📦 Node sections (index 1+):', nodeSections);

        const spatialData = {
          nexusTitle: nexusSection.substring(0, 50), // First 50 chars for title
          nexusContent: nexusSection, // Full first section for content
          nodes: nodeSections.map((content, idx) => {
            console.log(`   Node ${idx + 1}:`, content.substring(0, 50) + '...');
            return { content: content.trim() };
          })
        };

        console.log('✅ Parsed manual structure:');
        console.log(`   - Nexus: "${spatialData.nexusTitle}"`);
        console.log(`   - Nodes: ${spatialData.nodes.length}`);
        console.log('   - Nexus appears in nodes? NO (using slice(1))');

        return NextResponse.json({
          response: `Created manual universe with ${spatialData.nodes.length} nodes`,
          spatialData
        });
      }

      // 🤖 AI MODE: Generate structure automatically
      console.log('🤖 AI MODE: Generating universe structure');

      const spatialPrompt = `User wants to explore: "${userTopic}"

You have the freedom to create 4-20 total artifacts (1 nexus + 3-19 child nodes).

Assess the topic and decide the optimal number based on:
- How many distinct subtopics exist naturally?
- Can the topic be well-covered with fewer nodes, or does it require comprehensive breakdown?
- Balance breadth (many areas) vs. depth (detailed coverage)

Guidelines for scaling:
- Simple/narrow topics (e.g., "primary colors", "traffic lights"): 4-6 total (nexus + 3-5 nodes)
- Medium complexity (e.g., "building a startup", "photosynthesis"): 7-12 total (nexus + 6-11 nodes)
- Complex/broad topics (e.g., "causes of World War I", "quantum mechanics", "history of philosophy"): 13-20 total (nexus + 12-19 nodes)

Create the optimal number to give users a complete conceptual map without overwhelming or under-serving the topic.

Format your response as VALID JSON (and ONLY JSON, no other text):
{
  "nexusTitle": "brief title (3-7 words)",
  "nexusContent": "overview paragraph explaining the topic",
  "nodes": [
    {"content": "Subtopic 1: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    {"content": "Subtopic 2: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    {"content": "Subtopic 3: Title\\n\\nDetailed explanation (2-3 sentences minimum)"}
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Use \\n for line breaks within strings (NOT literal newlines)
- Each node should be substantive (2-3 sentences minimum)
- Create 3-19 nodes based on topic complexity`;

      console.log('📤 Sending spatial universe generation prompt...');

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096, // Increased to handle up to 19 nodes
        system: 'You are Aurora AI, a universe architect. Generate structured spatial knowledge graphs with intelligent scaling. Assess topic complexity and create the optimal number of nodes (3-19) to comprehensively map the conceptual space. Always return ONLY valid JSON with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: spatialPrompt }],
      });

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

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are Aurora AI, a universe architect. Generate structured spatial knowledge graphs that explore content deeply. Always return ONLY valid JSON with properly escaped newlines (\\n).',
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
  `Round ${i+1}:\nQ: ${exchange.question}\nA: ${exchange.userAnswer}\nInsight: ${exchange.aiEngagement}`
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

      const response = await anthropic.messages.create({
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
  `Round ${i+1}:\nQ: ${exchange.question}\nA: ${exchange.userAnswer}\nInsight: ${exchange.aiEngagement}`
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

      const response = await anthropic.messages.create({
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

      const response = await anthropic.messages.create({
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

      const response = await anthropic.messages.create({
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
      let contextSections: string[] = [];

      if (currentGraph) {
        contextSections.push(`CURRENT UNIVERSE (on canvas):
Nexus: ${currentGraph.nexus.title}
${currentGraph.nexus.content}

Nodes (${currentGraph.nodes.length}):
${currentGraph.nodes.slice(0, 10).map((n: any, i: number) =>
  `${i+1}. ${n.type}: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`
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

      const response = await anthropic.messages.create({
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
      let contextSections: string[] = [];

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

      const response = await anthropic.messages.create({
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

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are Aurora AI, a universe synthesis architect. You create new knowledge structures that synthesize insights from multiple source universes. Always return ONLY valid JSON with properly escaped newlines (\\n).',
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
      let contextSections: string[] = [];

      if (currentGraph) {
        contextSections.push(`CURRENT UNIVERSE:
Nexus: ${currentGraph.nexus.title}
${currentGraph.nexus.content}

Existing nodes (${currentGraph.nodes.length}):
${currentGraph.nodes.map((n: any, i: number) =>
  `${i+1}. ${n.type}: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`
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

      const response = await anthropic.messages.create({
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

    // Standard chat mode
    console.log('📤 Sending to Claude API...');

    // 🧠 NEW: Build system message with full context
    const systemMessage = conversationContext
      ? `You are Aurora AI, helping users explore ideas in 3D space. You have access to the full conversation context below:\n\n${conversationContext}\n\nRespond naturally based on this full context.`
      : 'You are Aurora AI, helping users explore ideas in 3D space.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemMessage, // 🧠 Include context here
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