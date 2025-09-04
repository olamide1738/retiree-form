import pkg from 'pg'
const { Pool } = pkg

let pool

// Initialize database connection
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
    
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
  }
  return pool
}

export default async function handler(req, res) {
  try {
    // Initialize database
    await initDB()
    
    if (req.method === 'GET') {
      // Get all submissions
      const result = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
      res.status(200).json(result.rows)
    } else if (req.method === 'POST') {
      // Create new submission
      const { data } = req.body
      const result = await pool.query(
        'INSERT INTO submissions (data_json) VALUES ($1) RETURNING id',
        [JSON.stringify(data)]
      )
      res.status(201).json({ id: result.rows[0].id })
    } else if (req.method === 'DELETE') {
      // Delete submission
      const { id } = req.query
      if (id) {
        await pool.query('DELETE FROM submissions WHERE id = $1', [id])
        res.status(200).json({ message: 'Submission deleted' })
      } else {
        // Delete all submissions
        await pool.query('DELETE FROM submissions')
        res.status(200).json({ message: 'All submissions deleted' })
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Database operation failed' })
  }
}
