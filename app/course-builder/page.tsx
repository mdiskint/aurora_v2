'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/lib/store';
import { MCQ, ShortAnswer, ApplicationEssay, NodeType } from '@/lib/types';

interface SectionQuestions {
  mcqs: MCQ[];
  shortAnswers: ShortAnswer[];
}

interface AtomizationBlueprint {
  topic: string;
  doctrines: Array<{
    id: string;
    title: string;
    role: string;
    summary: string;
    content: string;
    metaSkillTags: string[];
    children: Array<{
      id: string;
      role: string;
      summary?: string;
      content?: string;
      prompt?: string;
      question?: string;
      options?: string[];
      correctOption?: string;
      explanation?: string;
      sampleAnswer?: string;
      guidance?: string;
      metaSkillTags: string[];
    }>;
  }>;
  finalSynthesis: {
    role: string;
    title: string;
    content: string;
    metaSkillTags: string[];
  };
  applicationLabSuggestion: {
    doctrineSummary: string;
    scenarios: Array<{
      id: string;
      prompt: string;
      guidance: string;
    }>;
    finalEssayPrompt: string;
    rubric: string;
  };
}

interface CourseData {
  title: string;
  description: string;
  fullTextContent: string;
  videoUrl: string;
  timestamps: string;
  sectionContents: string[]; // Content for each timestamp section
  memoryActivation: boolean;
  mcqCount: number;
  shortAnswerCount: number;
  generatedQuestions: SectionQuestions[]; // Questions for each section
  applicationEssay: ApplicationEssay | null; // Application essay question and rubric
  atomizationBlueprint: AtomizationBlueprint | null; // AI-generated content structure
}

