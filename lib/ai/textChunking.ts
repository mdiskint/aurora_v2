import { SourceReference } from '@/lib/types';

export type SourceChunk = {
  id: string;
  title: string;
  text: string;
  sourceReference: SourceReference;
};

type ChunkSourceMetadata = {
  sourceTitle?: string;
  fileName?: string;
  kind?: SourceReference['kind'];
};

const TARGET_CHARS = 1800;
const MAX_CHARS = 2800;

export function chunkNexusText(text: string, metadata: ChunkSourceMetadata = {}): SourceChunk[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const sections = splitStructuredSections(normalized);
  const merged = mergeSmallSections(sections);

  return merged.map((section, index) => {
    const title = section.title || inferChunkTitle(section.text, index);
    return {
      id: `chunk-${index + 1}`,
      title,
      text: section.text,
      sourceReference: {
        kind: metadata.kind || 'manual',
        sourceTitle: metadata.sourceTitle,
        fileName: metadata.fileName,
        section: title,
        quotedText: section.text.slice(0, 700),
      },
    };
  });
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitStructuredSections(text: string): Array<{ title: string; text: string }> {
  const slideMatches = [...text.matchAll(/^---\s*Slide\s+\d+\s*---$/gim)];
  if (slideMatches.length > 1) {
    return splitByMatches(text, slideMatches.map(match => ({
      index: match.index || 0,
      title: match[0].trim(),
    })));
  }

  const headingMatches = [...text.matchAll(/^(#{1,4}\s+.+|[A-Z][A-Za-z0-9 ,:'"()/-]{8,90})$/gm)]
    .filter(match => (match.index || 0) === 0 || text[(match.index || 0) - 1] === '\n');

  if (headingMatches.length > 2) {
    return splitByMatches(text, headingMatches.map(match => ({
      index: match.index || 0,
      title: match[0].replace(/^#{1,4}\s+/, '').trim(),
    })));
  }

  return splitParagraphs(text);
}

function splitByMatches(text: string, matches: Array<{ index: number; title: string }>) {
  const sections: Array<{ title: string; text: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const sectionText = text.slice(current.index, next?.index ?? text.length).trim();
    if (sectionText) {
      sections.push({ title: current.title, text: sectionText });
    }
  }

  return sections.flatMap(section => splitOversizedSection(section));
}

function splitParagraphs(text: string) {
  const paragraphs = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const chunks: Array<{ title: string; text: string }> = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    if (currentLength > 0 && currentLength + paragraph.length > TARGET_CHARS) {
      const chunkText = current.join('\n\n');
      chunks.push({ title: inferChunkTitle(chunkText, chunks.length), text: chunkText });
      current = [];
      currentLength = 0;
    }

    current.push(paragraph);
    currentLength += paragraph.length;
  }

  if (current.length > 0) {
    const chunkText = current.join('\n\n');
    chunks.push({ title: inferChunkTitle(chunkText, chunks.length), text: chunkText });
  }

  return chunks.flatMap(section => splitOversizedSection(section));
}

function splitOversizedSection(section: { title: string; text: string }) {
  if (section.text.length <= MAX_CHARS) return [section];

  const sentences = (section.text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [section.text])
    .flatMap(sentence => splitLongSegment(sentence.trim()));
  const chunks: Array<{ title: string; text: string }> = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length > 0 && current.length + sentence.length > TARGET_CHARS) {
      chunks.push({
        title: chunks.length === 0 ? section.title : `${section.title} (${chunks.length + 1})`,
        text: current.trim(),
      });
      current = '';
    }
    current += `${current ? ' ' : ''}${sentence}`;
  }

  if (current.trim()) {
    chunks.push({
      title: chunks.length === 0 ? section.title : `${section.title} (${chunks.length + 1})`,
      text: current.trim(),
    });
  }

  return chunks;
}

function splitLongSegment(text: string) {
  if (text.length <= MAX_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHARS) {
    const candidate = remaining.slice(0, TARGET_CHARS);
    const lastWhitespace = candidate.lastIndexOf(' ');
    const splitAt = lastWhitespace > TARGET_CHARS * 0.6 ? lastWhitespace : TARGET_CHARS;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function mergeSmallSections(sections: Array<{ title: string; text: string }>) {
  const merged: Array<{ title: string; text: string }> = [];
  let pending: { title: string; text: string } | null = null;

  for (const section of sections) {
    if (!pending) {
      pending = section;
      continue;
    }

    if (pending.text.length < 700 && pending.text.length + section.text.length <= MAX_CHARS) {
      pending = {
        title: `${pending.title} / ${section.title}`,
        text: `${pending.text}\n\n${section.text}`,
      };
    } else {
      merged.push(pending);
      pending = section;
    }
  }

  if (pending) merged.push(pending);
  return merged;
}

function inferChunkTitle(text: string, index: number) {
  const firstLine = text.split('\n').find(line => line.trim().length > 0)?.trim() || `Chunk ${index + 1}`;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}
