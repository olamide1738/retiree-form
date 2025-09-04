# Vercel + Supabase Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (free)
- Supabase account (free)

## Step 1: Set up Supabase Database

1. Go to [Supabase](https://supabase.com) and create a free account
2. Create a new project:
   - Click "New Project"
   - Name it `retiree-form` (or any name you prefer)
   - Create a strong database password (save this!)
   - Choose your region
   - Select the "Free" plan
   - Click "Create new project"
   - Wait 2-3 minutes for setup
   - Goodluck

3. Get your connection details:
   - Go to Settings → Database
   - Scroll to "Connection string"
   - Copy the "URI" connection string
   - It looks like: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

## Step 2: Prepare Your Code

1. **Install PostgreSQL dependency:**
   ```bash
   cd server
   npm install pg
   ```

2. **Replace the server file:**
   - Rename `server/server.js` to `server/server-sqlite.js` (backup)
   - Rename `server/server-postgres.js` to `server/server.js`

3. **Update frontend API URLs:**
   - In your React components, change `http://localhost:4000` to your Vercel domain
   - Or use environment variables for the API URL

## Step 3: Deploy to Vercel

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure the project:
     - **Framework Preset:** Other
     - **Root Directory:** Leave as default
     - **Build Command:** `npm run build` (for frontend)
     - **Output Directory:** `dist`

3. **Set Environment Variables in Vercel:**
   - Go to your project settings
   - Click "Environment Variables"
   - Add this variable:
     ```
     DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
     NODE_ENV=production
     ```

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete

## Step 4: Configure Vercel for Full-Stack App

1. **Update vercel.json** (already created):
   - The file is configured to handle both frontend and API routes
   - API routes go to `/api/*` and are handled by the Express server
   - Static files are served from the React build

2. **Update package.json scripts:**
   ```json
   {
     "scripts": {
       "build": "vite build",
       "start": "node server/server.js"
     }
   }
   ```

## Step 5: Test Your Deployment

1. **Check API endpoints:**
   - Visit `https://your-app.vercel.app/api/health`
   - Should return `{"ok": true}`

2. **Test form submission:**
   - Fill out the form on your deployed site
   - Check if data appears in Supabase dashboard (Table Editor)

3. **Test file uploads:**
   - Upload files through the form
   - Verify files are accessible via download links

## Step 6: File Storage Considerations

**Important:** Vercel's file system is read-only in production. For file uploads, you have a few options:

### Option 1: Vercel Blob (Recommended)
```bash
npm install @vercel/blob
```

### Option 2: External Storage
- AWS S3
- Cloudinary
- Firebase Storage

### Option 3: Database Storage (for small files)
- Store files as base64 in the database

## Troubleshooting

### Common Issues:

1. **Database Connection Failed:**
   - Check environment variables in Vercel
   - Verify Supabase connection string
   - Ensure SSL is enabled for production

2. **File Upload Issues:**
   - Vercel has read-only file system
   - Consider using Vercel Blob or external storage

3. **CORS Issues:**
   - Update frontend API URLs to use Vercel domain
   - Check CORS configuration in server

4. **Build Failures:**
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in package.json

## Environment Variables Reference

```bash
# Required for Supabase
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Optional
NODE_ENV=production
PORT=4000
```

## Next Steps

1. **Custom Domain:** Add your own domain in Vercel settings
2. **Monitoring:** Set up Vercel Analytics
3. **Backups:** Regular database backups in Supabase
4. **Scaling:** Upgrade plans as needed

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentationy](https://supabase.com/docs)
- [PostgreSQL Documentation](https://node-postgres.com/)
