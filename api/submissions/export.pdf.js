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
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
      const createSection = (title, fields, startY, width, height) => {
        // Section header
        doc.rect(50, startY, width, 20)
          .fillColor('#B8860B')
          .fill()
        
        doc.fillColor('white')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(title, 55, startY + 5)
        
        // Section content
        doc.fillColor('black')
        doc.fontSize(8)
        doc.font('Helvetica')
        
        let currentY = startY + 25
        fields.forEach(field => {
          if (data[field.key] && currentY < startY + height - 10) {
            const label = field.label + ':'
            const value = String(data[field.key])
            
            // Truncate long values
            const maxValueLength = 25
            const truncatedValue = value.length > maxValueLength ? 
              value.substring(0, maxValueLength) + '...' : value
            
            doc.text(`${label}`, 55, currentY)
            doc.text(truncatedValue, 55 + 80, currentY)
            currentY += 12
          }
        })
        
        return currentY
      }

      // Two-column grid layout
      const leftColumnX = 50
      const rightColumnX = 297.5 // Half of 495 + 50
      const columnWidth = 222.5 // (495 - 50) / 2
      const sectionHeight = 120
      const startY = doc.y

      // Left Column
      let currentY = startY
      
      // Personal Information (Left)
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
        currentY = createSection('PERSONAL INFO', personalFields, currentY, columnWidth, sectionHeight)
        currentY += 10
      }

      // Employment Information (Left)
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
        currentY = createSection('EMPLOYMENT', employmentFields, currentY, columnWidth, sectionHeight)
        currentY += 10
      }

      // Right Column
      currentY = startY
      
      // Pension Information (Right)
      if (data.pensionNumber || data.bankName || data.accountNumber) {
        const pensionFields = [
          { key: 'pensionNumber', label: 'Pension No' },
          { key: 'bankName', label: 'Bank' },
          { key: 'accountNumber', label: 'Account No' },
          { key: 'pensionPaymentMode', label: 'Payment Mode' },
          { key: 'bvn', label: 'BVN' }
        ]
        currentY = createSection('PENSION INFO', pensionFields, currentY, columnWidth, sectionHeight)
        currentY += 10
      }

      // Next of Kin (Right)
      if (data.nextOfKinName || data.nextOfKinPhone) {
        const nextOfKinFields = [
          { key: 'nextOfKinName', label: 'Name' },
          { key: 'nextOfKinPhone', label: 'Phone' }
        ]
        currentY = createSection('NEXT OF KIN', nextOfKinFields, currentY, columnWidth, sectionHeight)
        currentY += 10
      }

      // Files Section with Images (Full Width)
      const submissionFiles = filesBySubmission[row.id] || []
      if (submissionFiles.length) {
        doc.moveDown(1)
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('ATTACHED DOCUMENTS & IMAGES', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        submissionFiles.forEach((f, fileIndex) => {
          const fileUrl = `${req.headers.host}/api/files/${f.id}`
          doc.text(`• ${f.field_name}: ${f.original_name}`, { indent: 20 })
          doc.fontSize(8)
            .fillColor('#1565c0')
            .text(`  Download: ${fileUrl}`, { indent: 20 })
          doc.fillColor('black')
          
          // Add image if it's a signature or photo
          if (f.field_name.includes('Signature') || f.field_name.includes('Photo')) {
            try {
              // Decode base64 image and add to PDF
              const base64Data = f.stored_path
              const imageBuffer = Buffer.from(base64Data, 'base64')
              
              // Add image with small size
              doc.image(imageBuffer, 60, doc.y + 5, { 
                width: 100, 
                height: 60,
                fit: [100, 60]
              })
              doc.moveDown(1)
            } catch (imgError) {
              console.log('Could not add image to PDF:', imgError.message)
              doc.text(`  [Image: ${f.original_name}]`, { indent: 20 })
            }
          }
        })
        doc.moveDown(0.5)
      }

      // Additional Information (Full Width)
      if (data.preferredCommunication || data.healthStatus || data.additionalComments) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('ADDITIONAL INFORMATION', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        if (data.preferredCommunication) {
          doc.text(`Preferred Communication: ${data.preferredCommunication}`, { indent: 20 })
        }
        if (data.healthStatus) {
          doc.text(`Health Status: ${data.healthStatus}`, { indent: 20 })
        }
        if (data.additionalComments) {
          doc.text(`Additional Comments: ${data.additionalComments}`, { indent: 20 })
        }
        doc.moveDown(0.5)
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
