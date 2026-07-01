# 面试助手 Agent

🎯 基于 AI 的智能面试训练平台，支持**简历面试**与**角色练习**两种模式，助你轻松拿下心仪 Offer。

- **前端**：React + Vite + React Router（流式 SSE 渲染 + 语音输入）
- **后端**：FastAPI + DeepSeek（OpenAI 兼容接口）
- **PDF 解析**：pdfplumber（纯本地）

## 目录结构

```
面试Agent/
├── backend/
│   ├── main.py              # 路由 + SSE 流式接口（含练习模式 API）
│   ├── prompts.py           # 面试官 / 评分官提示词（按技术栈/实习/项目三板块出题）
│   ├── practice_prompts.py  # 练习模式提示词（出题/辅导/标准答案）
│   ├── llm.py               # DeepSeek 流式封装
│   ├── pdf_parser.py        # pdfplumber 解析
│   ├── session.py           # 面试模式会话管理
│   ├── practice_store.py    # 练习模式会话管理
│   ├── mastered_store.py    # 已掌握题目持久化（JSON + Markdown）
│   ├── data/                # 数据文件（mastered_questions.json / mastered_answers.md）
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx                  # React Router 路由容器
        ├── api.js                   # API 封装（含练习模式）
        ├── styles.css
        ├── pages/
        │   ├── HomePage.jsx         # 主页（模式选择）
        │   ├── InterviewPage.jsx    # 简历面试页
        │   └── PracticePage.jsx     # 角色练习页
        └── components/
            ├── ResumePanel.jsx      # 简历上传预览
            ├── AnswerInput.jsx      # 输入框 + 语音按钮
            ├── VoiceButton.jsx      # Web Speech API 语音输入
            ├── ChatPanel.jsx        # 面试对话区
            ├── ControlBar.jsx       # 面试控制栏
            ├── QuestionCard.jsx     # 练习题卡
            ├── ReplayModal.jsx      # 回放弹窗
            └── LoadingDots.jsx      # 加载动画
```

## 功能概览

### 🏠 主页
进入后选择「简历面试模式」或「角色练习模式」。

### 📄 简历面试模式
1. 上传 PDF 简历，左侧预览。
2. 点击「开始面试」，AI 面试官基于简历三大板块（技术栈 / 实习经历 / 主要项目）均衡提问。
3. 文本或语音作答，点击「发送」，AI 流式返回评分分析（分数 / 正确❌逐条 / 参考答案 / 改进建议）。
4. 点击「继续面试」获取下一题，系统保证不与已问问题重复。

### 💡 角色练习模式
1. 输入目标岗位角色（如"后端工程师"），点击「开始面试」。
2. AI 生成 3 道高频面试题，以题卡展示。
3. 点击题卡进入讨论，向 AI 辅导官提问，流式获取专业解答。
4. 讨论后点击 ✓ 标记已掌握——题目加入防重复黑名单，标准答案自动汇总到回放文档。
5. 点击「📋 回放」查看所有已掌握题目的标准答案汇总。

### 🎤 语音输入
输入框旁的麦克风按钮，使用浏览器 Web Speech API 将语音转为文字。点击开始录音（持续监听不会因停顿中断），再次点击停止并填入文字。

## 启动方式

### 1. 配置后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY（https://platform.deepseek.com）
```

启动后端：

```bash
.venv\Scripts\activate
uvicorn main:app --port 8000
# 或：python main.py
```

### 2. 启动前端

```bash
cd frontend
npm install
npm install react-router-dom
npm run dev
```

浏览器打开 http://localhost:5173。

## API 端点

### 面试模式
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传 PDF 简历，创建面试会话 |
| POST | `/api/ask` | 流式生成下一道面试题（SSE） |
| POST | `/api/answer` | 流式返回评分分析（SSE） |

### 练习模式
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/practice/start` | 创建练习会话，返回 3 道面试题 |
| POST | `/api/practice/chat` | 流式追问某题，AI 辅导回复（SSE） |
| POST | `/api/practice/master` | 标记已掌握，生成标准答案并持久化 |
| GET | `/api/practice/review` | 获取累计标准答案 Markdown 全文 |

## 设计要点

- **流式输出**：后端 FastAPI `StreamingResponse` + SSE，前端 `fetch` + `ReadableStream` 逐字渲染。
- **会话在后端**：简历、历史、已问问题按 `session_id` 存内存，防重复逻辑全在后端。
- **提示词分板块**：面试官按技术栈 / 实习经历 / 主要项目三板块均衡出题，直击简历核心。
- **练习持久化**：已掌握题目写入 JSON 防重复，标准答案写入 Markdown 供回放复习。
- **乐观更新**：标记掌握时前端即时反馈，后台异步生成答案，避免重复点击。
- **语音持续监听**：`SpeechRecognition` 设为 `continuous: true`，不会因停顿中断，用户手动停止。
