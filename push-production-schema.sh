#!/bin/bash
# Script to push Prisma schema to production database

echo "🔄 Pushing Prisma schema to production database..."
echo ""
echo "Make sure your DATABASE_URL is set to production Supabase"
echo ""

export DATABASE_URL="postgresql://postgres.yhxcqxivimjulxpchmxu:Comilla%401972@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

npx prisma db push --accept-data-loss

echo ""
echo "✅ Schema push complete!"
echo ""
echo "Next steps:"
echo "1. Check Vercel deployment logs"
echo "2. Test the application"
