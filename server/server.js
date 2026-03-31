import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import pkg from 'pg'
const { Pool } = pkg
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const app = express()
app.use(cors())
app.use(express.json())

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve('./uploads')))

// Ensure upload dir exists (skip in serverless environments)
const uploadsDir = path.resolve('./uploads')
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    const safeField = String(file.fieldname).replace(/[^a-zA-Z0-9_-]/g, '_')
    cb(null, `${safeField}-${unique}${ext}`)
  }
})
const upload = multer({ storage })

// PostgreSQL connection
let pool
const initDB = async () => {
  try {
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

    console.log('Database connected and tables created')
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// List submissions with files metadata
app.get('/api/submissions', async (_req, res) => {
  try {
    const submissionsResult = await pool.query(
      'SELECT id, created_at, data_json FROM submissions ORDER BY id DESC'
    )
    const filesResult = await pool.query(
      'SELECT id, submission_id, field_name, original_name, stored_path FROM files'
    )

    const filesBySubmission = {}
    filesResult.rows.forEach(f => {
      if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
      filesBySubmission[f.submission_id].push({
        id: f.id,
        field: f.field_name,
        original: f.original_name,
        path: f.stored_path,
      })
    })

    const result = submissionsResult.rows.map(r => {
      let parsedData = r.data_json || {}
      while (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData)
        } catch (e) {
          break
        }
      }
      return {
        id: r.id,
        createdAt: r.created_at,
        data: parsedData,
        files: filesBySubmission[r.id] || [],
      }
    })

    res.json(result)
  } catch (error) {
    console.error('Error fetching submissions:', error)
    res.status(500).json({ error: 'Failed to load submissions' })
  }
})

// Download a specific uploaded file
app.get('/api/files/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT original_name, stored_path FROM files WHERE id = $1',
      [req.params.id]
    )
    const files = result.rows

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' })
    }

    const file = files[0]
    const absolutePath = path.resolve(file.stored_path)

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File missing on disk' })
    }

    res.download(absolutePath, file.original_name)
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
})

// Delete specific submission or all submissions
app.delete('/api/submissions', async (req, res) => {
  try {
    const submissionId = req.query.id;

    if (submissionId) {
      // Get files to delete from disk
      const result = await pool.query(
        'SELECT stored_path FROM files WHERE submission_id = $1',
        [submissionId]
      )
      const files = result.rows

      // Delete physical files
      files.forEach(file => {
        const absolutePath = path.resolve(file.stored_path)
        if (fs.existsSync(absolutePath)) {
          try {
            fs.unlinkSync(absolutePath)
          } catch (unlinkErr) {
            console.error('Failed to delete file:', absolutePath, unlinkErr)
          }
        }
      })

      // Delete from database (files will be deleted due to foreign key constraint)
      const deleteResult = await pool.query(
        'DELETE FROM submissions WHERE id = $1',
        [submissionId]
      )

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'Submission not found' })
      }

      return res.json({ success: true, deletedId: submissionId })
    }

    // --- Otherwise, clear all submissions ---
    // Get all files to delete from disk
    const result = await pool.query('SELECT stored_path FROM files')
    const files = result.rows

    // Delete all physical files
    files.forEach(file => {
      const absolutePath = path.resolve(file.stored_path)
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath)
        } catch (unlinkErr) {
          console.error('Failed to delete file:', absolutePath, unlinkErr)
        }
      }
    })

    // Clear database tables
    await pool.query('DELETE FROM files')
    await pool.query('DELETE FROM submissions')

    res.json({ success: true, message: 'All submissions cleared' })
  } catch (error) {
    console.error('Error deleting submission(s):', error)
    res.status(500).json({ error: 'Failed to delete submission(s)' })
  }
})

