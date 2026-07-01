# 面试助手 Agent

基于简历的 AI 模拟面试助手。上传 PDF 简历后，AI 面试官流式提问，用户作答后流式返回评分分析（打分、错误标注、参考答案），循环往复。

- **前端**：React + Vite（流式 SSE 渲染）
- **后端**：FastAPI + DeepSeek（OpenAI 兼容接口）
- **PDF 解析**：pdfplumber（纯本地）

## 目录结构

```
面试Agent/
├── backend/        # FastAPI 后端
│   ├── main.py        # 路由 + SSE 流式接口
│   ├── prompts.py     # 面试官 / 评分官提示词
│   ├── llm.py         # DeepSeek 流式封装
│   ├── pdf_parser.py  # pdfplumber 解析
│   ├── session.py     # 会话状态管理
│   ├── requirements.txt
│   └── .env.example
└── frontend/       # React 前端
    └── src/
        ├── App.jsx
        ├── api.js               # SSE 流式 fetch 封装
        ├── styles.css
        └── components/          # ResumePanel / AnswerInput / ChatPanel / ControlBar / LoadingDots
```

## 启动方式

### 1. 配置后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入你的 DEEPSEEK_API_KEY（在 https://platform.deepseek.com 申请）
```

启动后端：

```bash
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
# 或：python main.py
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173 （Vite 已配置代理，`/api` 自动转发到后端 8000）。

## 使用流程

1. 页面左上点击「上传简历（PDF）」上传简历，左侧出现 PDF 预览。
2. 点击右侧「开始面试」，AI 面试官基于简历流式提出第一个问题。
3. 在左下输入框作答，点击「发送」，右上流式出现评分分析（分数 / 对错标注 / 参考答案 / 改进建议）。
4. 点击「继续面试」获取下一题（系统保证不与已问问题重复），循环进行。

## 设计要点

- **流式输出**：后端用 FastAPI `StreamingResponse` + SSE，DeepSeek `stream=True` 逐 token 推送；前端用 `fetch` + `ReadableStream` 逐字渲染。
- **会话状态在后端**：简历文本、历史对话、已问问题列表按 `session_id` 存内存，前端只持 id，提示词拼接与防重复都在后端完成。
- **防重复**：每轮把「已提问列表」注入面试官提示词并强约束「不得重复或变体重问」，同时后端持久化已问问题全量带入上下文。
- **三类加载动画**：简历解析中、面试官提问中、评分分析中分别显示。
- **评分结构化**：评分官固定输出「评分 / 回答分析（✅❌逐条）/ 参考答案 / 改进建议」Markdown。
