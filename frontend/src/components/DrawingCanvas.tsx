import React, { useRef, useEffect, useState, useCallback } from 'react'

interface DrawingCanvasProps {}

const DrawingCanvas: React.FC<DrawingCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(5)
  const [brushColor, setBrushColor] = useState('#000000')
  const [isEraser, setIsEraser] = useState(false)
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        const rect = container.getBoundingClientRect()
        canvas.width = rect.width - 40 // Account for padding
        canvas.height = rect.height - 40
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Set initial canvas style
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Drawing functions
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setLastX(x)
    setLastY(y)
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(x, y)
    
    if (isEraser) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = brushSize * 2
    } else {
      ctx.strokeStyle = brushColor
      ctx.lineWidth = brushSize
    }
    
    ctx.stroke()

    setLastX(x)
    setLastY(y)
  }, [isDrawing, lastX, lastY, brushSize, brushColor, isEraser])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'krakelorakel-drawing.png'
    link.href = canvas.toDataURL()
    link.click()
  }, [])

  const presetColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#008000', '#ffc0cb', '#a52a2a', '#808080', '#000080'
  ]

  return (
    <div className="drawing-canvas-container">
      <div className="canvas-toolbar">
        <div className="tool-group">
          <label htmlFor="brush-size">Brush Size:</label>
          <input
            id="brush-size"
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="brush-size-slider"
          />
          <span className="brush-size-value">{brushSize}px</span>
        </div>

        <div className="tool-group">
          <label htmlFor="brush-color">Color:</label>
          <input
            id="brush-color"
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            className="color-picker"
          />
        </div>

        <div className="tool-group">
          <button
            className={`tool-button ${!isEraser ? 'active' : ''}`}
            onClick={() => setIsEraser(false)}
            title="Brush Tool"
          >
            🖌️
          </button>
          <button
            className={`tool-button ${isEraser ? 'active' : ''}`}
            onClick={() => setIsEraser(true)}
            title="Eraser Tool"
          >
            🧽
          </button>
        </div>

        <div className="tool-group">
          <button
            className="tool-button clear-button"
            onClick={clearCanvas}
            title="Clear Canvas"
          >
            🗑️
          </button>
          <button
            className="tool-button download-button"
            onClick={downloadCanvas}
            title="Download Drawing"
          >
            💾
          </button>
        </div>
      </div>

      {/* <div className="color-palette">
        {presetColors.map((color) => (
          <button
            key={color}
            className="color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => setBrushColor(color)}
            title={color}
          />
        ))}
      </div> */}

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>

      <div className="canvas-info">
        <p>🎨 Draw freely on the canvas! Use the tools above to customize your drawing experience.</p>
        <p>💡 Tip: Try different brush sizes and colors to create unique artwork!</p>
      </div>
    </div>
  )
}

export default DrawingCanvas
