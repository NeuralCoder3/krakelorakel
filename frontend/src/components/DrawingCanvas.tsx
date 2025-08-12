import React, { useRef, useEffect, useState, useCallback } from 'react'

interface DrawingCanvasProps { }

const DEBUG = false;

const DrawingCanvas: React.FC<DrawingCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundImageRef = useRef<HTMLImageElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(5)
  const [brushColor, setBrushColor] = useState('#000000')
  const [isEraser, setIsEraser] = useState(false)
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)
  const [minDist, setMinDist] = useState(3)
  const [distances, setDistances] = useState<number[][]>([])
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentWord, setCurrentWord] = useState('')
  const [wordCategory, setWordCategory] = useState('')

  // Sample words for different categories
  const wordLists = {
    animals: ['cat', 'dog', 'elephant', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'rabbit', 'squirrel', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck'],
    objects: ['car', 'house', 'tree', 'flower', 'book', 'phone', 'computer', 'chair', 'table', 'bed', 'lamp', 'clock', 'cup', 'plate', 'fork', 'knife', 'spoon', 'bottle', 'bag', 'shoes'],
    nature: ['mountain', 'river', 'ocean', 'forest', 'beach', 'sun', 'moon', 'stars', 'clouds', 'rain', 'snow', 'grass', 'rocks', 'cave', 'volcano', 'island', 'desert', 'lake', 'waterfall', 'bridge'],
    food: ['apple', 'banana', 'orange', 'pizza', 'hamburger', 'hotdog', 'ice cream', 'cake', 'bread', 'cheese', 'milk', 'eggs', 'rice', 'pasta', 'soup', 'salad', 'steak', 'chicken', 'fish', 'vegetables'],
    fantasy: ['dragon', 'unicorn', 'wizard', 'witch', 'fairy', 'castle', 'knight', 'princess', 'king', 'queen', 'magic wand', 'crystal ball', 'flying carpet', 'treasure chest', 'monster', 'ghost', 'vampire', 'werewolf', 'mermaid', 'phoenix']
  }

  // Get a random word from a random category
  const getRandomWord = useCallback(() => {
    const categories = Object.keys(wordLists)
    const randomCategory = categories[Math.floor(Math.random() * categories.length)]
    const words = wordLists[randomCategory as keyof typeof wordLists]
    const randomWord = words[Math.floor(Math.random() * words.length)]
    
    setCurrentWord(randomWord)
    setWordCategory(randomCategory)
  }, [])

  // Initialize with a random word
  useEffect(() => {
    getRandomWord()
  }, [getRandomWord])

  // Load background image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      backgroundImageRef.current = img
      setImageLoaded(true)
    }
    img.src = '/board1.jpg'
  }, [])

  // Initialize canvas and compute distances
  useEffect(() => {
    if (!imageLoaded || !backgroundImageRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const img = backgroundImageRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match image
    canvas.width = img.width
    canvas.height = img.height

    // Draw background image
    ctx.drawImage(img, 0, 0)

    // Compute distances using dynamic programming
    const computedDistances = computeDistances(img)
    setDistances(computedDistances)

    // Set canvas style for drawing
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [imageLoaded])

  // Dynamic programming distance computation (2-pass algorithm)
  const computeDistances = useCallback((img: HTMLImageElement): number[][] => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return []

    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data
    const width = img.width
    const height = img.height

    // Initialize distance array with infinity
    const dist: number[][] = Array(height).fill(null).map(() => Array(width).fill(Infinity))

    // First pass: top-down, left-right
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Check if pixel is non-white (using threshold)
        const isNonWhite = r < 250 || g < 250 || b < 250

        if (isNonWhite) {
          dist[y][x] = 0
        } else {
          // Check neighbors from top and left
          let minDist = Infinity
          if (y > 0) minDist = Math.min(minDist, dist[y - 1][x] + 1)
          if (x > 0) minDist = Math.min(minDist, dist[y][x - 1] + 1)
          if (y > 0 && x > 0) minDist = Math.min(minDist, dist[y - 1][x - 1] + 1.414)
          if (y > 0 && x < width - 1) minDist = Math.min(minDist, dist[y - 1][x + 1] + 1.414)

          dist[y][x] = Math.min(dist[y][x], minDist)
        }
      }
    }

    // Second pass: bottom-up, right-left
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        // Check neighbors from bottom and right
        let minDist = dist[y][x]
        if (y < height - 1) minDist = Math.min(minDist, dist[y + 1][x] + 1)
        if (x < width - 1) minDist = Math.min(minDist, dist[y][x + 1] + 1)
        if (y < height - 1 && x < width - 1) minDist = Math.min(minDist, dist[y + 1][x + 1] + 1.414)
        if (y < height - 1 && x > 0) minDist = Math.min(minDist, dist[y + 1][x - 1] + 1.414)

        dist[y][x] = minDist
      }
    }

    return dist
  }, [])

  // Check if a point is within drawing distance
  const isWithinDrawingDistance = useCallback((x: number, y: number): boolean => {
    if (distances.length === 0 || y < 0 || y >= distances.length || x < 0 || x >= distances[0].length) {
      return false
    }
    return distances[y][x] <= minDist
  }, [distances, minDist])



  // Find valid line segments and draw only those parts
  const findAndDrawValidSegments = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    if (distances.length === 0) return false

    const canvas = canvasRef.current
    if (!canvas) return false

    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    // Use Bresenham's line algorithm to find valid segments
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy

    let x = x1
    let y = y1
    let lastValidX = -1
    let lastValidY = -1
    let hasValidSegment = false

    // First pass: find all valid segments
    const segments: { start: { x: number, y: number }, end: { x: number, y: number } }[] = []
    let segmentStart: { x: number, y: number } | null = null

    while (true) {
      const isValid = isWithinDrawingDistance(x, y)

      if (isValid && segmentStart === null) {
        // Start of a valid segment
        segmentStart = { x, y }
      } else if (!isValid && segmentStart !== null) {
        // End of a valid segment
        segments.push({
          start: segmentStart,
          end: { x: lastValidX, y: lastValidY }
        })
        segmentStart = null
      }

      if (isValid) {
        lastValidX = x
        lastValidY = y
        hasValidSegment = true
      }

      if (x === x2 && y === y2) {
        // End of line - close any open segment
        if (segmentStart !== null) {
          segments.push({
            start: segmentStart,
            end: { x, y }
          })
        }
        break
      }

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }

    // Draw all valid segments
    if (hasValidSegment) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (isEraser) {
        // For eraser, restore original background image pixels
        segments.forEach(segment => {
          // Create a temporary canvas to extract the background image portion
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')
          if (!tempCtx || !backgroundImageRef.current) return

          // Calculate the bounding box of the eraser stroke
          const minX = Math.min(segment.start.x, segment.end.x) - brushSize
          const maxX = Math.max(segment.start.x, segment.end.x) + brushSize
          const minY = Math.min(segment.start.y, segment.end.y) - brushSize
          const maxY = Math.max(segment.start.y, segment.end.y) + brushSize

          // Set temp canvas size to cover the eraser area
          const width = maxX - minX
          const height = maxY - minY
          tempCanvas.width = width
          tempCanvas.height = height

          // Draw the background image portion
          tempCtx.drawImage(
            backgroundImageRef.current,
            minX, minY, width, height,
            0, 0, width, height
          )

          // Clear the main canvas in the eraser area
          ctx.save()
          ctx.globalCompositeOperation = 'destination-out'
          ctx.beginPath()
          ctx.arc(segment.start.x, segment.start.y, brushSize, 0, 2 * Math.PI)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(segment.end.x, segment.end.y, brushSize, 0, 2 * Math.PI)
          ctx.fill()
          ctx.restore()

          // Restore the background image in the cleared area
          ctx.drawImage(tempCanvas, minX, minY)
        })
      } else {
        // Normal drawing
        ctx.strokeStyle = brushColor
        ctx.lineWidth = brushSize

        segments.forEach(segment => {
          ctx.beginPath()
          ctx.moveTo(segment.start.x, segment.start.y)
          ctx.lineTo(segment.end.x, segment.end.y)
          ctx.stroke()
        })
      }

      return true
    }

    return false
  }, [distances, minDist, isWithinDrawingDistance, isEraser, brushSize, brushColor])

  // Drawing functions with distance restriction
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(e.clientX - rect.left)
    const y = Math.floor(e.clientY - rect.top)

    // Always allow starting to draw, even from invalid areas
    setIsDrawing(true)
    setLastX(x)
    setLastY(y)
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(e.clientX - rect.left)
    const y = Math.floor(e.clientY - rect.top)

    // Find and draw only valid segments
    const drawn = findAndDrawValidSegments(lastX, lastY, x, y)

    if (drawn) {
      setLastX(x)
      setLastY(y)
    }
  }, [isDrawing, lastX, lastY, findAndDrawValidSegments])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !backgroundImageRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Redraw background image
    ctx.drawImage(backgroundImageRef.current, 0, 0)
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

  if (!imageLoaded) {
    return (
      <div className="drawing-canvas-container">
        <div className="loading-message">
          <p>🔄 Loading background image...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="drawing-canvas-container">
      {/* Word Display Section */}
      <div className="word-display">
        <div className="word-info">
          <div className="word-category">
            <span className="category-icon">
              {wordCategory === 'animals' && '🐾'}
              {wordCategory === 'objects' && '🔧'}
              {wordCategory === 'nature' && '🌿'}
              {wordCategory === 'food' && '🍕'}
              {wordCategory === 'fantasy' && '✨'}
            </span>
            <span className="category-text">{wordCategory}</span>
          </div>
          <div className="current-word">
            <h3>Draw this:</h3>
            <div className="word-text">{currentWord}</div>
          </div>
        </div>
        <button 
          className="new-word-button"
          onClick={getRandomWord}
          title="Get a new word to draw"
        >
          🎲 New Word
        </button>
      </div>

      <div className="canvas-toolbar">
        {DEBUG && (
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
        )}

        {DEBUG && (
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
        )}

        {DEBUG && (
          <div className="tool-group">
            <label htmlFor="min-dist">Min Distance:</label>
            <input
              id="min-dist"
              type="range"
              min="1"
              max="50"
              value={minDist}
              onChange={(e) => setMinDist(Number(e.target.value))}
              className="min-dist-slider"
            />
            <span className="min-dist-value">{minDist}px</span>
          </div>
        )}

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

      {DEBUG && (
        <div className="color-palette">
          {presetColors.map((color) => (
            <button
              key={color}
              className="color-swatch"
              style={{ backgroundColor: color }}
              onClick={() => setBrushColor(color)}
              title={color}
            />
          ))}
        </div>
      )}

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
        <p>🎨 Draw only within {minDist}px of the board lines! The canvas restricts drawing to valid areas.</p>
        <p>💡 Tip: Adjust the Min Distance slider to control where you can draw on the board.</p>
      </div>
    </div>
  )
}

export default DrawingCanvas
