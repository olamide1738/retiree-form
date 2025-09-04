import pkg from 'pg'
const { Pool } = pkg
import multer from 'multer'

let pool

// Initialize database connection
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Optimized for Vercel serverless
      max: 1,
      min: 0,
      idleTimeoutMillis: 0, // Don't close idle connections
      connectionTimeoutMillis: 10000, // Increased timeout
      acquireTimeoutMillis: 10000, // Added acquire timeout
      allowExitOnIdle: true, // Allow process to exit when idle
    })
    
    try {
      // Create tables if they don't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          data_json TEXT NOT NULL
        )
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
      
      console.log('Database tables created successfully')
    } catch (error) {
      console.error('Error creating tables:', error)
      // Don't throw error, just log it and continue
    }
  }
  return pool
}

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await initDB()
    
    const fileFields = [
      { name: 'retirementLetter', maxCount: 1 },
      { name: 'birthCertOrId', maxCount: 1 },
      { name: 'passportPhoto', maxCount: 1 },
      { name: 'otherDocuments', maxCount: 20 },
      { name: 'declarantSignature', maxCount: 1 },
      { name: 'witnessSignature', maxCount: 1 },
    ]
    
    upload.fields(fileFields)(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err)
        return res.status(400).json({ error: 'File upload failed', details: err.message })
      }
      
      try {
        const body = req.body || {}
        const createdAt = new Date().toISOString()

        // Insert submission
        const result = await pool.query(
          'INSERT INTO submissions (created_at, data_json) VALUES ($1, $2) RETURNING id',
          [createdAt, JSON.stringify(body)]
        )
        
        const submissionId = result.rows[0].id

        // Handle file uploads
        const files = req.files || {}
        const fileInserts = []
        
        Object.keys(files).forEach((field) => {
          files[field].forEach((f) => {
            // Store file as base64 in database for Vercel compatibility
            const base64Data = f.buffer.toString('base64')
            fileInserts.push([submissionId, field, f.originalname, base64Data])
          })
        })

        if (fileInserts.length > 0) {
          const placeholders = fileInserts.map((_, i) => 
            `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
          ).join(',')
          const flat = fileInserts.flat()
          
          await pool.query(
            `INSERT INTO files (submission_id, field_name, original_name, stored_path) VALUES ${placeholders}`,
            flat
          )
        }

        res.status(201).json({ id: submissionId })
      } catch (error) {
        console.error('Error saving submission:', error)
        res.status(500).json({ error: 'Failed to save submission', details: error.message })
      }
    })
    
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Database operation failed', details: error.message })
  }
}
