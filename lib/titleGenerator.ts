/**
 * Generate a semantic title for a node using AI
 * Returns a 5-10 word summary that captures the core idea
 */
export async function generateSemanticTitle(content: string): Promise<string> {
  try {
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`Title generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.title || content.slice(0, 50) + '...'; // Fallback
  } catch (error) {
    console.error('❌ Title generation failed:', error);
    // Fallback to truncated content
    return content.slice(0, 50) + '...';
  }
}

/**
 * Generate semantic titles for multiple nodes in parallel
 * Useful for batch operations like Explore mode
 */
export async function generateSemanticTitles(contents: string[]): Promise<string[]> {
  try {
    const titlePromises = contents.map(content => generateSemanticTitle(content));
    return await Promise.all(titlePromises);
  } catch (error) {
    console.error('❌ Batch title generation failed:', error);
    // Fallback to truncated content for all
    return contents.map(content => content.slice(0, 50) + '...');
  }
}

/**
 * Get display title for a node, with fallback
 */
export function getDisplayTitle(node: { semanticTitle?: string; content: string }): string {
  return node.semanticTitle || node.content.slice(0, 50) + '...';
}

/**
 * Get icon for node type
 */
export function getNodeTypeIcon(nodeType?: string): string {
  switch (nodeType) {
    case 'ai-response':
      return '🤖';
    case 'socratic-question':
      return '⭐';
    case 'synthesis':
      return '💎';
    case 'inspiration':
      return '💡';
    case 'user-reply':
    case 'socratic-answer':
      return '📝';
    default:
      return '📝';
  }
}
