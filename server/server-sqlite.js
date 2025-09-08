import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const app = express()
app.use(cors())
// Serve uploaded files statically (for direct links if needed)
app.use('/uploads', express.static(path.resolve('./uploads')))

// Ensure upload dir exists
const uploadsDir = path.resolve('./uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

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

// SQLite setup
const dbFile = path.resolve('./data.sqlite')
const db = new sqlite3.Database(dbFile)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    FOREIGN KEY(submission_id) REFERENCES submissions(id)
  )`)
})

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// List submissions (parsed) with files metadata
app.get('/api/submissions', (_req, res) => {
  db.all(
    `SELECT s.id, s.created_at, s.data_json,
            (SELECT json_group_array(json_object('id', f.id, 'field', f.field_name, 'original', f.original_name, 'path', f.stored_path))
             FROM files f WHERE f.submission_id = s.id) AS files
     FROM submissions s ORDER BY s.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB read failed' })
      const result = rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        data: JSON.parse(r.data_json || '{}'),
        files: r.files ? JSON.parse(r.files) : []
      }))
      res.json(result)
    }
  )
})

// Download a specific uploaded file by its database id
app.get('/api/files/:id', (req, res) => {
  const fileId = req.params.id
  db.get(`SELECT original_name, stored_path FROM files WHERE id = ?`, [fileId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    if (!row) return res.status(404).json({ error: 'File not found' })
    const absolutePath = path.resolve(row.stored_path)
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File missing on disk' })
    res.download(absolutePath, row.original_name)
  })
})

// Delete a specific submission and its files
app.delete('/api/submissions/:id', (req, res) => {
  const submissionId = req.params.id
  
  // First, get all files associated with this submission
  db.all(`SELECT stored_path FROM files WHERE submission_id = ?`, [submissionId], (err, files) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    
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
    
    // Delete files from database first
    db.run(`DELETE FROM files WHERE submission_id = ?`, [submissionId], (fileErr) => {
      if (fileErr) return res.status(500).json({ error: 'Failed to delete files from database' })
      
      // Then delete the submission
      db.run(`DELETE FROM submissions WHERE id = ?`, [submissionId], function(err) {
        if (err) return res.status(500).json({ error: 'DB delete failed' })
        if (this.changes === 0) return res.status(404).json({ error: 'Submission not found' })
        res.json({ success: true, deletedId: submissionId })
      })
    })
  })
})

// Clear all submissions and their files
app.delete('/api/submissions', (req, res) => {
  // Get all files to delete them from disk
  db.all(`SELECT stored_path FROM files`, [], (err, files) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    
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
    
    // Clear database tables - delete files first to avoid foreign key constraint issues
    db.run(`DELETE FROM files`, [], (fileErr) => {
      if (fileErr) {
        console.error('Error clearing files table:', fileErr)
        return res.status(500).json({ error: 'Failed to clear files table: ' + fileErr.message })
      }
      
      db.run(`DELETE FROM submissions`, [], (subErr) => {
        if (subErr) {
          console.error('Error clearing submissions table:', subErr)
          return res.status(500).json({ error: 'Failed to clear submissions table: ' + subErr.message })
        }
        res.json({ success: true, message: 'All submissions cleared' })
      })
    })
  })
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

app.post('/api/submissions', upload.fields(fileFields), (req, res) => {
  // Extract text fields
  const body = req.body || {}
  const createdAt = new Date().toISOString()

  // Persist JSON of all text fields
  db.run(
    `INSERT INTO submissions (created_at, data_json) VALUES (?, ?)`,
    [createdAt, JSON.stringify(body)],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB insert failed' })
      const submissionId = this.lastID

      // Persist files metadata
      const filesToInsert = []
      const files = req.files || {}
      Object.keys(files).forEach((field) => {
        files[field].forEach((f) => {
          filesToInsert.push([
            submissionId,
            field,
            f.originalname,
            f.path
          ])
        })
      })

      if (filesToInsert.length === 0) {
        return res.json({ id: submissionId })
      }

      const placeholders = filesToInsert.map(() => '(?, ?, ?, ?)').join(',')
      const flat = filesToInsert.flat()
      db.run(
        `INSERT INTO files (submission_id, field_name, original_name, stored_path) VALUES ${placeholders}`,
        flat,
        (fileErr) => {
          if (fileErr) return res.status(500).json({ error: 'DB file insert failed' })
          res.json({ id: submissionId })
        }
      )
    }
  )
})

