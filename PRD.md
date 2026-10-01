# Product Requirement Document (PRD)

## Project Title: Zedu Egret Store (Task Verification & Onboarding Platform)
**Version:** 1.0.0  
**Author:** Senior Technical Product Manager  
**Status:** Approved for Implementation  
**Target Architecture:** Next.js (App Router), Supabase (PostgreSQL + Auth), GCP / Mailgun, GitHub Actions

---

## 1. Executive Summary & Goals

### 1.1 Overview
The **Zedu Egret Store** is a specialized task verification and contributor onboarding portal designed to handle administrative workflows for 80+ interns. To streamline onboarding and submission tracking, the platform leverages an **e-commerce metaphor** (Catalog → Cart → Checkout → Order Receipt) where administrative task milestones act as zero-cost products.

### 1.2 Core Objectives
* **Eliminate Manual Verification:** Automate task link validation (HTTP 200 checks, GitHub public repo checks) before storing entries in the database.
* **Prevent Administrative Bottlenecks:** Auto-compile a static HTML contributors directory page whenever an intern completes a task.
* **Identity Verification:** Authenticate interns strictly via Google OAuth mapped to pre-populated master emails and unique Zedu IDs.
* **Extensibility:** Support modular addition of future program milestones (Task 2, Task 3, etc.) without architectural changes.

---

## 2. System Architecture & Data Flow

```
+-----------------------------------------------------------------------+
|                             USER BROWSER                              |
+-----------------------------------┬-----------------------------------+
                                    |
                       1. Google OAuth / Auth Flow
                                    |
                                    v
+-----------------------------------------------------------------------+
|                    NEXT.JS FRONTEND & API ROUTES                      |
|                                                                       |
|  - Onboarding Wizard (First-time users)                               |
|  - Storefront Catalog (Zero-cost milestone products)                  |
|  - Cart & Checkout Modal                                              |
|  - Pre-flight Validation API (URL & Repo Reachability Checks)         |
+----------------─┬───────────────────────────────────┬-----------------+
                  |                                   |
    2. Read/Write | Data               3. Webhook     | 4. Dispatch Email
                  v                       Trigger     v
+-----------------------------------+   +-------------------------------+
|     SUPABASE POSTGRESQL + AUTH    |   |    MAILGUN / GCP INFRA        |
|                                   |   |                               |
|  - users      - products          |   |  - Sends order receipts &     |
|  - orders     - submissions       |   |    task fulfillment updates   |
+-----------------------------------+   +-------------------------------+
                                                      ^
                                                      |
                                        5. Commit     |
+-----------------------------------------------------+-----------------+
|                      GITHUB ACTIONS AUTOMATION WORKFLOW               |
|                                                                       |
|  - Triggered via Webhook on verified order creation                   |
|  - Queries Supabase for all verified contributors                     |
|  - Generates `public/contributors/zedu-egret/index.html`              |
|  - Auto-commits static file back to staging repository                |
+-----------------------------------------------------------------------+
```

---

## 3. Detailed Data Model & Database Schema

### 3.1 Table: `users`
Tracks intern profiles, identity mapping, and social setup checkpoints.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  zedu_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  github_url VARCHAR(255) NOT NULL,
  telegram_handle VARCHAR(100) NOT NULL,
  sub_team VARCHAR(100) NOT NULL,
  skill_rating INT CHECK (skill_rating BETWEEN 1 AND 5),
  channels_verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.2 Table: `products`
Defines the store catalog representing program milestones.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  stage_number INT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.3 Table: `orders`
Acts as transaction headers for task checkout requests.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'fulfilled' CHECK (status IN ('pending_verification', 'fulfilled', 'rejected')),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.4 Table: `submissions`
Stores granular task submission URLs submitted during checkout.

```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  todo_app_url TEXT NOT NULL,
  task_repo_url TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_stage UNIQUE (user_id, stage_number)
);
```

---

## 4. Feature Specifications & Requirements

### 4.1 Onboarding Wizard (First-Time Login)
* **Trigger:** User completes Google OAuth login and no matching row exists in `public.users`.
* **Step 1: Identity Confirmation**
  * Email selector pre-populated from logged-in session.
  * Zedu ID text input (required).
* **Step 2: Profile & Community Checkpoints**
  * Full Name and GitHub profile URL inputs.
  * Telegram handle input.
  * Explicit checkboxes for mandatory channels (Telegram Announcement, Group Chat, Zedu Main, Zedu Team).
* **Step 3: Sub-Team & Skills**
  * Sub-team dropdown selection.
  * Technical skill rating (1–5 star selection).

### 4.2 Storefront & Catalog
* Renders products from `public.products`.
* Stage 1 Verification Product: Active, priced at $0.00.
* Stage 2+ Products: Visually disabled/locked until prerequisites are fulfilled.

### 4.3 Checkout & Pre-Flight Validation API
* **Endpoint:** `POST /api/checkout`
* **Inputs:** `userId`, `productId`, `stageNumber`, `todoAppUrl`, `taskRepoUrl`.
* **Validation Rules:**
  1. **Deployed App Reachability:** Perform an HTTP request to `todoAppUrl`. Reject if response code is not 200.
  2. **GitHub Repository Check:** Call GitHub REST API (`https://api.github.com/repos/{owner}/{repo}`) using a server-side PAT. Reject if 404, private, or repository size is `0`.
  3. **Duplicate Prevention:** Ensure user hasn't already submitted for this `stage_number`.
* **Order Processing:**
  1. Insert row into `submissions`.
  2. Create order record in `orders` with generated receipt ID (`ZE-2026-XXXX`).
  3. Dispatch confirmation email via Mailgun.
  4. Trigger GitHub Action webhook to generate static contributor page.

---

## 5. Security & Compliance
* **Row Level Security (RLS):** Enabled on all Supabase tables. Users can only read/update their own profile, submissions, and order headers.
* **Input Sanitization:** Sanitize string inputs (`full_name`, `github_url`, `telegram_handle`) before generating static HTML to eliminate Reflected/Stored Cross-Site Scripting (XSS).
* **Environment Secrets:** GitHub PATs, Supabase Service Role keys, and Mailgun API keys must remain strictly in server-side environment variables.

---

## 6. Non-Functional Requirements
* **Performance:** Pre-flight link validation API must respond within < 2.5 seconds.
* **Concurrency:** Static page compilation runs asynchronously via GitHub Actions to prevent Git merge lock collisions (`409 Conflicts`).
* **Availability:** Hosted on Vercel or GCP Cloud Run with zero-downtime deployment.