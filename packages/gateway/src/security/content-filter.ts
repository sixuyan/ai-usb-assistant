// @aiusb/gateway — 内容安全过滤词库 + 管理器

export interface FilterRule {
  id: string;
  category: 'political' | 'spam' | 'advertising' | 'harassment' | 'custom';
  pattern: string;    // 正则或关键词
  isRegex: boolean;
  action: 'block' | 'warn' | 'log';
  enabled: boolean;
}

// 内置词库（Phase 2 示例，后续可从文件加载）
const BUILTIN_RULES: FilterRule[] = [
  // 广告/垃圾
  { id: 'ad-001', category: 'advertising', pattern: '加微信|加V信|加薇信', isRegex: true, action: 'block', enabled: true },
  { id: 'ad-002', category: 'advertising', pattern: '兼职.*日结|日入.*元|月入.*万', isRegex: true, action: 'block', enabled: true },
  { id: 'ad-003', category: 'advertising', pattern: '免费领取|免费送|点击就送', isRegex: true, action: 'block', enabled: true },
  { id: 'ad-004', category: 'advertising', pattern: '扫码.*关注|关注.*公众号|扫码.*领取', isRegex: true, action: 'block', enabled: true },
  { id: 'ad-005', category: 'spam', pattern: '(.)\\1{10,}', isRegex: true, action: 'block', enabled: true }, // 刷屏
  { id: 'ad-006', category: 'advertising', pattern: 'http[s]?://(?!.*(qq\\.com|tencent\\.com))', isRegex: true, action: 'warn', enabled: true },

  // 骚扰
  { id: 'hr-001', category: 'harassment', pattern: '傻[逼比]|脑残|弱智|白痴|废[物柴]', isRegex: true, action: 'warn', enabled: true },
  { id: 'hr-002', category: 'harassment', pattern: '[操草艹][你尼拟]妈|[日肏][你尼拟]|[操草艹][你尼拟]', isRegex: true, action: 'block', enabled: true },
  { id: 'hr-003', category: 'harassment', pattern: '[死去][全家妈]|全家.*死|断子绝孙', isRegex: true, action: 'block', enabled: true },

  // 政治敏感（示例，需根据实际情况调整）
  { id: 'pl-001', category: 'political', pattern: '法轮功|falungong|六四|天安门事件', isRegex: true, action: 'block', enabled: true },
  { id: 'pl-002', category: 'political', pattern: '台独|藏独|疆独|港独', isRegex: true, action: 'block', enabled: true },
];

export class ContentFilter {
  private rules: FilterRule[] = [];

  constructor() {
    this.rules = [...BUILTIN_RULES];
  }

  /** 加载自定义规则 */
  loadRules(rules: FilterRule[]): void {
    this.rules = [...BUILTIN_RULES, ...rules];
  }

  /** 获取所有规则 */
  getRules(): FilterRule[] {
    return this.rules;
  }

  /** 添加自定义规则 */
  addRule(rule: Omit<FilterRule, 'id'>): FilterRule {
    const newRule: FilterRule = {
      ...rule,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.rules.push(newRule);
    return newRule;
  }

  /** 删除规则 */
  removeRule(id: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** 切换规则启用状态 */
  toggleRule(id: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === id);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /** 检查文本是否包含违规内容 */
  check(text: string): { safe: boolean; matched?: string; rule?: FilterRule } {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      let matched = false;
      if (rule.isRegex) {
        try {
          matched = new RegExp(rule.pattern, 'i').test(text);
        } catch {
          // 跳过无效正则
        }
      } else {
        matched = text.toLowerCase().includes(rule.pattern.toLowerCase());
      }

      if (matched) {
        return { safe: false, matched: rule.pattern, rule };
      }
    }

    return { safe: true };
  }
}
