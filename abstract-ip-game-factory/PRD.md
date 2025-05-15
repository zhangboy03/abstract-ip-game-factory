# 抽象 IP 小游戏工坊 · MVP

## 目标
让任何人 3 分钟内，把他们喜欢的抽象 IP（图片 + 声音）嵌入到一款经典小游戏的改编版，并能立即试玩、下载、分享。

## 用户流程
1. 访问 **/index.html**  
2. 上传主角图片（png/jpg ≤ 2 MB）  
3. 可选：输入主角音频 URL（mp3/wav）  
4. 点击 **「开始对话」** → 跳转 **/chat.html**  
5. 在 Chatbox 与 AI 讨论：  
   - 选择想模仿的经典游戏  
   - 讨论一两个有趣机制（“Twist”）  
6. 当用户回复 **“OK，生成游戏”**，AI 返回单文件 HTML5 Game 代码  
7. 页面跳转 **/preview.html**：  
   - `<iframe srcdoc="...">` 实时试玩  
   - 「下载 HTML」与「复制链接」按钮  
8. （可选）将游戏上传 Supabase，生成短链

## 成功指标（MVP）
- D1 留存 ≥ 35 %
- 平均每用户 ≥ 1.2 个生成游戏
- 试玩 → 分享转化 ≥ 20 %

## 技术栈
- 纯静态 Html + Tailwind (CDN)
- JavaScript 模块化 (ESM)
- Supabase：存储游戏代码与短链
- OpenRouter → Claude 3.7 Sonnet（Streaming）

## 需求范围
| Must Have | Nice to Have |
|-----------|--------------|
| 上传图片、音频 | 短链自定义 slug |
| AI Chat 选游戏 + Twist | 图像内容审核 |
| HTML 游戏生成 & 预览 | 多人协作改编 |
| 下载 / 复制链接 | 排行榜 / 点赞 |