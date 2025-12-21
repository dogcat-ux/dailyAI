import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private model: ChatOpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });
  }

  async processMessage(dto: SendMessageDto) {
    const { content, userId, sessionId } = dto;

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
    const accountingTool = new DynamicStructuredTool({
      name: 'record_transaction',
      description: 'Use this tool to record an expense or income. Extract amount, category, type (EXPENSE or INCOME), and description.',
      schema: z.object({
        amount: z.number().describe('The amount of money'),
        category: z.string().describe('The category of the transaction (e.g., Food, Transport, Shopping)'),
        type: z.enum(['EXPENSE', 'INCOME']).describe('Whether it is an expense or income'),
        description: z.string().optional().describe('Brief description of the transaction'),
      }),
      func: async ({ amount, category, type, description }) => {
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

    const journalTool = new DynamicStructuredTool({
      name: 'record_journal',
      description: 'Use this tool to record a journal entry or daily thoughts. Extract the content, mood score (1-10), and suggested tags.',
      schema: z.object({
        content: z.string().describe('The main content of the journal entry'),
        moodScore: z.number().min(1).max(10).describe('Emotional score from 1 to 10'),
        tags: z.array(z.string()).describe('List of relevant tags'),
      }),
      func: async ({ content: journalContent, moodScore, tags }) => {
        const journal = await this.prisma.journal.create({
          data: {
            userId,
            content: journalContent,
            moodScore,
            tags,
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
    const config = { configurable: { thread_id: session.id } };
    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content }],
      },
      config,
    );

    const assistantMessage = result.messages[result.messages.length - 1];
    const responseContent = typeof assistantMessage.content === 'string' 
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
