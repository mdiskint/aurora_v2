export async function searchWeb(query: string, maxResults: number = 5): Promise<string> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!response.ok) {
    console.error('[searchWeb] Tavily error:', response.status, await response.text());
    return '';
  }
  const data = await response.json();
  return data.results
    .map((r: any) => '--- Source: ' + r.title + ' (' + r.url + ') ---\n' + r.content)
    .join('\n\n');
}
