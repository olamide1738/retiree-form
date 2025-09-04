import pkg from 'pg'
const { Pool } = pkg
import PDFDocument from 'pdfkit'

let pool

const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Minimal settings for Vercel
      max: 1,
      min: 0,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 0, // No timeout
      acquireTimeoutMillis: 0, // No timeout
      allowExitOnIdle: true,
    })
  }
  return pool
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await initDB()
    
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

    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      info: {
        Title: 'Retiree Verification Form - Submissions Report',
        Author: 'Lagos State Government',
        Subject: 'Retiree Verification Submissions',
        Creator: 'Retiree Verification System'
      }
    })
    doc.pipe(res)

    // Header
    doc.rect(50, 50, 495, 80)
      .fillColor('#B8860B')
      .fill()
    
    doc.fillColor('white')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('LAGOS STATE GOVERNMENT', 60, 70, { align: 'center', width: 475 })
    
    doc.fontSize(16)
      .text('Retiree Verification Form - Submissions Report', 60, 100, { align: 'center', width: 475 })
    
    doc.fillColor('black')
    doc.moveDown(3)

    // Summary
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`Total Submissions: ${submissions.length}`, { align: 'center' })
    
    doc.fontSize(10)
      .font('Helvetica')
      .text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, { align: 'center' })
    
    doc.moveDown(2)

    submissions.forEach((row, index) => {
      const data = JSON.parse(row.data_json || '{}')
      
      // Submission header
      doc.rect(50, doc.y, 495, 25)
        .fillColor('#F5F5F5')
        .fill()
      
      doc.fillColor('black')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Submission #${row.id}`, 60, doc.y - 20)
      
      doc.fontSize(10)
        .font('Helvetica')
        .text(`Submitted: ${new Date(row.created_at).toLocaleDateString('en-GB')} at ${new Date(row.created_at).toLocaleTimeString('en-GB')}`, 200, doc.y - 20)
      
      doc.moveDown(1.5)

      // Helper function to create a section box
      const createSection = (title, fields, x, y, width, height) => {
        // Section header
        doc.rect(x, y, width, 20)
          .fillColor('#B8860B')
          .fill()
        
        doc.fillColor('white')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(title, x + 5, y + 5)
        
        // Section content
        doc.fillColor('black')
        doc.fontSize(8)
        doc.font('Helvetica')
        
        let currentY = y + 25
        fields.forEach(field => {
          if (data[field.key] && currentY < y + height - 10) {
            const label = field.label + ':'
            const value = String(data[field.key])
            
            // Truncate long values
            const maxValueLength = 20
            const truncatedValue = value.length > maxValueLength ? 
              value.substring(0, maxValueLength) + '...' : value
            
            doc.text(`${label}`, x + 5, currentY)
            doc.text(truncatedValue, x + 70, currentY)
            currentY += 12
          }
        })
        
        return y + height + 10 // Return next Y position
      }

      // Two-column grid layout
      const leftColumnX = 50
      const rightColumnX = 297.5 // Half of 495 + 50
      const columnWidth = 222.5 // (495 - 50) / 2
      const sectionHeight = 100
      let currentY = doc.y

      // Row 1: Personal Information (Left) & Pension Information (Right)
      if (data.fullName || data.dateOfBirth || data.gender || data.nationality) {
        const personalFields = [
          { key: 'fullName', label: 'Full Name' },
          { key: 'dateOfBirth', label: 'Date of Birth' },
          { key: 'gender', label: 'Gender' },
          { key: 'nationality', label: 'Nationality' },
          { key: 'residentialAddress', label: 'Address' },
          { key: 'phoneNumber', label: 'Phone' },
          { key: 'emailAddress', label: 'Email' }
        ]
        currentY = createSection('PERSONAL INFO', personalFields, leftColumnX, currentY, columnWidth, sectionHeight)
      }

      if (data.pensionNumber || data.bankName || data.accountNumber) {
        const pensionFields = [
          { key: 'pensionNumber', label: 'Pension No' },
          { key: 'bankName', label: 'Bank' },
          { key: 'accountNumber', label: 'Account No' },
          { key: 'pensionPaymentMode', label: 'Payment Mode' },
          { key: 'bvn', label: 'BVN' }
        ]
        createSection('PENSION INFO', pensionFields, rightColumnX, currentY - sectionHeight - 10, columnWidth, sectionHeight)
      }

      // Row 2: Employment Information (Left) & Next of Kin (Right)
      if (data.organization || data.jobTitle || data.department) {
        const employmentFields = [
          { key: 'organization', label: 'Organization' },
          { key: 'jobTitle', label: 'Job Title' },
          { key: 'department', label: 'Department' },
          { key: 'dateOfEmployment', label: 'Start Date' },
          { key: 'dateOfRetirement', label: 'End Date' },
          { key: 'retirementReason', label: 'Reason' },
          { key: 'lastSalaryOrGrade', label: 'Last Salary' }
        ]
        currentY = createSection('EMPLOYMENT', employmentFields, leftColumnX, currentY, columnWidth, sectionHeight)
      }

      if (data.nextOfKinName || data.nextOfKinPhone) {
        const nextOfKinFields = [
          { key: 'nextOfKinName', label: 'Name' },
          { key: 'nextOfKinPhone', label: 'Phone' }
        ]
        createSection('NEXT OF KIN', nextOfKinFields, rightColumnX, currentY - sectionHeight - 10, columnWidth, sectionHeight)
      }

      // Row 3: Attached Documents (Left) & Additional Information (Right)
      const submissionFiles = filesBySubmission[row.id] || []
      if (submissionFiles.length) {
        // Create Attached Documents section
        const documentsY = currentY
        doc.rect(leftColumnX, documentsY, columnWidth, sectionHeight)
          .fillColor('#B8860B')
          .fill()
        
        doc.fillColor('white')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('ATTACHED DOCUMENTS', leftColumnX + 5, documentsY + 5)
        
        doc.fillColor('black')
        doc.fontSize(8)
        doc.font('Helvetica')
        
        let docY = documentsY + 25
        submissionFiles.forEach((f, fileIndex) => {
          if (docY < documentsY + sectionHeight - 10) {
            const fileUrl = `https://${req.headers.host}/api/files/${f.id}`
            doc.text(`• ${f.field_name}:`, leftColumnX + 5, docY)
            doc.fontSize(7)
              .fillColor('#8B4513') // Dark brown color that complements gold
              .text(`${f.original_name}`, leftColumnX + 5, docY + 8)
            doc.fontSize(6)
              .fillColor('#A0522D') // Slightly lighter brown for download links
              .text(`Download: ${fileUrl}`, leftColumnX + 5, docY + 16)
            doc.fillColor('black')
            docY += 25
          }
        })
      }

      // Additional Information (Right side of Row 3)
      if (data.preferredCommunication || data.healthStatus || data.additionalComments) {
        // Create Additional Info section manually for better spacing
        const additionalY = currentY
        doc.rect(rightColumnX, additionalY, columnWidth, sectionHeight)
          .fillColor('#B8860B')
          .fill()
        
        doc.fillColor('white')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('ADDITIONAL INFO', rightColumnX + 5, additionalY + 5)
        
        doc.fillColor('black')
        doc.fontSize(8)
        doc.font('Helvetica')
        
        let infoY = additionalY + 25
        const additionalFields = [
          { key: 'preferredCommunication', label: 'Preferred Communication' },
          { key: 'healthStatus', label: 'Health Status' },
          { key: 'additionalComments', label: 'Additional Comments' }
        ]
        
        additionalFields.forEach(field => {
          if (data[field.key] && infoY < additionalY + sectionHeight - 10) {
            const label = field.label + ':'
            const value = String(data[field.key])
            
            // Truncate long values
            const maxValueLength = 20
            const truncatedValue = value.length > maxValueLength ? 
              value.substring(0, maxValueLength) + '...' : value
            
            doc.text(`${label}`, rightColumnX + 5, infoY)
            doc.text(truncatedValue, rightColumnX + 5, infoY + 12)
            infoY += 24 // More spacing between fields
          }
        })
      }

      // Page break between submissions (except for the last one)
      if (index < submissions.length - 1) {
        doc.addPage()
      }
    })

    doc.end()
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    res.status(500).json({ error: 'Failed to export to PDF' })
  }
}
