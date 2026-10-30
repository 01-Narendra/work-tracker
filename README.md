# Employee Management Portal (Daily Work Tracker)

## 📌 About the Product

A full-stack employee work tracking and attendance management portal built with **React, Vite, and Tailwind CSS** on the frontend, **Node.js and Express** on the backend, and **MongoDB Atlas (Mongoose)** for cloud storage.

### Key Capabilities
- **Three-Tier Role System**:
  - **Employee**: Confirm check-in/check-out, submit morning & evening updates, set weekly work targets, confirm Friday target completion (with reason if incomplete), view personal history, and export personal Excel reports.
  - **Admin**: View and filter updates for **assigned employees only** (configured by Super Admin), refresh live updates, and export team Excel reports. Admins can also submit their own daily work updates.
  - **Super Admin**: Complete system oversight. Manage users (create users, assign employees to multiple admins, reset passwords, toggle active status) and view/export all employee updates without restrictions.
- **Work Day & Window Timing (Asia/Kolkata)**:
  - Daily Work Window runs from **9:00 AM to 11:55 PM**.
  - **Morning Window (9:00 AM – 1:00 PM)**: Check-in dropdown (all 15-min slots) and morning update.
  - **Evening Window (1:00 PM – 11:55 PM)**: Check-out dropdown (all slots up to 11:55 PM) and evening update.
  - Automatic status calculation: `Present`, `Partial`, or `Absent` (automated daily 9:00 AM cron job).
- **Weekly Target & Plan**:
  - Monday work planning and Friday review.
  - If a status other than "Completed" is chosen, entering a reason is required and saved to the database and export.
- **Top-Right Toast Notifications**: Non-intrusive, auto-dismissing toast alerts for all actions with zero card shifting.
- **On-Demand Streaming Excel Export**: Streams filtered updates directly into an `.xlsx` file formatted with bold headers, auto-widths, all columns matching the UI, and hyphens (`-`) for empty cells.

---

## 🚀 Setup & How to Run

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB Atlas](https://www.mongodb.com/atlas) connection string (or local MongoDB URI)

---

### 1. Backend Setup (`server`)

1. **Navigate to the server directory**:
   ```bash
   cd work-tracker/server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create `.env` from `.env.example`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/work-tracker?retryWrites=true&w=majority
   JWT_SECRET=your-random-secure-jwt-secret
   TZ_NAME=Asia/Kolkata
   WEEKLY_OFF=0,6
   ```

4. **Seed Initial Super Admin**:
   Create the initial Super Admin account (`username: superadmin`, default password: `sci12345`):
   ```bash
   npm run seed:superadmin
   ```

5. **Start the Server**:
   ```bash
   # Development (watch mode)
   npm run dev

   # Production
   npm start
   ```
   The backend API runs at `http://localhost:3000`.

---

### 2. Frontend Setup (`client`)

1. **Navigate to the client directory**:
   ```bash
   cd work-tracker/client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration (Optional for separate deployment)**:
   In local development, Vite proxies `/api` requests to `http://localhost:3000`.
   For independent deployment (e.g. Vercel, Netlify), create `.env` in `client`:
   ```env
   VITE_API_BASE_URL=https://your-backend-api-domain.com/api
   ```

4. **Start the Frontend**:
   ```bash
   # Development server
   npm run dev
   ```
   The app opens at `http://localhost:5173`.

5. **Build for Production**:
   ```bash
   npm run build
   ```
   Generates optimized static production assets in `work-tracker/client/dist/`.

---

### 3. Default Credentials
- **Super Admin**: `superadmin` / `sci12345`
- *Note: On first login with a default password, users are prompted to set a new password (minimum 8 characters).*