// Backup Database
app.get('/api/submissions/backup', async (req, res) => {
  try {
    const subResult = await pool.query('SELECT * FROM submissions ORDER BY id ASC')
    const fileResult = await pool.query('SELECT * FROM files ORDER BY id ASC')

    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      submissions: subResult.rows,
      files: fileResult.rows
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename="retiree-db-backup.json"')
    res.send(JSON.stringify(backupData, null, 2))
  } catch (error) {
    console.error('Backup error:', error)
    res.status(500).json({ error: 'Failed to generate backup' })
  }
})

// Restore Database
app.post('/api/submissions/restore', express.json({ limit: '50mb' }), async (req, res) => {
  const client = await pool.connect()
  try {
    const { submissions, files } = req.body
    if (!Array.isArray(submissions) || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Invalid backup format' })
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM files')
    await client.query('DELETE FROM submissions')

    for (const sub of submissions) {
      const formattedData = typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json);
      await client.query(
        'INSERT INTO submissions (id, created_at, data_json) VALUES ($1, $2, $3)',
        [sub.id, sub.created_at, formattedData]
      )
    }

    for (const file of files) {
      await client.query(
        'INSERT INTO files (id, submission_id, field_name, original_name, stored_path) VALUES ($1, $2, $3, $4, $5)',
        [file.id, file.submission_id, file.field_name, file.original_name, file.stored_path]
      )
    }

    await client.query("SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id)+1 FROM submissions), 1), false)")
    await client.query("SELECT setval('files_id_seq', COALESCE((SELECT MAX(id)+1 FROM files), 1), false)")

    await client.query('COMMIT')
    res.status(200).json({ success: true, message: 'Database restored successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Restore error:', error)
    res.status(500).json({ error: 'Failed to restore database', details: error.message })
  } finally {
    client.release()
  }
})

// Update a specific submission's data_json
app.put('/api/submissions', async (req, res) => {
  try {
    const submissionId = req.query?.id || req.body?.id;
    if (!submissionId) return res.status(400).json({ error: 'Missing logic ID' });
    const updateBody = req.body || {}

    const checkResult = await pool.query('SELECT id FROM submissions WHERE id = $1', [submissionId])
    if (checkResult.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    await pool.query(
      'UPDATE submissions SET data_json = $1 WHERE id = $2',
      [JSON.stringify(updateBody), submissionId]
    )

    res.json({ success: true, updatedId: submissionId })
  } catch (error) {
    console.error('Error updating submission:', error)
    res.status(500).json({ error: 'Failed to update submission' })
  }
})


// Save submission - handle many possible files
const fileFields = [
  { name: 'retirementLetter', maxCount: 1 },
  { name: 'birthCertOrId', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 20 },
  { name: 'declarantSignature', maxCount: 1 },
  { name: 'witnessSignature', maxCount: 1 },
]

app.post('/api/upload', upload.fields(fileFields), async (req, res) => {
  try {
    const body = req.body || {}
    const createdAt = new Date().toISOString()

    // Insert submission
    const result = await pool.query(
      'INSERT INTO submissions (created_at, data_json) VALUES ($1, $2) RETURNING id',
      [createdAt, JSON.stringify(body)]
    )

    const submissionId = result.rows[0].id

    // Insert files metadata
    const files = req.files || {}
    const fileInserts = []

    Object.keys(files).forEach((field) => {
      files[field].forEach((f) => {
        fileInserts.push([submissionId, field, f.originalname, f.path])
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

// Export to Excel
app.get('/api/submissions/export', async (_req, res) => {
  try {
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
      ['Next of Kin Relationship', 'nextOfKinRelationship'],
      ['Organization', 'organization'],
      ['Job Title', 'jobTitle'],
      ['Department', 'department'],
      ['Date of Employment', 'dateOfEmployment'],
      ['Date of Retirement', 'dateOfRetirement'],
      ['Retirement Reason', 'retirementReason'],
      ['Grade Level', 'gradeLevel'],
      ['Pension Number', 'pensionNumber'],
      ['Pension Fund Administrator', 'pensionFundAdministrator'],
      ['PMO Officer', 'pmoOfficer'],
      ['Preferred Communication', 'preferredCommunication'],
      ['Health Status', 'healthStatus'],
      ['Additional Comments', 'additionalComments']
    ]

    const fileHeaders = [
      ['Retirement Letter (file)', 'retirementLetter'],
      ['Birth Cert / ID (file)', 'birthCertOrId'],
      ['Passport Photo (file)', 'passportPhoto'],
      ['Other Documents (files)', 'otherDocuments']
    ]

    const allHeaders = [...headers, ...fileHeaders]
    sheet.columns = allHeaders.map(([header, key]) => ({
      header,
      key,
      width: Math.max(18, header.length + 2)
    }))

    submissions.forEach((row) => {
      let data = row.data_json || {}
      while (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (e) { break }
      }
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
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    res.status(500).json({ error: 'Failed to export to Excel' })
  }
})

// Export to PDF
app.get('/api/submissions/export.pdf', async (_req, res) => {
  try {
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

    // Helper function to format field names
    const formatFieldName = (key) => {
      const fieldMap = {
        fullName: 'Full Name',
        dateOfBirth: 'Date of Birth',
        gender: 'Gender',
        nationality: 'Nationality',
        residentialAddress: 'Residential Address',
        phoneNumber: 'Phone Number',
        emailAddress: 'Email Address',
        nextOfKinName: 'Next of Kin Name',
        nextOfKinPhone: 'Next of Kin Phone Number',
        nextOfKinRelationship: 'Relationship with Next of Kin',
        organization: 'Organization',
        jobTitle: 'Job Title at Retirement',
        department: 'Department/Unit',
        dateOfEmployment: 'Date of Employment',
        dateOfRetirement: 'Date of Retirement',
        retirementReason: 'Reason for Retirement',
        gradeLevel: 'Grade Level',
        pensionNumber: 'Pension Number',
        pensionFundAdministrator: 'Pension Fund Administrator',
        preferredCommunication: 'Preferred Mode of Communication',
        healthStatus: 'Health Status',
        additionalComments: 'Additional Comments',
        pmoOfficer: 'PMO Officer',
        confirmAccuracy: 'Confirmation of Accuracy',
        declarationDate: 'Declaration Date',
        witnessName: 'Witness/HR Officer Name',
        witnessDate: 'Witness/HR Officer Date'
      }
      return fieldMap[key] || key
    }

    // Helper function to format values
    const formatValue = (key, value) => {
      if (!value || value === '') return 'Not provided'

      // Format dates
      if (key.includes('Date') || key.includes('date')) {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }
      }

      return String(value)
    }

    doc.fontSize(20).text('RETIREE FORM SUBMISSIONS REPORT', { align: 'center' })
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, { align: 'center' })
    doc.moveDown(2)

    submissions.forEach((row, index) => {
      let data = row.data_json || {}
      while (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (e) { break }
      }

      // Submission header
      doc.fontSize(14).text(`SUBMISSION #${row.id}`, { underline: true })
      doc.fontSize(10).text(`Submitted: ${new Date(row.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`)
      doc.moveDown(1)

      // Personal Information Section
      doc.fontSize(12).text('PERSONAL INFORMATION', { underline: true })
      doc.moveDown(0.5)
      const personalFields = ['fullName', 'dateOfBirth', 'gender', 'nationality', 'residentialAddress', 'phoneNumber', 'emailAddress', 'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship']
      personalFields.forEach(key => {
        if (data[key] !== undefined) {
          doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
        }
      })
      doc.moveDown(1)

      // Employment Information Section
      doc.fontSize(12).text('EMPLOYMENT INFORMATION', { underline: true })
      doc.moveDown(0.5)
      const employmentFields = ['organization', 'jobTitle', 'department', 'dateOfEmployment', 'dateOfRetirement', 'retirementReason', 'gradeLevel']
      employmentFields.forEach(key => {
        if (data[key] !== undefined) {
          doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
        }
      })
      doc.moveDown(1)

      // Pension/Benefits Information Section
      doc.fontSize(12).text('PENSION/BENEFITS INFORMATION', { underline: true })
      doc.moveDown(0.5)
      const pensionFields = ['pensionNumber', 'pensionFundAdministrator']
      pensionFields.forEach(key => {
        if (data[key] !== undefined) {
          doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
        }
      })
      doc.moveDown(1)

      // Optional Questions Section
      doc.fontSize(12).text('ADDITIONAL INFORMATION', { underline: true })
      doc.moveDown(0.5)
      const optionalFields = ['pmoOfficer', 'preferredCommunication', 'healthStatus', 'additionalComments']
      optionalFields.forEach(key => {
        if (data[key] !== undefined) {
          doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
        }
      })
      doc.moveDown(1)


      // Files Section
      const submissionFiles = filesBySubmission[row.id] || []
      if (submissionFiles.length) {
        doc.fontSize(12).text('UPLOADED DOCUMENTS', { underline: true })
        doc.moveDown(0.5)

        const fileFieldLabels = {
          retirementLetter: 'Copy of Retirement Letter / Service Certificate',
          birthCertOrId: 'Birth Certificate / National ID',
          passportPhoto: 'Passport Photograph',
          otherDocuments: 'Other Relevant Documents'
        }

        // Group files by field name
        const filesByField = {}
        submissionFiles.forEach(f => {
          if (!filesByField[f.field_name]) filesByField[f.field_name] = []
          filesByField[f.field_name].push(f)
        })

        // Display each file field category
        Object.keys(fileFieldLabels).forEach(fieldName => {
          const fieldFiles = filesByField[fieldName] || []
          if (fieldFiles.length > 0) {
            doc.fontSize(11).text(`${fileFieldLabels[fieldName]}:`, { underline: false })
            fieldFiles.forEach(f => {
              const url = `${_req.protocol}://${_req.get('host')}/api/files/${f.id}`
              doc.fontSize(10).text(`  • ${f.original_name}`)
              doc.fontSize(9).fillColor('#1565c0').text(`    Download: ${url}`)
              doc.fillColor('black')
            })
            doc.moveDown(0.3)
          } else {
            // Show field as "Not provided" if no files uploaded
            doc.fontSize(10).text(`${fileFieldLabels[fieldName]}: Not provided`)
            doc.moveDown(0.3)
          }
        })

        doc.moveDown(1)
      } else {
        // Show all file fields as "Not provided" if no files at all
        doc.fontSize(12).text('UPLOADED DOCUMENTS', { underline: true })
        doc.moveDown(0.5)

        const fileFieldLabels = {
          retirementLetter: 'Copy of Retirement Letter / Service Certificate',
          birthCertOrId: 'Birth Certificate / National ID',
          passportPhoto: 'Passport Photograph',
          otherDocuments: 'Other Relevant Documents',
          declarantSignature: 'Declarant Signature',
          witnessSignature: 'Witness / HR Officer Signature'
        }

        Object.values(fileFieldLabels).forEach(label => {
          doc.fontSize(10).text(`${label}: Not provided`)
          doc.moveDown(0.3)
        })

        doc.moveDown(1)
      }

      // Page break for next submission (except last one)
      if (index < submissions.length - 1) {
        doc.addPage()
      }
    })

    doc.end()
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    res.status(500).json({ error: 'Failed to export to PDF' })
  }
})

// Initialize database and start server
const PORT = process.env.PORT || 4000

// For Vercel serverless functions
if (process.env.NODE_ENV === 'production') {
  // Initialize DB and export the app for Vercel
  initDB().then(() => {
    console.log('Database initialized for Vercel')
  }).catch(err => {
    console.error('Database initialization failed:', err)
  })

  module.exports = app
} else {
  // For local development
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`)
    })
  })
}
