// @aiusb/gateway — 语音 & Ollama API

import type { FastifyInstance } from 'fastify';
import { edgeTTS, getEdgeVoices, getLatestTTSBuffer } from '../voice/tts.js';
import { detectOllama, getOllamaInstallGuide } from '../voice/ollama.js';

export function voiceRoutes(app: FastifyInstance) {
  // TTS 合成
  app.post('/tts', async (request, reply) => {
    const { text, voice } = request.body as { text: string; voice?: string };
    if (!text) return reply.status(400).send({ status: 'error', message: 'text 必填' });

    try {
      const buffer = await edgeTTS({ text, voice });
      reply.header('Content-Type', 'audio/mpeg');
      return buffer;
    } catch (err) {
      return { status: 'error', message: `TTS 失败: ${(err as Error).message}` };
    }
  });

  // 可用语音列表
  app.get('/voices', async () => {
    return { status: 'ok', data: getEdgeVoices() };
  });

  // 检测 Ollama
  app.get('/ollama/status', async () => {
    const status = await detectOllama();
    return { status: 'ok', data: status };
  });

  // Ollama 安装指南
  app.get('/ollama/guide', async () => {
    return { status: 'ok', data: { guide: getOllamaInstallGuide() } };
  });
}
