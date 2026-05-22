// @aiusb/gateway — Web 搜索工具

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 网页搜索（使用 DuckDuckGo Instant Answer API，免费无需 Key）
 * Phase 2 使用 DuckDuckGo，后续可切 SearXNG 自建服务
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-USB-Assistant/0.1' },
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      Abstract?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: SearchResult[] = [];

    // 主摘要
    if (data.Abstract && data.Abstract.trim()) {
      results.push({
        title: data.AbstractSource ?? 'DuckDuckGo',
        url: data.AbstractURL ?? '',
        snippet: data.Abstract,
      });
    }

    // 关联主题
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && topic.FirstURL && results.length < maxResults) {
          results.push({
            title: topic.Text.split(' - ')[0] ?? topic.Text.slice(0, 60),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }

    return results.slice(0, maxResults);
  } catch (err) {
    console.error('[WebSearch] Error:', err);
    return [];
  }
}

/** 格式化搜索结果供 LLM 使用 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '未找到相关搜索结果。';

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   ${r.url}`)
    .join('\n\n');
}
