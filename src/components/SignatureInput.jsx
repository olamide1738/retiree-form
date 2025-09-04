import { useRef, useEffect, useState } from 'react'

export default function SignatureInput({ name, onChange, required }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

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
      <div className="signature-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="signature-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {!hasSignature && (
          <div className="signature-placeholder">
            Draw your signature here
          </div>
        )}
      </div>
      <div className="signature-controls">
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
