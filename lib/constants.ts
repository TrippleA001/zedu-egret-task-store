export const CHANNELS = [
  { key: "telegram_announcement", label: "Telegram Announcement Channel", url: "https://t.me/+pZSfE7gYj6MwZjI0" },
  { key: "telegram_chat", label: "Telegram Group for Chatting", url: "https://t.me/+cXtWyAv-n5RjNzlk" },
  { key: "zedu_announcement", label: "Zedu Announcement Channel", url: "https://zedu.chat/hng-internship/home/channels/01a0c8b6-0feb-7cd4-a0e5-203f858aca2c" },
  { key: "zedu_egret", label: "Zedu-Egret Official Group", url: "https://zedu.chat/hng-internship/home/channels/01a0e3de-7271-7bf1-909d-7148eeb259ab" },
] as const;

export const SKILL_LEVELS = [
  { value: 1, title: "Explorer", desc: "New to web dev. Know basic HTML/CSS/JS, haven't deployed a full app alone." },
  { value: 2, title: "Learner", desc: "Can build small static pages / follow tutorials. Know Git basics, need guidance on APIs and deployment." },
  { value: 3, title: "Builder", desc: "Can build + deploy a working CRUD/ToDo app alone (frontend + fetch APIs). Comfortable with GitHub and debugging." },
  { value: 4, title: "Proficient", desc: "Ship responsive apps with auth/state/APIs. Familiar with Next.js/Supabase or equivalent, comfortable with code reviews." },
  { value: 5, title: "Advanced", desc: "Lead features end-to-end, CI/CD, testing, mentor others, optimize performance." },
] as const;
