# FabricLink Backend

Node.js · Express · TypeScript · MongoDB · Twilio · Gmail

---

## Quick start (local)

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your values:

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | Install MongoDB locally **or** get a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas) |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `TWILIO_ACCOUNT_SID` | [console.twilio.com](https://console.twilio.com) → Account Info |
| `TWILIO_AUTH_TOKEN` | Same page |
| `TWILIO_PHONE_NUMBER` | Twilio → Phone Numbers → Manage |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

> **Development tip:** Even without Twilio/Gmail configured, the OTP is always printed in the terminal (`🔑 OTP for ...: 123456`), so you can test the full flow immediately.

### 3. Start the dev server
```bash
npm run dev
```
Server runs at **http://localhost:4000**

### 4. Start the frontend (separate terminal)
```bash
cd ..          # back to project root
npm run dev
```
Frontend runs at **http://localhost:5173**

---

## API reference

### Auth
| Method | Endpoint | Body | Auth |
|---|---|---|---|
| POST | `/api/auth/send-otp` | `{ identity, mode }` | — |
| POST | `/api/auth/verify-otp` | `{ identity, otp, mode }` | — |
| GET | `/api/auth/me` | — | ✅ |
| POST | `/api/auth/logout` | — | ✅ |

### Orders
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/orders` | List all user orders |
| POST | `/api/orders` | Create new order |
| GET | `/api/orders/:id` | Single order |
| PATCH | `/api/orders/:id` | Update order |
| DELETE | `/api/orders/:id` | Cancel (Draft/Quote pending only) |
| POST | `/api/orders/:id/reorder` | Duplicate as new draft |
| GET | `/api/orders/:id/quote` | Get quote for order |

### Account
| Method | Endpoint |
|---|---|
| GET/PUT | `/api/account/profile` |
| GET/POST | `/api/account/addresses` |
| PUT/DELETE | `/api/account/addresses/:id` |
| GET/POST | `/api/account/payment` |
| DELETE | `/api/account/payment/:id` |

### Quotes
| Method | Endpoint |
|---|---|
| GET | `/api/quotes` |
| GET | `/api/quotes/:id` |
| POST | `/api/quotes/:id/approve` |
| POST | `/api/quotes/:id/reject` |

### Track
| Method | Endpoint |
|---|---|
| GET | `/api/track` — active orders |
| GET | `/api/track/:orderRef` — single order tracking |

---

## Deploy to Railway (free)

1. Push the `backend/` folder to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a MongoDB plugin inside Railway, or use MongoDB Atlas
4. Set all `.env` variables in Railway's environment dashboard
5. Railway auto-detects `npm start` and builds with `npm run build`

---

## Project structure
```
backend/
├── src/
│   ├── index.ts           # Express app
│   ├── config/db.ts       # MongoDB connection
│   ├── models/            # Mongoose schemas
│   │   ├── User.ts
│   │   ├── OTP.ts
│   │   ├── Order.ts
│   │   └── Quote.ts
│   ├── routes/            # Route handlers
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── account.ts
│   │   ├── quotes.ts
│   │   └── track.ts
│   ├── middleware/
│   │   ├── auth.ts        # JWT verify
│   │   └── error.ts       # Global error handler
│   └── services/
│       ├── otpService.ts  # Generate + verify OTP
│       ├── smsService.ts  # Twilio
│       └── emailService.ts# Nodemailer + Gmail
├── .env.example
├── package.json
└── tsconfig.json
```
