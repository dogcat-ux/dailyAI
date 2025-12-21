# DailyAI - Technical Design & Architecture

## 1. 系统架构 (System Architecture)

采用 **Monorepo** 结构管理项目，前后端分离，但在同一个仓库中以便于类型共享和统一构建。

*   **Repo Tool**: TurboRepo (高效的构建缓存与任务调度)
*   **Package Manager**: pnpm / yarn
*   **Structure**:
    ```
    dailyAI/
    ├── apps/
    │   ├── mobile/         # React Native (Expo) - iOS Client
    │   └── service/        # NestJS - Backend API & Agent Logic
    ├── packages/
    │   ├── shared/         # Shared TypeScript interfaces/types
    │   └── config/         # Shared ESLint/TSConfig
    └── docs/               # Documentation
    ```

---

## 2. 技术栈选型 (Tech Stack)

### 2.1 客户端 (Mobile Client)
*   **Framework**: React Native (via **Expo SDK 50+**)
    *   选用 Expo 是为了快速迭代和简单的 iOS 构建流程。
*   **UI Library**: Tamagui 或 NativeBase (兼顾性能与美观)
*   **Navigation**: Expo Router (文件路由，类似 Next.js)
*   **State Management**: Zustand (轻量级) + TanStack Query (API 状态)
*   **Chat UI**: `react-native-gifted-chat` 或自研基于 FlatList 的简单实现。

### 2.2 服务端 (Backend Service)
*   **Runtime**: Node.js
*   **Framework**: **NestJS** (结构严谨，适合模块化 Agent 开发)
*   **LLM Orchestration**: **LangChain.js**
    *   使用 LangChain 的 `Tools` 和 `Agents` 模块来封装记账和日记逻辑。
*   **Database ORM**: Prisma (类型安全，易于维护)

### 2.3 基础设施 (Infrastructure)
*   **Database**: **PostgreSQL** (关系型数据库，适合结构化账单和日记)
*   **LLM Provider**: OpenAI API (gpt-4o / gpt-3.5-turbo) 或其他兼容接口。

---

## 3. 数据库设计 (Database Schema)

### 3.1 Users (用户表)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `email` | String | Unique |
| `created_at` | DateTime | |

### 3.2 ChatSessions (对话会话表)
用于记录上下文，支持多轮对话。
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> Users.id |
| `title` | String | 自动生成的会话标题 |
| `updated_at` | DateTime | |

### 3.3 ChatMessages (消息记录表)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `session_id` | UUID | FK -> ChatSessions.id |
| `role` | Enum | 'user', 'assistant', 'system' |
| `content` | Text | 消息内容 |
| `metadata` | JSONB | 存储 Agent 调用的中间状态或原始 JSON |
| `created_at` | DateTime | |

### 3.4 Journals (日记表)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> Users.id |
| `content` | Text | 原始日记内容或润色后的内容 |
| `summary` | String | 一句话摘要 |
| `mood_score` | Int | 1-10 情感打分 |
| `mood_label` | String | e.g., 'Happy', 'Anxious' |
| `tags` | String[] | 标签数组 |
| `entry_date` | DateTime | 日记归属日期 |
| `created_at` | DateTime | |

### 3.5 Transactions (账单表)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> Users.id |
| `amount` | Decimal | 金额 |
| `currency` | String | 币种 (CNY, USD) |
| `category` | String | 分类 (餐饮, 交通) |
| `type` | Enum | 'EXPENSE', 'INCOME' |
| `description` | String | 备注/描述 |
| `merchant` | String | 商户名 (可选) |
| `transaction_date`| DateTime | 消费时间 |
| `source_message_id`| UUID | 关联的那条聊天记录 ID |

---

## 4. 核心功能链路 (Core Flows)

### 4.1 消息处理流程
1.  **Request**: Client 发送 `POST /chat/message` (content: "吃面花了20").
2.  **Guard**: Auth Guard 验证用户身份。
3.  **Agent Executor**:
    *   加载当前会话的历史上下文。
    *   **Router Chain**: 判断意图 -> 命中 `AccountingTool`。
    *   **AccountingTool**:
        *   LLM 提取参数 `{ amount: 20, category: "Food", item: "面" }`。
        *   验证参数完整性。
        *   调用 `TransactionService.create()` (状态设为 PENDING 或直接 CONFIRMED)。
4.  **Response**:
    *   返回结构化数据 (用于前端渲染卡片) + 文本回复 ("记下来啦，吃面花了20元")。

### 4.2 数据同步
*   前端使用 React Query 轮询或 WebSocket (Socket.io) 接收实时更新（如果 Agent 处理较慢）。
*   对于 V1 版本，建议使用标准的 HTTP Request/Response 模式，等待 Agent 处理完毕后一次性返回。

