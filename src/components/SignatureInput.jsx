import { useRef, useEffect, useState } from 'react'

export default function SignatureInput({ name, onChange, required }) {
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [signatureMode, setSignatureMode] = useState('draw') // 'draw' or 'upload'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      const canvas = canvasRef.current
      const dataURL = canvas.toDataURL('image/png')
      
      if (dataURL !== 'data:,') {
        setHasSignature(true)
        // Create a file from the canvas data
        canvas.toBlob((blob) => {
          const file = new File([blob], 'signature.png', { type: 'image/png' })
          onChange({ target: { name, files: [file] } })
        }, 'image/png')
      }
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onChange({ target: { name, files: [] } })
    
    // Clear file input if it exists
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file is too large. Please select a file smaller than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Calculate scaling to fit image in canvas while maintaining aspect ratio
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        const x = (canvas.width - scaledWidth) / 2
        const y = (canvas.height - scaledHeight) / 2
        
        // Draw image on canvas
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
        
        setHasSignature(true)
        onChange({ target: { name, files: [file] } })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const switchMode = (mode) => {
    setSignatureMode(mode)
    clearSignature()
  }

  // Touch events for mobile
  const handleTouchStart = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    startDrawing(mouseEvent)
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    draw(mouseEvent)
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    stopDrawing()
  }

  return (
    <div className="signature-container">
      {/* Mode Selection */}
      <div className="signature-mode-selector">
        <button
          type="button"
          className={`signature-mode-btn ${signatureMode === 'draw' ? 'active' : ''}`}
          onClick={() => switchMode('draw')}
        >
          ✏️ Draw Signature
        </button>
        <button
          type="button"
          className={`signature-mode-btn ${signatureMode === 'upload' ? 'active' : ''}`}
          onClick={() => switchMode('upload')}
        >
          📷 Upload Image
        </button>
      </div>

      {/* Canvas Area */}
      <div className="signature-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="signature-canvas"
          onMouseDown={signatureMode === 'draw' ? startDrawing : undefined}
          onMouseMove={signatureMode === 'draw' ? draw : undefined}
          onMouseUp={signatureMode === 'draw' ? stopDrawing : undefined}
          onMouseLeave={signatureMode === 'draw' ? stopDrawing : undefined}
          onTouchStart={signatureMode === 'draw' ? handleTouchStart : undefined}
          onTouchMove={signatureMode === 'draw' ? handleTouchMove : undefined}
          onTouchEnd={signatureMode === 'draw' ? handleTouchEnd : undefined}
        />
        {!hasSignature && (
          <div className="signature-placeholder">
            {signatureMode === 'draw' 
              ? 'Draw your signature here' 
              : 'Upload an image of your signature'
            }
          </div>
        )}
      </div>

      {/* File Upload (hidden) */}
      {signatureMode === 'upload' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      )}

      {/* Controls */}
      <div className="signature-controls">
        {signatureMode === 'upload' && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="signature-upload-btn"
          >
            📁 Choose Image
          </button>
        )}
        <button
          type="button"
          onClick={clearSignature}
          className="signature-clear-btn"
          disabled={!hasSignature}
        >
          Clear
        </button>
        {hasSignature && (
          <span className="signature-status">✓ Signature captured</span>
        )}
      </div>
    </div>
  )
}
