import pkg from 'pg'
const { Client } = pkg

// Create a new client for each request (no pooling)
const createClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  })
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

  const client = createClient()
  
  try {
    await client.connect()
    console.log('Direct connection established')
    
    if (req.method === 'GET') {
      // Get all submissions with files metadata
      const submissionsResult = await client.query(`
        SELECT s.id, s.created_at, s.data_json
        FROM submissions s 
        ORDER BY s.id DESC
      `)
      
      const filesResult = await client.query(`
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
      const result = await client.query(
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
        const deleteResult = await client.query(
          'DELETE FROM submissions WHERE id = $1',
          [submissionId]
        )
        
        if (deleteResult.rowCount === 0) {
          return res.status(404).json({ error: 'Submission not found' })
        }
        
        res.status(200).json({ success: true, deletedId: submissionId })
      } else {
        // Delete all submissions
        await client.query('DELETE FROM files')
        await client.query('DELETE FROM submissions')
        
        // Reset the sequence to start from 1
        await client.query('ALTER SEQUENCE submissions_id_seq RESTART WITH 1')
        
        res.status(200).json({ success: true, message: 'All submissions cleared and ID sequence reset' })
      }
      
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in submissions API:', error)
    res.status(500).json({ error: 'Failed to load submissions' })
  } finally {
    try {
      await client.end()
    } catch (endError) {
      console.error('Error closing connection:', endError)
    }
  }
}