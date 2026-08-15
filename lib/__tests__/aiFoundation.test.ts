import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import {
  AIJsonParseError,
  makeObjectSchema,
  parseAIJson,
} from '../ai/json';
import {
  applicationLabSchema,
  getChatModeDefinition,
} from '../ai/chatModeRegistry';
import {
  getOpenAISystemContent,
  getTextFromAIResponse,
  safeAICall,
} from '../ai/providers';
import { chunkNexusText } from '../ai/textChunking';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function run() {
  console.log('\n=== AI Foundation Tests ===\n');

  const objectSchema = makeObjectSchema<{ answer: string }>(
    'Answer',
    value => typeof value.answer === 'string'
  );

  assert.deepEqual(parseAIJson('```json\n{"answer":"yes"}\n```', objectSchema), { answer: 'yes' });
  assert.deepEqual(parseAIJson('Result: {"answer":"yes",} Thanks.', objectSchema), { answer: 'yes' });
  assert.deepEqual(parseAIJson('{"answer":"line one\nline two"}', objectSchema), {
    answer: 'line one\nline two',
  });
  assert.throws(
    () => parseAIJson('{"wrong":true}', objectSchema),
    error => error instanceof AIJsonParseError && error.message.includes('Answer')
  );
  console.log('✓ JSON extraction, repair, and schema validation');

  assert.equal(getChatModeDefinition('unknown-mode'), null);
  assert.deepEqual(
    parseAIJson(
      '{"doctrineSummary":"Summary","scenarios":[{"prompt":"Try this"}],"finalEssayPrompt":"Explain"}',
      applicationLabSchema
    ).scenarios,
    [{ prompt: 'Try this' }]
  );
  console.log('✓ Chat mode registry and response schemas');

  const chunks = chunkNexusText('word '.repeat(1300), {
    sourceTitle: 'Long source',
    fileName: 'source.txt',
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.text.length <= 2800));
  assert.ok(chunks.every(chunk => chunk.sourceReference.sourceTitle === 'Long source'));
  assert.deepEqual(chunkNexusText('   '), []);
  console.log('✓ Text chunking bounds and source metadata');

  assert.equal(getOpenAISystemContent([{ text: 'one' }, { text: 'two' }]), 'one\n\ntwo');
  assert.equal(getTextFromAIResponse({ content: [{ type: 'text', text: 'hello' }] }), 'hello');

  const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  let capturedTemperature: unknown;

  try {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const openaiOnly = {
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedTemperature = request.temperature;
            return { choices: [{ message: { content: 'fallback response' } }] };
          },
        },
      },
    } as unknown as OpenAI;

    const openAIResponse = await safeAICall({} as Anthropic, openaiOnly, {
      system: 'System prompt',
      messages: [{ role: 'user', content: 'Question' }],
      temperature: 0,
    });

    assert.equal(getTextFromAIResponse(openAIResponse), 'fallback response');
    assert.equal(capturedTemperature, 0);

    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const anthropicFailure = {
      messages: {
        create: async () => {
          throw new Error('Anthropic unavailable');
        },
      },
    } as unknown as Anthropic;

    const fallbackResponse = await safeAICall(anthropicFailure, openaiOnly, {
      messages: [{ role: 'user', content: 'Question' }],
    });
    assert.equal(getTextFromAIResponse(fallbackResponse), 'fallback response');

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      () => safeAICall({} as Anthropic, {} as OpenAI, { messages: [] }),
      /No valid AI provider key/
    );
  } finally {
    restoreEnv('ANTHROPIC_API_KEY', previousAnthropicKey);
    restoreEnv('OPENAI_API_KEY', previousOpenAIKey);
  }
  console.log('✓ Provider selection, fallback, and zero-temperature handling');

  console.log('\n=== All AI foundation tests passed! ===\n');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
