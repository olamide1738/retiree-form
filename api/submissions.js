import pkg from 'pg'
const { Pool } = pkg

let pool

// Initialize database connection
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Session pooler optimizations
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
    
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_json TEXT NOT NULL
      )
    `)
    
    // Create sequence for sequential IDs
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS submissions_id_seq
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `)
    
    // Set the sequence to start from the next available ID
    await pool.query(`
      SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id) FROM submissions), 0) + 1, false)
    `)
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_path TEXT NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )
    `)
  }
  return pool
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // Initialize database
    await initDB()
    
    if (req.method === 'GET') {
      // Get all submissions with files metadata
      const submissionsResult = await pool.query(`
        SELECT s.id, s.created_at, s.data_json
        FROM submissions s 
        ORDER BY s.id DESC
      `)
      
      const filesResult = await pool.query(`
        SELECT f.id, f.submission_id, f.field_name, f.original_name, f.stored_path
        FROM files f
      `)
      
      // Group files by submission_id
      const filesBySubmission = {}
      filesResult.rows.forEach(f => {
        if (!filesBySubmission[f.submission_id]) {
          filesBySubmission[f.submission_id] = []
        }
        filesBySubmission[f.submission_id].push({
          id: f.id,
          field: f.field_name,
          original: f.original_name,
          path: f.stored_path
        })
      })
      
      const submissions = submissionsResult.rows
      
      const result = submissions.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        data: JSON.parse(r.data_json || '{}'),
        files: filesBySubmission[r.id] || []
      }))
      
      res.status(200).json(result)
      
    } else if (req.method === 'POST') {
      // Handle form submission (without file uploads for now)
      const body = req.body || {}
      const createdAt = new Date().toISOString()

      // Insert submission
      const result = await pool.query(
        'INSERT INTO submissions (created_at, data_json) VALUES ($1, $2) RETURNING id',
        [createdAt, JSON.stringify(body)]
      )
      
      const submissionId = result.rows[0].id
      res.status(201).json({ id: submissionId })
      
    } else if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const pathname = url.pathname
      
      if (pathname.includes('/submissions/') && pathname.split('/').length > 3) {
        // Delete specific submission
        const submissionId = pathname.split('/').pop()
        
        // Delete from database (files will be deleted due to foreign key constraint)
        const deleteResult = await pool.query(
          'DELETE FROM submissions WHERE id = $1',
          [submissionId]
        )
        
        if (deleteResult.rowCount === 0) {
          return res.status(404).json({ error: 'Submission not found' })
        }
        
        res.status(200).json({ success: true, deletedId: submissionId })
      } else {
        // Delete all submissions
        await pool.query('DELETE FROM files')
        await pool.query('DELETE FROM submissions')
        
        // Reset the sequence to start from 1
        await pool.query('ALTER SEQUENCE submissions_id_seq RESTART WITH 1')
        
        res.status(200).json({ success: true, message: 'All submissions cleared and ID sequence reset' })
      }
      
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in submissions API:', error)
    res.status(500).json({ error: 'Failed to load submissions' })
  }
}