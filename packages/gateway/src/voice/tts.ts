// @aiusb/gateway — 语音能力（TTS + ASR）

// ============================================================
// Edge TTS（免费，无需 API Key）
// 使用 Microsoft Edge 的免费 TTS 服务
// ============================================================

export interface TTSOptions {
  text: string;
  voice?: string;     // 默认 zh-CN-XiaoxiaoNeural
  rate?: string;      // 语速，如 "+0%" "-20%"
  pitch?: string;     // 语调，如 "+0Hz"
}

/** 生成 Edge TTS 语音的音频 Buffer */
export async function edgeTTS(options: TTSOptions): Promise<Buffer> {
  const { text, voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%', pitch = '+0Hz' } = options;

  // Edge TTS 使用 SSML 格式的 WebSocket API
  const endpoint = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="${rate}" pitch="${pitch}">${escapeXml(text)}</prosody>
    </voice>
  </speak>`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-opus-mp3',
    },
    body: ssml,
  });

  if (!response.ok) throw new Error(`Edge TTS failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** 获取可用的 Edge TTS 语音列表 */
export function getEdgeVoices(): Array<{ id: string; name: string; locale: string }> {
  return [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女）', locale: 'zh-CN' },
    { id: 'zh-CN-YunxiNeural', name: '云希（男）', locale: 'zh-CN' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊（女）', locale: 'zh-CN' },
    { id: 'zh-CN-YunjianNeural', name: '云健（男）', locale: 'zh-CN' },
    { id: 'en-US-JennyNeural', name: 'Jenny (US Female)', locale: 'en-US' },
  ];
}

// ============================================================
// ASR 语音识别（使用 Edge 免费识别服务）
// ============================================================

/** 使用 Edge 免费语音识别转换音频为文本 */
export async function edgeASR(audioBuffer: Buffer): Promise<string> {
  // Phase 3 简化实现：对于语音消息，引导用户使用文字
  // 完整实现需要集成 Whisper API 或 Edge 识别服务
  return '[语音消息] - 语音转文字功能将在后续版本中支持，请发送文字消息';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// TTS 能力注册
// ============================================================

import type { Capability } from '../capability/registry.js';

export const ttsCapability: Capability = {
  meta: {
    id: 'tts',
    name: '语音合成',
    icon: '🔊',
    description: '将文字转换为语音',
    version: '1.0.0',
    category: 'utility',
  },
  tools: [
    {
      definition: {
        name: 'text_to_speech',
        description: '将文本转换为语音（返回音频数据提示）',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '要转换为语音的文本' },
            voice: { type: 'string', description: '语音名称，如 zh-CN-XiaoxiaoNeural' },
          },
          required: ['text'],
        },
      },
      execute: async (args) => {
        const text = args.text as string;
        ttsBuffer = await edgeTTS({ text });
        return `已生成语音（${ttsBuffer.length} 字节），音频文件已就绪`;
      },
    },
  ],
};

// 存储最近一次 TTS 结果的 buffer（供 API 获取）
let ttsBuffer: Buffer = Buffer.alloc(0);

export function getLatestTTSBuffer(): Buffer {
  return ttsBuffer;
}
