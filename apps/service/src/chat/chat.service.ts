import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private model: ChatOpenAI;
  private readonly apiKey: string | undefined;
  private readonly baseURL: string;
  private readonly isDeepSeek: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // 从环境变量读取配置
    // 支持 DeepSeek API（优先）或 OpenAI API
    const deepSeekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.deepseek.com';
    let modelName = this.configService.get<string>('OPENAI_MODEL_NAME') || 'deepseek-chat';
    
    // 如果使用 DeepSeek API，验证模型名称
    if (baseURL.includes('deepseek.com')) {
      // DeepSeek 支持的模型名称：deepseek-chat, deepseek-reasoner
      const validDeepSeekModels = ['deepseek-chat', 'deepseek-reasoner'];
      if (!validDeepSeekModels.includes(modelName.toLowerCase())) {
        this.logger.warn(
          `模型名称 "${modelName}" 不是有效的 DeepSeek 模型，使用默认值 "deepseek-chat"`,
        );
        modelName = 'deepseek-chat';
      }
    }
    
    // 确保 temperature 是数字类型
    const temperatureStr = this.configService.get<string>('OPENAI_TEMPERATURE');
    const temperature = temperatureStr ? parseFloat(temperatureStr) : 0;
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    
    // 优先使用 DeepSeek API Key，如果没有则使用 OpenAI API Key
    this.apiKey = deepSeekApiKey || openAiApiKey;
    this.baseURL = baseURL;
    this.isDeepSeek = baseURL.includes('deepseek.com');
    
    // 记录配置信息（不显示敏感信息）
    this.logger.log(`Configuration loaded:`);
    this.logger.log(`- DEEPSEEK_API_KEY: ${deepSeekApiKey ? '✓ Set' : '✗ Not set'}`);
    this.logger.log(`- OPENAI_API_KEY: ${openAiApiKey ? '✓ Set' : '✗ Not set'}`);
    this.logger.log(`- OPENAI_BASE_URL: ${baseURL}`);
    this.logger.log(`- OPENAI_MODEL_NAME: ${modelName}`);
    this.logger.log(`- OPENAI_TEMPERATURE: ${temperature}`);
    this.logger.log(`- DATABASE_URL: ${databaseUrl ? '✓ Set' : '✗ Not set'}`);
    this.logger.log(`- Using DeepSeek API: ${this.isDeepSeek ? 'Yes' : 'No'}`);
    
    if (!this.apiKey) {
      this.logger.warn(
        'Neither DEEPSEEK_API_KEY nor OPENAI_API_KEY is set. Chat features will not work.',
      );
    }

    if (!databaseUrl) {
      this.logger.warn(
        'DATABASE_URL is not set. Database connection may fail.',
      );
    }

    // 初始化 LangChain ChatOpenAI 模型
    // 支持自定义 baseURL（用于 DeepSeek）
    // LangChain ChatOpenAI 支持通过 configuration 参数设置 baseURL
    this.model = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: modelName,
      temperature: temperature,
      ...(baseURL && baseURL !== 'https://api.openai.com/v1' && {
        configuration: {
          baseURL: baseURL,
        },
      }),
    });

  }

  async processMessage(dto: SendMessageDto) {
    const { content, userId, sessionId } = dto;

    // 0. Ensure user exists (create if not exists)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@temp.local`, // Temporary email for test users
      },
    });

    // 1. Get or create session
    let session = sessionId
      ? await this.prisma.chatSession.findUnique({ where: { id: sessionId } })
      : null;

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          userId,
          title: content.substring(0, 20),
        },
      });
    }

    // 2. Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content,
      },
    });

    // 3. Define Tools
    const accountingToolSchema = z.object({
      amount: z.number().describe('The amount of money'),
      category: z
        .string()
        .describe(
          'The category of the transaction (e.g., Food, Transport, Shopping)',
        ),
      type: z
        .enum(['EXPENSE', 'INCOME'])
        .describe('Whether it is an expense or income'),
      description: z
        .string()
        .optional()
        .describe('Brief description of the transaction'),
    });
    type AccountingInput = z.infer<typeof accountingToolSchema>;

    const accountingTool = new DynamicStructuredTool({
      name: 'record_transaction',
      description:
        'Use this tool to record an expense or income. Extract amount, category, type (EXPENSE or INCOME), and description.',
      schema: accountingToolSchema,
      func: async (input: AccountingInput) => {
        const { amount, category, type, description } = input;
        const transaction = await this.prisma.transaction.create({
          data: {
            userId,
            amount,
            category,
            type,
            description,
          },
        });
        return `Successfully recorded ${type}: ${amount} for ${category}. ID: ${transaction.id}`;
      },
    });

    const journalToolSchema = z.object({
      content: z.string().describe('The main content of the journal entry'),
      moodScore: z
        .number()
        .min(1)
        .max(10)
        .describe('Emotional score from 1 to 10'),
      tags: z.array(z.string()).describe('List of relevant tags'),
    });
    type JournalInput = z.infer<typeof journalToolSchema>;

    const journalTool = new DynamicStructuredTool({
      name: 'record_journal',
      description:
        'Use this tool to record a journal entry or daily thoughts. Extract the content, mood score (1-10), and suggested tags.',
      schema: journalToolSchema,
      func: async (input: JournalInput) => {
        const { content: journalContent, moodScore, tags } = input;
        const journal = await this.prisma.journal.create({
          data: {
            userId,
            content: journalContent,
            moodScore,
            tags: tags.join(','),
          },
        });
        return `Successfully saved journal entry with mood score ${moodScore}. ID: ${journal.id}`;
      },
    });

    const tools = [accountingTool, journalTool];

    // 4. Initialize Agent
    const agent = createReactAgent({
      llm: this.model,
      tools,
      checkpointSaver: new MemorySaver(),
    });

    // 5. Run Agent
    const config: RunnableConfig = { configurable: { thread_id: session.id } };
    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content }],
      },
      config,
    );

    const assistantMessage = result.messages[result.messages.length - 1];
    const responseContent =
      typeof assistantMessage.content === 'string'
        ? assistantMessage.content
        : JSON.stringify(assistantMessage.content);

    // 6. Save assistant message
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: responseContent,
      },
    });

    return {
      sessionId: session.id,
      response: responseContent,
    };
  }

}