// Export to Excel
app.get('/api/submissions/export', (_req, res) => {
  db.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    db.all(`SELECT * FROM files`, [], async (fErr, fRows) => {
      const filesBySubmission = {}
      if (!fErr && Array.isArray(fRows)) {
        fRows.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Submissions')

      // Build columns from known fields and add file columns
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
      sheet.columns = allHeaders.map(([header, key]) => ({ header, key, width: Math.max(18, header.length + 2) }))

      rows.forEach((row) => {
        const data = JSON.parse(row.data_json || '{}')
        const record = { id: row.id, created_at: row.created_at }
        headers.slice(2).forEach(([, key]) => { record[key] = data[key] || '' })

        const files = filesBySubmission[row.id] || []
        const byField = files.reduce((acc, f) => {
          if (!acc[f.field_name]) acc[f.field_name] = []
          acc[f.field_name].push(f)
          return acc
        }, {})
        record.retirementLetter = (byField.retirementLetter?.[0]?.original_name) || ''
        record.birthCertOrId = (byField.birthCertOrId?.[0]?.original_name) || ''
        record.passportPhoto = (byField.passportPhoto?.[0]?.original_name) || ''
        record.declarantSignature = (byField.declarantSignature?.[0]?.original_name) || ''
        record.witnessSignature = (byField.witnessSignature?.[0]?.original_name) || ''
        record.otherDocuments = (byField.otherDocuments ? byField.otherDocuments.map(f => f.original_name).join(', ') : '')

        sheet.addRow(record)
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"')
      await workbook.xlsx.write(res)
      res.end()
    })
  })
})

// Export to PDF
app.get('/api/submissions/export.pdf', (_req, res) => {
  db.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    db.all(`SELECT * FROM files`, [], (fErr, fRows) => {
      const filesBySubmission = {}
      if (!fErr && Array.isArray(fRows)) {
        fRows.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })
      }

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
          organization: 'Organization',
          jobTitle: 'Job Title at Retirement',
          department: 'Department/Unit',
          dateOfEmployment: 'Date of Employment',
          dateOfRetirement: 'Date of Retirement',
          retirementReason: 'Reason for Retirement',
          lastSalaryOrGrade: 'Last Salary/Grade Level',
          pensionNumber: 'Pension Number',
          bankName: 'Bank Name',
          accountNumber: 'Account Number',
          pensionPaymentMode: 'Mode of Pension Payment',
          bvn: 'Bank Verification Number (BVN)',
          preferredCommunication: 'Preferred Mode of Communication',
          healthStatus: 'Health Status',
          additionalComments: 'Additional Comments',
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

      rows.forEach((row, index) => {
        const data = JSON.parse(row.data_json || '{}')
        
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
        const personalFields = ['fullName', 'dateOfBirth', 'gender', 'nationality', 'residentialAddress', 'phoneNumber', 'emailAddress', 'nextOfKinName', 'nextOfKinPhone']
        personalFields.forEach(key => {
          if (data[key] !== undefined) {
            doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
          }
        })
        doc.moveDown(1)

        // Employment Information Section
        doc.fontSize(12).text('EMPLOYMENT INFORMATION', { underline: true })
        doc.moveDown(0.5)
        const employmentFields = ['organization', 'jobTitle', 'department', 'dateOfEmployment', 'dateOfRetirement', 'retirementReason', 'lastSalaryOrGrade']
        employmentFields.forEach(key => {
          if (data[key] !== undefined) {
            doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
          }
        })
        doc.moveDown(1)

        // Pension/Benefits Information Section
        doc.fontSize(12).text('PENSION/BENEFITS INFORMATION', { underline: true })
        doc.moveDown(0.5)
        const pensionFields = ['pensionNumber', 'bankName', 'accountNumber', 'pensionPaymentMode', 'bvn']
        pensionFields.forEach(key => {
          if (data[key] !== undefined) {
            doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
          }
        })
        doc.moveDown(1)

        // Optional Questions Section
        doc.fontSize(12).text('ADDITIONAL INFORMATION', { underline: true })
        doc.moveDown(0.5)
        const optionalFields = ['preferredCommunication', 'healthStatus', 'additionalComments']
        optionalFields.forEach(key => {
          if (data[key] !== undefined) {
            doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
          }
        })
        doc.moveDown(1)

        // Declaration/Consent Section
        doc.fontSize(12).text('DECLARATION/CONSENT', { underline: true })
        doc.moveDown(0.5)
        const declarationFields = ['confirmAccuracy', 'declarationDate', 'witnessName', 'witnessDate']
        declarationFields.forEach(key => {
          if (data[key] !== undefined) {
            doc.fontSize(10).text(`${formatFieldName(key)}: ${formatValue(key, data[key])}`)
          }
        })
        doc.moveDown(1)

        // Files Section
        const files = filesBySubmission[row.id] || []
        if (files.length) {
          doc.fontSize(12).text('UPLOADED DOCUMENTS', { underline: true })
          doc.moveDown(0.5)
          files.forEach(f => {
            const url = `http://localhost:4000/api/files/${f.id}`
            doc.fontSize(10).text(`• ${formatFieldName(f.field_name)}: ${f.original_name}`)
            doc.fontSize(9).fillColor('#1565c0').text(`   Download: ${url}`)
            doc.fillColor('black')
          })
          doc.moveDown(1)
        }

        // Page break for next submission (except last one)
        if (index < rows.length - 1) {
          doc.addPage()
        }
      })

      doc.end()
    })
  })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))


