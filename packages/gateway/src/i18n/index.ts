// @aiusb/gateway — 国际化框架（i18n）
// Phase 2 实现中文，框架保留，语言包按需添加

export type SupportedLocale = 'zh-CN' | 'en-US';

interface LocaleMessages {
  [key: string]: string;
}

const zhCN: LocaleMessages = {
  'pipeline.blocked.waking': '未唤醒：需要 @机器人 或触发关键词',
  'pipeline.blocked.whitelist': '不在白名单中',
  'pipeline.blocked.ratelimit': '发送过于频繁，请稍后再试',
  'pipeline.blocked.content_safety': '消息包含违规内容',
  'pipeline.blocked.internal': '内部错误',
  'agent.echo_mode': '演示模式',
  'agent.echo_prefix': '收到你的消息',
  'agent.no_api_key': '请先配置 API 密钥以启用 AI 回复',
  'agent.error': '抱歉，AI 引擎暂时无法响应，请稍后再试',
  'search.no_results': '未找到相关搜索结果',
  'tts.generated': '已生成语音',
  'backup.success': '备份已完成',
  'backup.restored': '数据已恢复',
  'update.available': '有可用更新',
  'update.latest': '已是最新版本',
};

const enUS: LocaleMessages = {
  'pipeline.blocked.waking': 'Not triggered: @bot or keyword required',
  'pipeline.blocked.whitelist': 'Not in whitelist',
  'pipeline.blocked.ratelimit': 'Rate limit exceeded, please try later',
  'pipeline.blocked.content_safety': 'Content violates safety policy',
  'pipeline.blocked.internal': 'Internal error',
  'agent.echo_mode': 'Demo Mode',
  'agent.echo_prefix': 'Received your message',
  'agent.no_api_key': 'Please configure API key to enable AI replies',
  'agent.error': 'AI engine temporarily unavailable, please try later',
  'search.no_results': 'No relevant results found',
  'tts.generated': 'Audio generated',
  'backup.success': 'Backup completed',
  'backup.restored': 'Data restored',
  'update.available': 'Update available',
  'update.latest': 'Already up to date',
};

const messages: Record<SupportedLocale, LocaleMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

let currentLocale: SupportedLocale = 'zh-CN';

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function t(key: string, fallback?: string): string {
  return messages[currentLocale]?.[key] ?? fallback ?? key;
}

export function getSupportedLocales(): Array<{ id: SupportedLocale; name: string }> {
  return [
    { id: 'zh-CN', name: '中文（简体）' },
    { id: 'en-US', name: 'English (US)' },
  ];
}
