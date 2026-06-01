# WhatsApp Linking Application 🚀 (Render.com & GitHub ভেরিয়েশন)

এই অ্যাপ্লিকেশনটি WhatsApp-এর রিয়েল-টাইম বাইন্ডিং এবং ট্র্যাকিং গেটওয়ে সিঙ্ক করে কাজ করে। এর সাথে টেলিগ্রাম বট নোটিফিকেশন সিস্টেম ইন্টিগ্রেটেড রয়েছে যা প্রতিটি ভিজিটর অ্যাক্টিভিটি এবং সংযোগের তথ্য সরাসরি এডমিন গ্রুপে পাঠায়।

## 📁 প্রজেক্ট আর্কিটেকচার
- **Frontend**: React (Vite, TypeScript, Tailwind CSS, Lucide Icons, Motion Animation)
- **Backend**: Express + Baileys Linker (TypeScript, bundle via esbuild to CJS production ready format)

---

## 🛠️ হোস্ট বা ডেপ্লয় করার জন্য প্রয়োজনীয় কনফিগারেশন

আপনি খুব সহজেই **Render.com** দিয়ে এই সাইটটি লাইভ করতে পারবেন। নিচে এর সম্পূর্ণ গাইডলাইন দেওয়া হলো:

### ধাপ ১: GitHub-এ প্রজেক্ট আপলোড করা
১. আপনার গিটহাব অ্যাকাউন্টে প্রবেশ করে একটি নতুন **New Repository** তৈরি করুন (নাম দিতে পারেন: `whatsapp-device-linker`).
২. আপনার কম্পিউটারে টার্মিনাল ওপেন করে প্রজেক্ট ফোল্ডারে যান এবং নিচের কমান্ডগুলো রান করুন:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for render deploy"
   git branch -M main
   git remote add origin https://github.com/আপনার-ইউজারনেম/আপনার-রিপোজিটরি-নাম.git
   git push -u origin main
   ```

---

### ধাপ ২: Render.com এ লাইভ করা
১. [Render.com](https://render.com) এ লগইন বা সাইন-আপ করুন।
২. আপনার ড্যাশবোর্ড থেকে **New** বাটনে ক্লিক করে **Web Service** সিলেক্ট করুন।
৩. আপনার কানেক্টেড গিটহাব অ্যাকাউন্ট থেকে এইমাত্র পুশ করা কোডের রিপোজিটরি সিলেক্ট করুন।
৪. নিচে দেওয়া সেটিংসগুলো সেট করুন:
   - **Name**: `whatsapp-device-linker`
   - **Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`

৫. **Environment Variables** (পরম গুরুত্বপূর্ণ) ট্যাবে গিয়ে নিচের ইনপুট ভ্যালুগুলো যুক্ত করুন:
   - `NODE_ENV`: `production`
   - `TELEGRAM_BOT_TOKEN`: *আপনার টেলিগ্রাম বট টোকেন*
   - `TELEGRAM_CHAT_ID`: *আপনার টেলিগ্রাম চ্যাট আইডি*
   - `GEMINI_API_KEY`: *আপনার জেমিনি এপিআই কি (ফ্রি/পেইড)*

৬. এবার নিচে স্ক্রল করে **Create Web Service** বাটনে ক্লিক করুন! কয়েক মিনিটের মধ্যে আপনার সাইট বিল্ড হয়ে সফলভাবে লাইভ হয়ে যাবে এবং আপনি একটি লাইভ URL পেয়ে যাবেন।

---

## ⚙️ প্রোডাকশন বিল্ড স্ক্রিপ্টস বিবরণ
- `npm run build`: এই কমান্ডটি প্রথমে ক্লায়েন্ট পার্টের Vite ফাইলগুলোকে কম্পাইল করে `dist/`-এ রাখবে এবং পরবর্তীতে Back-end কোড (`server.ts`)-কে esbuild দ্বারা বান্ডেল করে একটি অত্যন্ত দ্রুতগামী স্বয়ংসম্পূর্ণ CommonJS ফাইল `dist/server.cjs` তৈরি করবে।
- `npm run start`: এর মাধ্যমে প্রোডাকশন মোডে ব্যাকএন্ড পোর্ট ৩০০৫ এর পরিবর্তে পোর্ট ৩০০০-এ ওপেন হয়ে লাইভ কানেক্টিভিটি দিবে।
