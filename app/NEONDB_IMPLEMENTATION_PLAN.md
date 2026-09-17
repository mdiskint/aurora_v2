# NeonDB Integration Implementation Plan

## Overview
Upgrade from browser-only storage (IndexedDB) to cloud-based storage with NeonDB (serverless Postgres), user authentication, and multi-device sync.

## Architecture Changes

### Current State
- ✅ Browser-only storage (IndexedDB)
- ✅ No user accounts
- ✅ Single-device only
- ✅ Videos stored as blobs in browser

### Target State
- 🎯 Cloud database (NeonDB Postgres)
- 🎯 User authentication (Google OAuth + Microsoft OAuth)
- 🎯 Multi-device sync
- 🎯 Cloud storage for videos (Vercel Blob Storage or AWS S3)
- 🎯 Secure session management (JWT)

---

## Implementation Steps

### Phase 1: User Authentication Setup

#### 1.1 Install Dependencies
```bash
npm install next-auth@latest @auth/core @auth/prisma-adapter
npm install @neondatabase/serverless
npm install @prisma/client prisma
npm install jsonwebtoken bcrypt
```

#### 1.2 Set Up Prisma with NeonDB
1. Initialize Prisma:
   ```bash
   npx prisma init
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }

   model User {
     id            String    @id @default(cuid())
     name          String?
     email         String    @unique
     emailVerified DateTime?
     image         String?
     accounts      Account[]
     sessions      Session[]
     universes     Universe[]
     createdAt     DateTime  @default(now())
     updatedAt     DateTime  @updatedAt
   }

   model Account {
     id                String  @id @default(cuid())
     userId            String
     type              String
     provider          String
     providerAccountId String
     refresh_token     String?
     access_token      String?
     expires_at        Int?
     token_type        String?
     scope             String?
     id_token          String?
     session_state     String?
     user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@unique([provider, providerAccountId])
   }

   model Session {
     id           String   @id @default(cuid())
     sessionToken String   @unique
     userId       String
     expires      DateTime
     user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   }

   model Universe {
     id          String   @id
     userId      String
     data        Json
     videoUrl    String?  // Cloud storage URL for video
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@index([userId])
   }
   ```

3. Create NeonDB database:
   - Go to [Neon Console](https://console.neon.tech)
   - Create new project
   - Copy connection string

4. Add to `.env.local`:
   ```
   DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

5. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

#### 1.3 Set Up NextAuth.js
1. Create `app/api/auth/[...nextauth]/route.ts`:
   ```typescript
   import NextAuth from "next-auth"
   import GoogleProvider from "next-auth/providers/google"
   import AzureADProvider from "next-auth/providers/azure-ad"
   import { PrismaAdapter } from "@auth/prisma-adapter"
   import { PrismaClient } from "@prisma/client"

   const prisma = new PrismaClient()

   export const authOptions = {
     adapter: PrismaAdapter(prisma),
     providers: [
       GoogleProvider({
         clientId: process.env.GOOGLE_CLIENT_ID!,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
       }),
       AzureADProvider({
         clientId: process.env.AZURE_AD_CLIENT_ID!,
         clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
         tenantId: process.env.AZURE_AD_TENANT_ID!,
       }),
     ],
     session: {
       strategy: "jwt",
     },
     pages: {
       signIn: '/auth/signin',
     },
   }

   const handler = NextAuth(authOptions)
   export { handler as GET, handler as POST }
   ```

2. Add OAuth credentials to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   AZURE_AD_CLIENT_ID=your_azure_client_id
   AZURE_AD_CLIENT_SECRET=your_azure_client_secret
   AZURE_AD_TENANT_ID=your_azure_tenant_id
   NEXTAUTH_SECRET=your_random_secret_key
   NEXTAUTH_URL=https://your-app.vercel.app
   ```

#### 1.4 Create Sign-In Page
Create `app/auth/signin/page.tsx` with Google and Microsoft sign-in buttons.

---

### Phase 2: Cloud Storage for Videos

#### 2.1 Set Up Vercel Blob Storage
1. Install:
   ```bash
   npm install @vercel/blob
   ```

2. Create upload API route `app/api/upload-video/route.ts`:
   ```typescript
   import { put } from '@vercel/blob';
   import { NextResponse } from 'next/server';

   export async function POST(request: Request) {
     const formData = await request.formData();
     const file = formData.get('file') as File;
     
     const blob = await put(file.name, file, {
       access: 'public',
     });

     return NextResponse.json({ url: blob.url });
   }
   ```

3. Add to `.env.local`:
   ```
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

---

### Phase 3: Database Migration

#### 3.1 Create Universe Save API
Create `app/api/universes/route.ts`:
```typescript
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id, data, videoUrl } = await request.json()

  const universe = await prisma.universe.upsert({
    where: { id },
    update: { data, videoUrl },
    create: {
      id,
      data,
      videoUrl,
      userId: session.user.id,
    },
  })

  return Response.json(universe)
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 })
  }

  const universes = await prisma.universe.findMany({
    where: { userId: session.user.id },
  })

  return Response.json(universes)
}
```

#### 3.2 Update Store to Use Cloud Storage
Modify `lib/store.ts` to call API routes instead of IndexedDB.

---

### Phase 4: Multi-Device Sync

#### 4.1 Add Real-Time Sync (Optional)
Use Pusher or Supabase Realtime for live updates across devices.

---

## Environment Variables Needed

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=random_secret_key
NEXTAUTH_URL=https://your-app.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Microsoft OAuth
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=...

# Existing
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

---

## Before We Proceed, You'll Need:

### ✅ Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

### ✅ Microsoft OAuth Credentials
1. Go to [Azure Portal](https://portal.azure.com)
2. Register an application
3. Add redirect URI: `https://your-app.vercel.app/api/auth/callback/azure-ad`

### ✅ NeonDB Account
1. Sign up at [Neon](https://neon.tech)
2. Create a new project
3. Get connection string

---

## Migration Strategy

1. **Keep IndexedDB as fallback** - Don't break existing users
2. **Add cloud sync option** - "Sign in to sync across devices"
3. **Gradual migration** - Users can choose to migrate their data

---

Please review this plan and let me know if you'd like to proceed with implementation!
