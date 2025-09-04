import pkg from 'pg'
const { Pool } = pkg
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

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

// Configure multer for file uploads
const storage = multer.memoryStorage() // Use memory storage for Vercel
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we'll handle it with multer
  },
}

export default async function handler(req, res) {
  try {
    // Initialize database
    await initDB()
    
    if (req.method === 'GET') {
      // Handle different GET endpoints
      const url = new URL(req.url, `http://${req.headers.host}`)
      const pathname = url.pathname
      
      if (pathname.includes('/export')) {
        // Export to Excel
        const submissionsResult = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
        const filesResult = await pool.query('SELECT * FROM files')
        const submissions = submissionsResult.rows
        const files = filesResult.rows
        
        const filesBySubmission = {}
        files.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })

        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Submissions')

        const headers = [
          ['ID', 'id'],
          ['Created At', 'created_at'],
          ['Full Name', 'fullName'],
          ['Date of Birth', 'dateOfBirth'],
          ['Gender', 'gender'],
          ['Nationality', 'nationality'],
          ['Residential Address', 'residentialAddress'],
          ['Phone Number', 'phoneNumber'],
          ['Email Address', 'emailAddress'],
          ['Next of Kin Name', 'nextOfKinName'],
          ['Next of Kin Phone', 'nextOfKinPhone'],
          ['Organization', 'organization'],
          ['Job Title', 'jobTitle'],
          ['Department', 'department'],
          ['Date of Employment', 'dateOfEmployment'],
          ['Date of Retirement', 'dateOfRetirement'],
          ['Retirement Reason', 'retirementReason'],
          ['Last Salary / Grade', 'lastSalaryOrGrade'],
          ['Pension Number', 'pensionNumber'],
          ['Bank Name', 'bankName'],
          ['Account Number', 'accountNumber'],
          ['Payment Mode', 'pensionPaymentMode'],
          ['BVN', 'bvn'],
          ['Confirm Accuracy', 'confirmAccuracy'],
          ['Declaration Date', 'declarationDate'],
          ['Witness Name', 'witnessName'],
          ['Witness Date', 'witnessDate'],
          ['Preferred Communication', 'preferredCommunication'],
          ['Health Status', 'healthStatus'],
          ['Additional Comments', 'additionalComments']
        ]
        
        const fileHeaders = [
          ['Retirement Letter (file)', 'retirementLetter'],
          ['Birth Cert / ID (file)', 'birthCertOrId'],
          ['Passport Photo (file)', 'passportPhoto'],
          ['Other Documents (files)', 'otherDocuments'],
          ['Declarant Signature (file)', 'declarantSignature'],
          ['Witness Signature (file)', 'witnessSignature']
        ]
        
        const allHeaders = [...headers, ...fileHeaders]
        sheet.columns = allHeaders.map(([header, key]) => ({ 
          header, 
          key, 
          width: Math.max(18, header.length + 2) 
        }))

        submissions.forEach((row) => {
          const data = JSON.parse(row.data_json || '{}')
          const record = { id: row.id, created_at: row.created_at }
          headers.slice(2).forEach(([, key]) => { 
            record[key] = data[key] || '' 
          })

          const submissionFiles = filesBySubmission[row.id] || []
          const byField = submissionFiles.reduce((acc, f) => {
            if (!acc[f.field_name]) acc[f.field_name] = []
            acc[f.field_name].push(f)
            return acc
          }, {})
          
          record.retirementLetter = (byField.retirementLetter?.[0]?.original_name) || ''
          record.birthCertOrId = (byField.birthCertOrId?.[0]?.original_name) || ''
          record.passportPhoto = (byField.passportPhoto?.[0]?.original_name) || ''
          record.declarantSignature = (byField.declarantSignature?.[0]?.original_name) || ''
          record.witnessSignature = (byField.witnessSignature?.[0]?.original_name) || ''
          record.otherDocuments = (byField.otherDocuments ? 
            byField.otherDocuments.map(f => f.original_name).join(', ') : '')

          sheet.addRow(record)
        })

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"')
        await workbook.xlsx.write(res)
        res.end()
        return
      }
      
      if (pathname.includes('/export.pdf')) {
        // Export to PDF
        const submissionsResult = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
        const filesResult = await pool.query('SELECT * FROM files')
        const submissions = submissionsResult.rows
        const files = filesResult.rows
        
        const filesBySubmission = {}
        files.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'attachment; filename="submissions.pdf"')

        const doc = new PDFDocument({ margin: 40, size: 'A4' })
        doc.pipe(res)

        doc.fontSize(16).text('Submissions Report', { align: 'center' })
        doc.moveDown()

        submissions.forEach((row, index) => {
          const data = JSON.parse(row.data_json || '{}')
          doc.fontSize(12).text(`Submission #${row.id} — ${row.created_at}`)
          const entries = Object.entries(data)
          entries.forEach(([k, v]) => {
            doc.fontSize(10).text(`${k}: ${v ?? ''}`)
          })

          const submissionFiles = filesBySubmission[row.id] || []
          if (submissionFiles.length) {
            doc.moveDown(0.25)
            doc.fontSize(11).text('Files:', { underline: true })
            submissionFiles.forEach(f => {
              doc.fontSize(10).text(`- ${f.field_name}: ${f.original_name}`)
            })
          }

          if (index < submissions.length - 1) {
            doc.moveDown()
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
            doc.moveDown()
          }
        })

        doc.end()
        return
      }
      
      // Get all submissions with files metadata
      const [submissions] = await pool.query(`
        SELECT s.id, s.created_at, s.data_json,
               COALESCE(
                 (SELECT JSON_ARRAYAGG(
                   JSON_OBJECT(
                     'id', f.id,
                     'field', f.field_name,
                     'original', f.original_name,
                     'path', f.stored_path
                   )
                 )
                 FROM files f WHERE f.submission_id = s.id),
                 JSON_ARRAY()
               ) AS files
        FROM submissions s 
        ORDER BY s.id DESC
      `)
      
      const result = submissions.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        data: JSON.parse(r.data_json || '{}'),
        files: r.files ? JSON.parse(r.files) : []
      }))
      
      res.json(result)
      
    } else if (req.method === 'POST') {
      // Handle file uploads and form submission
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
          return res.status(400).json({ error: 'File upload failed' })
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

          // For Vercel, we'll store files as base64 in the database since file system is read-only
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

          res.json({ id: submissionId })
        } catch (error) {
          console.error('Error saving submission:', error)
          res.status(500).json({ error: 'Failed to save submission' })
        }
      })
      
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
        
        res.json({ success: true, deletedId: submissionId })
      } else {
        // Delete all submissions
        await pool.query('DELETE FROM files')
        await pool.query('DELETE FROM submissions')
        res.json({ success: true, message: 'All submissions cleared' })
      }
      
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Database operation failed' })
  }
}