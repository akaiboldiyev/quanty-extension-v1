# Quanty 🎯 – AI Coach That Locks Your PC Until You Win

> I procrastinated on C++ for 2 years. So I built an AI that bullies me into coding.

What it does: Gives you 1 task/day for your goal. Blocks YouTube Shorts/TikTok/Reddit until you prove you learned it with a 1-min quiz. No copy-paste.

Demo: > Demo: Video/GIF coming soon. For now: it darkens screen + neon #00C47A border + side panel slides in when you hit Start Focus.

### How It Works
1. Set Goal → "Learn C++"
2. Get 1 Task/Day → "Day 1: What is a pointer? Write 3 examples."
3. Focus Mode ON → Blocks distractions. 3 levels: Easy/Warn, Medium/Block, Hard/Jail.
4. Pass Quiz to Unlock → 1 question, 60 sec, no copy-paste. Fail = +15min lock.

### Install
1. [Download ZIP](ссылка на Releases)
2. Chrome → chrome://extensions → Dev mode ON
3. Load unpacked → select folder → Pin icon

### Tech Stack
- Frontend: Chrome Extension Manifest V3, Vanilla JS, Side Panel API
- Backend: Node.js + Express, hosted on [Render/Railway]
- AI: Google Gemini 2.5 Flash API for generating tasks & quizzes

### Privacy & Cost
How it works: When you set a goal, only that text is sent to my backend → Gemini API → returns a task. That's it.

What I collect: Nothing. No accounts, no emails, no browsing history, no logs. 
Requests are stateless and not stored.

Who pays for AI: I do. Testing credits cover ~10k tasks. If Quanty blows up, I'll add my own API key option later.

Open Source: Don't trust me? Check /backend folder in the repo. No shady shit.

### Privacy
Quanty uses a backend to generate AI tasks and quiz questions. 

What we send: Only your goal text like "Learn C++". 
What we DON'T send: No personal data, no browsing history, no emails.
What we store: Nothing. Requests are stateless.

Why backend? To make the AI mentor actually smart instead of dumb templates.

Don't trust me? The extension is open source. Check the code.
### Roadmap
- [x] MVP with 3 blocking modes + quiz
- [ ] AI Mentor chat 24/7
- [ ] Mobile app

Built in 19 days. Roast me, I need feedback.