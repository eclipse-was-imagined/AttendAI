AttendAI is a multi-college QR, GPS, and face-verification attendance app built with Next.js and Supabase.

## Multi-college setup

1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
2. Run [`supabase/migrations/001_multi_tenant.sql`](supabase/migrations/001_multi_tenant.sql) once in the Supabase SQL editor.
3. Run [`supabase/migrations/002_organization_roles.sql`](supabase/migrations/002_organization_roles.sql) after it completes.
4. Run [`supabase/migrations/003_class_attendance.sql`](supabase/migrations/003_class_attendance.sql) to enforce class membership for attendance.
5. Run [`supabase/migrations/004_attendance_timing.sql`](supabase/migrations/004_attendance_timing.sql) for session time limits and late status.
6. Run [`supabase/migrations/005_attendance_corrections.sql`](supabase/migrations/005_attendance_corrections.sql) for teacher corrections and audit history.
7. Open `/admin`, create the college admin workspace, and import CSV files.

Student CSV headers: `register_no,name,email`

Faculty CSV headers: `faculty_id,name,email`

The migration adds college ownership and Row Level Security. Existing rows with no `college_id` need to be assigned to a college before they become visible under the protected policies. Do not put passwords or face images in CSV files; students and faculty still use Supabase Auth accounts, while face embeddings are registered through the existing admin face-registration screen.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