export default function CourseBuilderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isAtomizing, setIsAtomizing] = useState(false);
  const [questionGenerationProgress, setQuestionGenerationProgress] = useState({ current: 0, total: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    description: '',
    fullTextContent: '',
    videoUrl: '',
    timestamps: '',
    sectionContents: [],
    memoryActivation: false,
    mcqCount: 5,
    shortAnswerCount: 2,
    generatedQuestions: [],
    applicationEssay: null,
    atomizationBlueprint: null,
  });

  // Pedagogy is now always traditional for course builder
  // (Leopold teaching doctrine is only available in chat)

  // Parse timestamp string into chunks
  const parseTimestamps = (timestampStr: string): Array<{ start: number; end: number }> => {
    const chunks = timestampStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    console.log('🔍 ========================================');
    console.log('🔍 TIMESTAMP PARSING');
    console.log('🔍 Raw input:', timestampStr);
    console.log('🔍 After split by comma:', timestampStr.split(','));
    console.log('🔍 After trim:', timestampStr.split(',').map(s => s.trim()));
    console.log('🔍 After filter (empty removed):', chunks);
    console.log('🔍 Number of chunks:', chunks.length);
    console.log('🔍 ========================================');
    return chunks.map((chunk, index) => {
      console.log(`🔍 Parsing chunk ${index}: "${chunk}"`);
      const parts = chunk.split('-').map(s => s.trim());
      const startStr = parts[0];
      const endStr = parts[1];

      const parseTime = (timeStr: string | undefined): number => {
        if (!timeStr) {
          console.warn(`⚠️ Missing time value in chunk ${index}: "${chunk}"`);
          return 0;
        }
        const timeParts = timeStr.split(':').map(p => parseInt(p));
        if (timeParts.length === 2) {
          return timeParts[0] * 60 + timeParts[1]; // MM:SS
        } else if (timeParts.length === 3) {
          return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]; // HH:MM:SS
        }
        return 0;
      };

      if (!endStr) {
        console.warn(`⚠️ Chunk ${index} missing end time: "${chunk}". Expected format: "0:00-5:00"`);
      }

      return {
        start: parseTime(startStr),
        end: parseTime(endStr)
      };
    });
  };

  // Atomize content using Leopold Teaching Doctrines
  const handleAtomizeContent = async () => {
    if (!courseData.fullTextContent || courseData.fullTextContent.trim() === '') {
      alert('Please enter the full text content first.');
      return;
    }

    setIsAtomizing(true);
    console.log('📚 Atomizing content using Leopold Teaching Doctrines...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: courseData.fullTextContent
          }],
          mode: 'atomize-content'
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('📚 Atomization response:', data);

      // Clean and parse JSON
      const cleanJsonString = (str: string): string => {
        let cleaned = str.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        return cleaned;
      };

      try {
        const cleanedContent = cleanJsonString(data.message || data.response);
        console.log('🧹 Cleaned atomization JSON (first 500 chars):', cleanedContent.substring(0, 500));

        const blueprint = JSON.parse(cleanedContent) as AtomizationBlueprint;

        if (!blueprint.topic || !blueprint.doctrines || !Array.isArray(blueprint.doctrines)) {
          throw new Error('Invalid atomization blueprint structure');
        }

        console.log(`✅ Atomization complete! Generated ${blueprint.doctrines.length} doctrines`);
        setCourseData({ ...courseData, atomizationBlueprint: blueprint });

        alert(`✨ Content atomized into ${blueprint.doctrines.length} learning doctrines!\n\nScroll down to review the blueprint.`);
      } catch (parseError: any) {
        console.error('❌ Failed to parse atomization response:', parseError);
        console.error('❌ Raw content:', data.message || data.response);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } catch (error) {
      console.error('❌ Error atomizing content:', error);
      alert(`Failed to atomize content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAtomizing(false);
    }
  };

  // Handle video upload and analysis
  const handleVideoUpload = async () => {
    if (!selectedFile) {
      alert('Please select a video file first.');
      return;
    }

    setIsAnalyzingVideo(true);
    console.log('🎥 Uploading video for analysis:', selectedFile.name);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Video analysis complete:', data);

      // Update course data with AI-generated content
      setCourseData(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        fullTextContent: data.fullTextContent || prev.fullTextContent,
        timestamps: data.timestamps || prev.timestamps,
        sectionContents: data.sectionContents || prev.sectionContents,
        // If timestamps are provided, we can infer sections
        // sectionContents will be populated by the API
      }));

      alert('✨ Video analysis complete! Course content has been generated.');
    } catch (error) {
      console.error('❌ Error analyzing video:', error);
      alert(`Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingVideo(false);
    }
  };

  // Generate questions for all sections
  const handleGenerateQuestions = async () => {
    setIsGeneratingQuestions(true);
    const sectionCount = courseData.sectionContents.length;
    setQuestionGenerationProgress({ current: 0, total: sectionCount });

    try {
      const allQuestions: SectionQuestions[] = [];

      for (let i = 0; i < sectionCount; i++) {
        setQuestionGenerationProgress({ current: i + 1, total: sectionCount });
        const sectionContent = courseData.sectionContents[i];

        // Generate MCQs for this section
        const mcqs: MCQ[] = [];
        for (let q = 1; q <= courseData.mcqCount; q++) {
          try {
            console.log(`🎯 Generating MCQ ${q}/${courseData.mcqCount} for section ${i + 1}...`);

            const requestBody = {
              messages: [{ role: 'user', content: sectionContent }],
              mode: 'quiz-mc',
              numberOfQuestions: courseData.mcqCount,
              questionNumber: q,
            };

            console.log('   - Request body:', JSON.stringify(requestBody, null, 2));

            const mcqResponse = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            if (!mcqResponse.ok) {
              const errorText = await mcqResponse.text();
              console.error(`❌ MCQ API error (${mcqResponse.status}):`, errorText);
              throw new Error(`Failed to generate MCQ ${q} for section ${i + 1}: ${mcqResponse.status}`);
            }

            const mcqData = await mcqResponse.json();
            console.log('   - API Response:', mcqData);

            // Validate response structure
            if (!mcqData || typeof mcqData.content !== 'string') {
              console.error('❌ Invalid API response structure:', mcqData);
              throw new Error(`Invalid response format for MCQ ${q}`);
            }

            // Parse the MCQ from the response
            const parsedMCQ = parseMCQFromResponse(mcqData.content);
            if (parsedMCQ) {
              mcqs.push(parsedMCQ);
              console.log(`   ✅ Successfully parsed MCQ ${q}`);
            } else {
              console.warn(`   ⚠️ Failed to parse MCQ ${q}, skipping...`);
            }
          } catch (error) {
            console.error(`❌ Error generating MCQ ${q} for section ${i + 1}:`, error);
            // Continue with other questions instead of failing completely
          }
        }

        // Generate short answer questions for this section
        const shortAnswers: ShortAnswer[] = [];
        for (let q = 1; q <= courseData.shortAnswerCount; q++) {
          try {
            console.log(`🎯 Generating Short Answer ${q}/${courseData.shortAnswerCount} for section ${i + 1}...`);

            const requestBody = {
              messages: [{ role: 'user', content: sectionContent }],
              mode: 'quiz-short-answer',
              numberOfQuestions: courseData.shortAnswerCount,
              questionNumber: q,
            };

            console.log('   - Request body:', JSON.stringify(requestBody, null, 2));

            const saResponse = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            if (!saResponse.ok) {
              const errorText = await saResponse.text();
              console.error(`❌ Short Answer API error (${saResponse.status}):`, errorText);
              throw new Error(`Failed to generate short answer ${q} for section ${i + 1}: ${saResponse.status}`);
            }

            const saData = await saResponse.json();
            console.log('   - API Response:', saData);

            // Validate response structure
            if (!saData || typeof saData.content !== 'string') {
              console.error('❌ Invalid API response structure:', saData);
              throw new Error(`Invalid response format for short answer ${q}`);
            }

            // Parse the short answer from the response
            const parsedSA = parseShortAnswerFromResponse(saData.content);
            if (parsedSA) {
              shortAnswers.push(parsedSA);
              console.log(`   ✅ Successfully parsed Short Answer ${q}`);
            } else {
              console.warn(`   ⚠️ Failed to parse Short Answer ${q}, skipping...`);
            }
          } catch (error) {
            console.error(`❌ Error generating Short Answer ${q} for section ${i + 1}:`, error);
            // Continue with other questions instead of failing completely
          }
        }

        allQuestions.push({ mcqs, shortAnswers });
        console.log(`✅ Generated questions for section ${i + 1}:`, { mcqs: mcqs.length, shortAnswers: shortAnswers.length });
      }

      // Save generated questions to state
      setCourseData({ ...courseData, generatedQuestions: allQuestions });
      setIsGeneratingQuestions(false);

      // Check if we generated any questions
      const totalQuestions = allQuestions.reduce((sum, section) =>
        sum + section.mcqs.length + section.shortAnswers.length, 0
      );

      console.log(`🎉 Question generation complete! Generated ${totalQuestions} total questions across ${allQuestions.length} sections`);

      if (totalQuestions === 0) {
        alert('⚠️ No questions were generated. Please check the console for errors and try again.');
        return;
      }

      // Move to step 5 to review questions
      setCurrentStep(5);
    } catch (error) {
      console.error('❌ Critical error during question generation:', error);
      setIsGeneratingQuestions(false);
      alert(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
    }
  };

  // Helper function to parse MCQ from API response
  const parseMCQFromResponse = (content: string): MCQ | null => {
    try {
      // Validate input
      if (!content || typeof content !== 'string') {
        console.error('Invalid MCQ content:', content);
        return null;
      }

      console.log('📝 Parsing MCQ from content:', content.substring(0, 200) + '...');

      // Extract question, options, answer, and explanation using regex
      const questionMatch = content.match(/\*\*Question:?\*\*\s*([\s\S]+?)(?=\*\*Options)/);
      const optionsMatch = content.match(/\*\*Options:?\*\*\s*\n([\s\S]+?)(?=\*\*Correct Answer)/);
      const answerMatch = content.match(/\*\*Correct Answer:?\*\*\s*([A-D])/);
      const explanationMatch = content.match(/\*\*Explanation:?\*\*\s*([\s\S]+?)$/);

      if (!questionMatch || !optionsMatch || !answerMatch) {
        console.warn('❌ Could not parse MCQ - missing required fields');
        console.warn('   - Question found:', !!questionMatch);
        console.warn('   - Options found:', !!optionsMatch);
        console.warn('   - Answer found:', !!answerMatch);
        console.warn('   - Full content:', content);
        return null;
      }

      const question = questionMatch[1].trim();
      const optionsText = optionsMatch[1].trim();
      const correctAnswer = answerMatch[1];
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';

      // Parse options
      const options = { A: '', B: '', C: '', D: '' };
      const optionLines = optionsText.split('\n').filter(line => line.trim());
      optionLines.forEach(line => {
        const match = line.match(/([A-D])[.)]\s*(.+)/);
        if (match) {
          const [, letter, text] = match;
          options[letter as 'A' | 'B' | 'C' | 'D'] = text.trim();
        }
      });

      return { question, options, correctAnswer, explanation };
    } catch (error) {
      console.error('Error parsing MCQ:', error);
      return null;
    }
  };

  // Helper function to parse short answer from API response
  const parseShortAnswerFromResponse = (content: string): ShortAnswer | null => {
    try {
      // Validate input
      if (!content || typeof content !== 'string') {
        console.error('Invalid short answer content:', content);
        return null;
      }

      console.log('📝 Parsing short answer from content:', content.substring(0, 200) + '...');

      const questionMatch = content.match(/\*\*Question:?\*\*\s*([\s\S]+?)(?=\*\*Sample Answer|$)/);
      const answerMatch = content.match(/\*\*Sample Answer:?\*\*\s*([\s\S]+?)$/);

      if (!questionMatch) {
        console.warn('❌ Could not parse short answer - missing question');
        console.warn('   - Full content:', content);
        return null;
      }

      const question = questionMatch[1].trim();
      const sampleAnswer = answerMatch ? answerMatch[1].trim() : '';

      return { question, sampleAnswer };
    } catch (error) {
      console.error('Error parsing short answer:', error);
      return null;
    }
  };

  // Generate application essay question and rubric
  const handleGenerateApplicationEssay = async () => {
    console.log('📝 Generating application essay question and rubric...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: courseData.fullTextContent
          }],
          mode: 'application-essay'
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('📝 API response:', data);

      // Helper function to strip markdown code blocks and fix common JSON issues
      const cleanJsonString = (str: string): string => {
        // Remove ```json or ``` wrappers if present
        let cleaned = str.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();

        // Remove trailing commas before closing braces/brackets (common AI mistake)
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        return cleaned;
      };

      // Parse the response (expecting JSON with question and rubric)
      try {
        const cleanedContent = cleanJsonString(data.content);
        console.log('🧹 Cleaned JSON content (first 500 chars):', cleanedContent.substring(0, 500));

        const parsed = JSON.parse(cleanedContent);
        if (parsed.question && parsed.rubric) {
          setCourseData({ ...courseData, applicationEssay: parsed });
          console.log('✅ Application essay generated successfully');
        } else {
          throw new Error('Invalid response format: missing question or rubric');
        }
      } catch (parseError: any) {
        console.error('❌ Failed to parse application essay response:', parseError);
        console.error('❌ Raw content:', data.content);
        console.error('❌ Cleaned content:', cleanJsonString(data.content));
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } catch (error) {
      console.error('❌ Error generating application essay:', error);
      throw error;
    }
  };

  // Generate the course
  const handleGenerateCourse = () => {
    setIsGenerating(true);

    try {
      // Parse timestamps
      const timestampChunks = parseTimestamps(courseData.timestamps);
      console.log('📊 ========================================');
      console.log('📊 COURSE GENERATION DEBUG');
      console.log('📊 ========================================');
      console.log('📊 Raw timestamps string:', courseData.timestamps);
      console.log('📊 Parsed timestamp chunks:', timestampChunks);
      console.log('📊 Number of timestamp chunks:', timestampChunks.length);
      console.log('📊 Number of section contents:', courseData.sectionContents.length);
      console.log('📊 Number of generated question sets:', courseData.generatedQuestions.length);
      console.log('📊 ========================================');

      // Create Nexus with full content
      const { createNexus } = useCanvasStore.getState();
      createNexus(
        courseData.title,
        courseData.fullTextContent,
        courseData.videoUrl
      );

      // Get the actual nexus ID that was created
      const { activeUniverseId, addNode, updateNode } = useCanvasStore.getState();
      const nexusId = activeUniverseId;

      if (!nexusId) {
        throw new Error('Failed to create nexus - no active universe ID');
      }

      console.log('✅ Created course nexus:', nexusId);

      // Create L1 nodes for each timestamp chunk
      const nodeIds: string[] = [];
      console.log(`🔄 Starting forEach loop to create ${timestampChunks.length} nodes...`);
      timestampChunks.forEach((chunk, index) => {
        console.log(`🔄 Loop iteration ${index}: Creating node for chunk`, chunk);

        // Use section-specific content if available, fallback to placeholder
        const sectionContent = courseData.sectionContents[index] || `Section ${index + 1}`;

        console.log(`   - Section content length: ${sectionContent.length} chars`);
        console.log(`   - Calling addNode with index: ${index}`);

        const nodeId = addNode(
          sectionContent, // Use section-specific content
          nexusId,
          undefined, // No quoted text
          'ai-response', // Node type - AI-response for course content
          index // Pass explicit sibling index to prevent race condition
        );

        console.log(`   ✅ Node created with ID: ${nodeId}`);

        // Get questions for this section
        const sectionQuestions = courseData.generatedQuestions[index];

        // Update node with video metadata and questions
        updateNode(nodeId, {
          videoUrl: courseData.videoUrl,
          videoStart: chunk.start,
          videoEnd: chunk.end,
          isLocked: false, // All nodes unlocked immediately
          title: `Section ${index + 1}`,
          // Store questions in the node
          mcqQuestions: sectionQuestions?.mcqs || [],
          shortAnswerQuestions: sectionQuestions?.shortAnswers || [],
        });

        nodeIds.push(nodeId);
        console.log(`✅ Created Section ${index + 1}:`, {
          nodeId,
          videoUrl: courseData.videoUrl,
          videoStart: chunk.start,
          videoEnd: chunk.end,
          locked: index !== 0,
          hasContent: !!courseData.sectionContents[index],
          mcqCount: sectionQuestions?.mcqs?.length || 0,
          shortAnswerCount: sectionQuestions?.shortAnswers?.length || 0,
        });

        // Verify the node was updated correctly
        const updatedNode = useCanvasStore.getState().nodes[nodeId];
        console.log(`🔍 Verification - Node ${nodeId.substring(0, 20)}... after update:`, {
          position: updatedNode.position,
          hasVideoUrl: !!updatedNode.videoUrl,
          videoStart: updatedNode.videoStart,
          videoEnd: updatedNode.videoEnd,
          hasMCQs: !!(updatedNode as any).mcqQuestions,
          hasShortAnswers: !!(updatedNode as any).shortAnswerQuestions,
        });
      });

      console.log(`🎓 COURSE CREATION SUMMARY:`);
      console.log(`   - Total nodes created: ${nodeIds.length}`);
      console.log(`   - Expected nodes: ${timestampChunks.length}`);
      console.log(`   - Nodes match expected: ${nodeIds.length === timestampChunks.length ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Node IDs:`, nodeIds.map(id => id.substring(0, 20) + '...'));

      // Verify each node was created correctly
      const { nodes } = useCanvasStore.getState();
      nodeIds.forEach((id, idx) => {
        const node = nodes[id];
        if (node) {
          console.log(`   - Section ${idx + 1}: position [${node.position.map(p => p.toFixed(2)).join(', ')}]`);
        } else {
          console.error(`   ❌ Section ${idx + 1}: NODE NOT FOUND IN STATE!`);
        }
      });

      // 🎓 CREATE ATOMIZED CHILD NODES from blueprint
      if (courseData.atomizationBlueprint) {
        console.log('🎓 ========================================');
        console.log('🎓 CREATING ATOMIZED DOCTRINE NODES');
        console.log('🎓 ========================================');
        console.log(`🎓 Found ${courseData.atomizationBlueprint.doctrines.length} doctrines in blueprint`);

        const { addNode: addAtomizedNode, updateNode: updateAtomizedNode } = useCanvasStore.getState();

        // Map doctrines to section nodes (distribute evenly)
        courseData.atomizationBlueprint.doctrines.forEach((doctrine, doctrineIdx) => {
          // Determine which section node to attach this doctrine to
          // Distribute doctrines evenly across sections
          const sectionIndex = Math.floor((doctrineIdx / courseData.atomizationBlueprint!.doctrines.length) * nodeIds.length);
          const parentSectionId = nodeIds[sectionIndex];

          console.log(`\n📚 Creating doctrine ${doctrineIdx + 1}: "${doctrine.title}"`);
          console.log(`   - Attaching to Section ${sectionIndex + 1} (${parentSectionId.substring(0, 20)}...)`);
          console.log(`   - Children count: ${doctrine.children.length}`);

          // Create the doctrine parent node
          const doctrineNodeId = addAtomizedNode(
            doctrine.content || doctrine.summary,
            parentSectionId,
            undefined,
            'doctrine', // Mark as doctrine type
            undefined
          );

          // Update the doctrine node with metadata
          updateAtomizedNode(doctrineNodeId, {
            title: doctrine.title,
            nodeType: 'doctrine',
          });

          console.log(`   ✅ Created doctrine node: ${doctrineNodeId.substring(0, 20)}...`);

          // Create child nodes for each atomization role
          doctrine.children.forEach((child, childIdx) => {
            console.log(`      - Creating child ${childIdx + 1}: role="${child.role}"`);

            // Determine content for the child
            const childContent = child.content || child.summary || child.prompt || child.question || '';

            // Determine node type based on role
            let nodeType = child.role;
            let additionalProps: any = {};

            // Handle different roles
            if (child.role === 'synthesis') {
              nodeType = 'synthesis';
              additionalProps.isSynthesis = true;
            } else if (child.role === 'quiz-mc' && child.question && child.options) {
              // Create MCQ structure
              additionalProps.mcqQuestions = [{
                question: child.question,
                options: child.options,
                correctOption: child.correctOption || child.options[0],
                explanation: child.explanation || ''
              }];
            } else if (child.role === 'quiz-short-answer' && child.question) {
              // Create short answer structure
              additionalProps.shortAnswerQuestions = [{
                question: child.question,
                sampleAnswer: child.sampleAnswer || '',
                guidance: child.guidance || ''
              }];
            }

            // Create the child node
            const childNodeId = addAtomizedNode(
              childContent,
              doctrineNodeId, // Parent is the doctrine node
              undefined,
              nodeType as NodeType,
              undefined
            );

            // Update with role-specific properties
            updateAtomizedNode(childNodeId, {
              title: child.role.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              nodeType: nodeType,
              ...additionalProps
            });

            console.log(`         ✅ Created ${child.role} node: ${childNodeId.substring(0, 20)}...`);
          });
        });

        console.log('🎓 ========================================');
        console.log('🎓 ATOMIZATION COMPLETE');
        console.log('🎓 ========================================\n');
      } else {
        console.log('ℹ️  No atomization blueprint found - skipping doctrine creation');
      }

      // Save universe with course metadata
      const { saveCurrentUniverse, saveToLocalStorage } = useCanvasStore.getState();

      // First save the current universe
      saveCurrentUniverse();

      // Get the saved universe ID and mark it as a course universe
      const state = useCanvasStore.getState();
      const savedUniverseId = Object.keys(state.universeLibrary).pop();

      if (savedUniverseId) {
        console.log('🎓 Marking universe as course mode:', savedUniverseId);

        // Use Zustand's setState to properly update the universe
        useCanvasStore.setState((state) => {
          const universe = state.universeLibrary[savedUniverseId];

          // nexuses is an array, not an object - find the nexus by ID
          const updatedNexuses = universe.nexuses.map(nexus => {
            if (nexus.id === nexusId) {
              return {
                ...nexus,
                applicationEssay: courseData.applicationEssay || undefined
              };
            }
            return nexus;
          });

          return {
            universeLibrary: {
              ...state.universeLibrary,
              [savedUniverseId]: {
                ...universe,
                courseMode: true,
                courseSettings: {
                  memoryActivation: courseData.memoryActivation,
                  mcqCount: courseData.mcqCount,
                  shortAnswerCount: courseData.shortAnswerCount,
                },
                nexuses: updatedNexuses
              }
            }
          };
        });

        console.log('✅ Course mode enabled for universe:', savedUniverseId);
        console.log('✅ Application essay saved to nexus');
      }

      // Save to localStorage with the updated course metadata
      saveToLocalStorage();

      console.log('🎓 Course created successfully!');
      console.log('   - Nexus ID:', nexusId);
      console.log('   - Sections created:', nodeIds.length);
      console.log('   - Memory activation:', courseData.memoryActivation);
      console.log('   - MCQ per section:', courseData.mcqCount);
      console.log('   - Short answer per section:', courseData.shortAnswerCount);

      setIsGenerating(false);

      // Navigate to the memories page to show the new course
      router.push('/memories');
    } catch (error) {
      console.error('❌ Failed to create course:', error);
      setIsGenerating(false);
      alert('Failed to create course. Please check the console for details.');
    }
  };

  const nextStep = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return courseData.title.trim() !== '';
      case 2:
        // Check that timestamps are filled and all section contents have text
        const hasTimestamps = courseData.timestamps.trim() !== '';
        const sectionCount = courseData.timestamps.split(',').filter(t => t.trim()).length;
        const allSectionsHaveContent = courseData.sectionContents.length === sectionCount &&
          courseData.sectionContents.every(content => content.trim() !== '');

        return courseData.fullTextContent.trim() !== '' &&
          hasTimestamps &&
          allSectionsHaveContent;
      case 3:
        return true; // Settings are optional
      case 4:
        return true; // Review is always passable
      case 5:
        return courseData.generatedQuestions.length > 0; // Must have questions
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-cyan-300">Course Builder</h1>
          <p className="text-sm text-gray-400 mt-1">
            Create a structured learning experience with locked progression
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step < currentStep
                    ? 'bg-green-500 text-white'
                    : step === currentStep
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-gray-400'
                    }`}
                >
                  {step < currentStep ? '✓' : step}
                </div>
                <div className={`text-xs mt-2 ${step === currentStep ? 'text-cyan-300 font-bold' : 'text-gray-500'}`}>
                  {step === 1 && 'Basic Info'}
                  {step === 2 && 'Content'}
                  {step === 3 && 'Settings'}
                  {step === 4 && 'Review'}
                  {step === 5 && 'Questions'}
                  {step === 6 && 'Essay'}
                </div>
              </div>
              {step < 6 && (
                <div className={`h-1 flex-1 ${step < currentStep ? 'bg-green-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="bg-slate-800/50 rounded-2xl border border-cyan-500/20 p-8">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 🎥 AI Video Import */}
              <div className="bg-slate-800/50 p-6 rounded-xl border border-cyan-500/30 mb-8">
                <h3 className="text-lg font-bold text-cyan-300 mb-2 flex items-center gap-2">
                  <span>🎥</span> AI Video Import (Gemini 2.0 Flash)
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Upload a video file (max 20MB) and let Gemini automatically generate the course title, description, content, and structure for you.
                </p>

                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Video File
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-cyan-500/10 file:text-cyan-300
                        hover:file:bg-cyan-500/20
                        cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleVideoUpload}
                    disabled={!selectedFile || isAnalyzingVideo}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${!selectedFile || isAnalyzingVideo
                      ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/20'
                      }`}
                  >
                    {isAnalyzingVideo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <span>✨</span> Analyze Video
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">OR Enter Manually</span>
                <div className="flex-grow border-t border-gray-700"></div>
              </div>

              <h2 className="text-xl font-bold text-cyan-300 mb-4">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Course Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={courseData.title}
                  onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                  placeholder="e.g., Introduction to Constitutional Law"
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Course Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={courseData.description}
                  onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                  placeholder="Briefly describe what students will learn..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Content Upload */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">Course Content</h2>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Text Content <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  This becomes the Nexus content - the foundational material for the entire course
                </p>
                <textarea
                  value={courseData.fullTextContent}
                  onChange={(e) => setCourseData({ ...courseData, fullTextContent: e.target.value })}
                  placeholder="Paste the complete course material, lecture notes, or reading content here..."
                  rows={8}
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none font-mono text-sm"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video URL <span className="text-gray-500">(Optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  YouTube or Vimeo link - only needed if you want to embed a video player
                </p>
                <input
                  type="text"
                  value={courseData.videoUrl}
                  onChange={(e) => setCourseData({ ...courseData, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Timestamp Chunks <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Separate each section with a comma. Format: 0:00-8:30, 8:30-15:45, 15:45-22:30
                </p>
                <textarea
                  value={courseData.timestamps}
                  onChange={(e) => {
                    const newTimestamps = e.target.value;
                    const sectionCount = newTimestamps.split(',').filter(t => t.trim()).length;

                    // Initialize or adjust sectionContents array to match section count
                    const newSectionContents = [...courseData.sectionContents];
                    while (newSectionContents.length < sectionCount) {
                      newSectionContents.push('');
                    }
                    newSectionContents.length = sectionCount; // Trim if too long

                    setCourseData({
                      ...courseData,
                      timestamps: newTimestamps,
                      sectionContents: newSectionContents
                    });
                  }}
                  placeholder="0:00-8:30, 8:30-15:45, 15:45-22:30"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                />
              </div>

              {/* Section Content Inputs - Show only if timestamps are entered */}
              {courseData.timestamps.trim() && courseData.timestamps.split(',').filter(t => t.trim()).length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-bold text-cyan-300 mb-2">Section Content</h3>
                    <p className="text-sm text-gray-400">
                      Enter the text content for each video section below. This will appear in the modal when students view each section.
                    </p>
                  </div>

                  {courseData.timestamps.split(',').map((timestamp, index) => (
                    <div key={index} className="bg-slate-900/50 rounded-lg p-4 border border-cyan-500/20">
                      <label className="block text-sm font-medium text-cyan-300 mb-2">
                        Section {index + 1}: {timestamp.trim()}
                      </label>
                      <textarea
                        value={courseData.sectionContents[index] || ''}
                        onChange={(e) => {
                          const newSectionContents = [...courseData.sectionContents];
                          newSectionContents[index] = e.target.value;
                          setCourseData({ ...courseData, sectionContents: newSectionContents });
                        }}
                        placeholder={`Enter content for section ${index + 1}...`}
                        rows={6}
                        className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">Course Settings</h2>


              <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-500/20">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseData.memoryActivation}
                    onChange={(e) => setCourseData({ ...courseData, memoryActivation: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-cyan-500/50 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-medium text-gray-200">Memory Activation</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Make all previous section content active in memory for each new section.
                      This helps students connect ideas across the course.
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Multiple Choice Questions per Section
                </label>
                <select
                  value={courseData.mcqCount}
                  onChange={(e) => setCourseData({ ...courseData, mcqCount: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={3}>3 questions</option>
                  <option value={4}>4 questions</option>
                  <option value={5}>5 questions</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Short Answer Questions per Section
                </label>
                <select
                  value={courseData.shortAnswerCount}
                  onChange={(e) => setCourseData({ ...courseData, shortAnswerCount: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>1 question</option>
                  <option value={2}>2 questions</option>
                  <option value={3}>3 questions</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">Review & Generate</h2>

              <div className="bg-slate-900/50 rounded-lg p-6 border border-cyan-500/20 space-y-4">
                <div>
                  <div className="text-sm text-gray-400">Course Title</div>
                  <div className="text-lg font-bold text-white mt-1">{courseData.title}</div>
                </div>

                {courseData.description && (
                  <div>
                    <div className="text-sm text-gray-400">Description</div>
                    <div className="text-gray-200 mt-1">{courseData.description}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-400">Video</div>
                  <div className="text-gray-200 mt-1 font-mono text-sm truncate">{courseData.videoUrl}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-400">Sections</div>
                  <div className="text-cyan-300 mt-1 font-bold">
                    {courseData.timestamps.split(',').length} sections will be created
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <div className="text-sm text-gray-400">Memory Activation</div>
                    <div className="text-white mt-1">{courseData.memoryActivation ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Quiz Settings</div>
                    <div className="text-white mt-1">
                      {courseData.mcqCount} MCQ + {courseData.shortAnswerCount} Short Answer
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-2xl">✨</div>
                  <div>
                    <div className="font-bold text-cyan-300">Next: Generate Questions</div>
                    <div className="text-sm text-cyan-200/80 mt-1">
                      Click "Generate Questions" to create {courseData.mcqCount} MCQs and {courseData.shortAnswerCount} short answer questions for each section using AI.
                      You'll be able to review and edit all questions before finalizing the course.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Edit Questions */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-cyan-300">Review & Edit Questions</h2>
                {isGeneratingQuestions && (
                  <div className="text-sm text-cyan-400">
                    Generating questions for section {questionGenerationProgress.current} of {questionGenerationProgress.total}...
                  </div>
                )}
              </div>

              {courseData.generatedQuestions.length === 0 ? (
                <div className="bg-slate-900/50 rounded-lg p-8 border border-cyan-500/20 text-center">
                  <div className="text-gray-400 mb-4">No questions generated yet</div>
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={isGeneratingQuestions}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                  >
                    {isGeneratingQuestions ? 'Generating...' : '✨ Generate Questions'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {courseData.generatedQuestions.map((sectionQuestions, sectionIndex) => (
                    <div key={sectionIndex} className="bg-slate-900/50 rounded-lg p-6 border border-cyan-500/20">
                      <h3 className="text-lg font-bold text-cyan-300 mb-4">
                        Section {sectionIndex + 1}: {courseData.timestamps.split(',')[sectionIndex]?.trim()}
                      </h3>

                      {/* MCQs */}
                      <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-300 mb-3">Multiple Choice Questions</h4>
                        {sectionQuestions.mcqs.map((mcq, mcqIndex) => (
                          <div key={mcqIndex} className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                Question {mcqIndex + 1}
                              </label>
                              <textarea
                                value={mcq.question}
                                onChange={(e) => {
                                  const updated = [...courseData.generatedQuestions];
                                  updated[sectionIndex].mcqs[mcqIndex].question = e.target.value;
                                  setCourseData({ ...courseData, generatedQuestions: updated });
                                }}
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                                <div key={letter}>
                                  <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Option {letter} {mcq.correctAnswer === letter && '✓ Correct'}
                                  </label>
                                  <input
                                    type="text"
                                    value={mcq.options[letter]}
                                    onChange={(e) => {
                                      const updated = [...courseData.generatedQuestions];
                                      updated[sectionIndex].mcqs[mcqIndex].options[letter] = e.target.value;
                                      setCourseData({ ...courseData, generatedQuestions: updated });
                                    }}
                                    className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                Correct Answer
                              </label>
                              <select
                                value={mcq.correctAnswer}
                                onChange={(e) => {
                                  const updated = [...courseData.generatedQuestions];
                                  updated[sectionIndex].mcqs[mcqIndex].correctAnswer = e.target.value;
                                  setCourseData({ ...courseData, generatedQuestions: updated });
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                Explanation
                              </label>
                              <textarea
                                value={mcq.explanation}
                                onChange={(e) => {
                                  const updated = [...courseData.generatedQuestions];
                                  updated[sectionIndex].mcqs[mcqIndex].explanation = e.target.value;
                                  setCourseData({ ...courseData, generatedQuestions: updated });
                                }}
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Short Answers */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-300 mb-3">Short Answer Questions</h4>
                        {sectionQuestions.shortAnswers.map((sa, saIndex) => (
                          <div key={saIndex} className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                Question {saIndex + 1}
                              </label>
                              <textarea
                                value={sa.question}
                                onChange={(e) => {
                                  const updated = [...courseData.generatedQuestions];
                                  updated[sectionIndex].shortAnswers[saIndex].question = e.target.value;
                                  setCourseData({ ...courseData, generatedQuestions: updated });
                                }}
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                Sample Answer / Rubric
                              </label>
                              <textarea
                                value={sa.sampleAnswer}
                                onChange={(e) => {
                                  const updated = [...courseData.generatedQuestions];
                                  updated[sectionIndex].shortAnswers[saIndex].sampleAnswer = e.target.value;
                                  setCourseData({ ...courseData, generatedQuestions: updated });
                                }}
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review & Edit Application Essay */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-purple-300 mb-4">Review & Edit Application Essay</h2>

              {!courseData.applicationEssay ? (
                <div className="bg-slate-900/50 rounded-lg p-8 border border-purple-500/20 text-center">
                  <div className="text-gray-400 mb-4">No application essay generated yet</div>
                  <button
                    onClick={handleGenerateApplicationEssay}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                  >
                    {isGenerating ? 'Generating...' : '✨ Generate Application Essay'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Essay Question */}
                  <div className="bg-slate-900/50 rounded-lg p-6 border border-purple-500/20">
                    <h3 className="text-lg font-bold text-purple-300 mb-3">Essay Question</h3>
                    <textarea
                      value={courseData.applicationEssay.question}
                      onChange={(e) => {
                        if (courseData.applicationEssay) {
                          setCourseData({
                            ...courseData,
                            applicationEssay: {
                              ...courseData.applicationEssay,
                              question: e.target.value
                            }
                          });
                        }
                      }}
                      rows={12}
                      className="w-full px-4 py-3 bg-slate-900 border border-purple-500/30 rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                      placeholder="Essay question will appear here..."
                    />
                  </div>

                  {/* Grading Rubric */}
                  <div className="bg-slate-900/50 rounded-lg p-6 border border-purple-500/20">
                    <h3 className="text-lg font-bold text-purple-300 mb-3">Grading Rubric</h3>
                    <textarea
                      value={courseData.applicationEssay.rubric}
                      onChange={(e) => {
                        if (courseData.applicationEssay) {
                          setCourseData({
                            ...courseData,
                            applicationEssay: {
                              ...courseData.applicationEssay,
                              rubric: e.target.value
                            }
                          });
                        }
                      }}
                      rows={15}
                      className="w-full px-4 py-3 bg-slate-900 border border-purple-500/30 rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                      placeholder="Grading rubric will appear here..."
                    />
                  </div>

                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-sm text-purple-200">
                      💡 <strong>Tip:</strong> Review and edit both the essay question and rubric to ensure they align with your course objectives. The rubric will help you evaluate student responses consistently.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
            >
              Back
            </button>

            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                disabled={!canProceedFromStep(currentStep)}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : currentStep === 4 ? (
              <button
                onClick={handleGenerateQuestions}
                disabled={isGeneratingQuestions}
                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-bold disabled:cursor-not-allowed"
              >
                {isGeneratingQuestions ? `Generating... (${questionGenerationProgress.current}/${questionGenerationProgress.total})` : '✨ Generate Questions'}
              </button>
            ) : currentStep === 5 ? (
              <button
                onClick={nextStep}
                disabled={courseData.generatedQuestions.length === 0}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleGenerateCourse}
                disabled={isGenerating || !courseData.applicationEssay}
                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-gray-600 text-white rounded-lg transition-all font-bold disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Creating Course...' : '🎓 Create Course'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
