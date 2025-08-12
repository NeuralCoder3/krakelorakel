import React, { useRef, useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface DrawingCanvasProps {}

const DEBUG = false;

const DrawingCanvas: React.FC<DrawingCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
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
  const [boardImageUrl, setBoardImageUrl] = useState('')
  
  // Multiplayer state
  const [socket, setSocket] = useState<Socket | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [playerList, setPlayerList] = useState<any[]>([])
  const [allSubmitted, setAllSubmitted] = useState(false)
  const [gameResults, setGameResults] = useState<any>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [showPlayerDetails, setShowPlayerDetails] = useState(false)

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:5000')
    setSocket(newSocket)

    newSocket.on('playerCount', (count: number) => {
      setPlayerCount(count)
    })

    newSocket.on('playerList', (players: any[]) => {
      setPlayerList(players)
    })

    newSocket.on('allSubmitted', (submitted: boolean) => {
      setAllSubmitted(submitted)
    })

    newSocket.on('gameResults', (results: any) => {
      setGameResults(results)
    })

    return () => {
      newSocket.close()
    }
  }, [])

  // Reset game data when not connected
  useEffect(() => {
    if (!isConnected) {
      setCurrentWord('')
      setWordCategory('')
      setBoardImageUrl('')
      setImageLoaded(false)
      setDistances([])
    }
  }, [isConnected])

  // Load initial game data from server
  useEffect(() => {
    const loadGameData = async () => {
      try {
        console.log('Loading game data from server...')
        
        // Load word
        const wordResponse = await fetch('/api/game/word')
        console.log('Word response status:', wordResponse.status)
        if (wordResponse.ok) {
          const wordData = await wordResponse.json()
          console.log('Word data received:', wordData)
          setCurrentWord(wordData.word)
          setWordCategory(wordData.category)
        } else {
          console.error('Failed to get word from server:', wordResponse.status)
        }
        
        // Load board
        const boardResponse = await fetch('/api/game/board/random')
        console.log('Board response status:', boardResponse.status)
        if (boardResponse.ok) {
          const boardData = await boardResponse.json()
          console.log('Board data received:', boardData)
          setBoardImageUrl(boardData.url)
        } else {
          console.error('Failed to get board from server:', boardResponse.status)
        }
      } catch (error) {
        console.error('Error loading game data:', error)
      }
    }
    
    // Only load game data when connected
    if (isConnected) {
      loadGameData()
    }
  }, [isConnected])

  // Load background image
  useEffect(() => {
    if (!boardImageUrl) return // Don't load if no URL yet
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      backgroundImageRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      console.error('Failed to load background image:', boardImageUrl)
      setImageLoaded(false)
    }
    img.src = boardImageUrl
  }, [boardImageUrl])

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

  // Submit drawing function
  const submitDrawing = useCallback(() => {
    if (!socket || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const drawingData = canvas.toDataURL('image/png')
    
    socket.emit('submitDrawing', { 
      drawing: drawingData,
      originalWord: currentWord // Send the word they were supposed to draw
    })
    setIsSubmitted(true)
  }, [socket, currentWord])

  // Unsubmit drawing function
  const unsubmitDrawing = useCallback(() => {
    if (!socket) return
    
    socket.emit('unsubmitDrawing')
    setIsSubmitted(false)
  }, [socket])

  const presetColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#008000', '#ffc0cb', '#a52a2a', '#808080', '#000080'
  ]

  return (
    <div className="drawing-canvas-container">
      {/* Player Name Input */}
      {!isConnected && (
        <div className="player-name-input">
          <h3>🎮 Join the Game</h3>
          <div className="name-input-group">
            <input
              type="text"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="name-input"
              maxLength={20}
            />
            <button
              className="join-button"
              onClick={() => {
                if (playerName.trim()) {
                  setIsConnected(true)
                  if (socket) {
                    socket.emit('setPlayerName', { name: playerName.trim() })
                  }
                }
              }}
              disabled={!playerName.trim()}
            >
              🚀 Join Game
            </button>
          </div>
        </div>
      )}

      {/* Multiplayer Status - Only show when connected */}
      {isConnected && (
        <div className="multiplayer-status">
          <div className="player-counter">
            <span className="counter-icon">👥</span>
            <span className="counter-text">{playerCount} Players Connected</span>
          </div>
          <div className="submission-status">
            {allSubmitted ? (
              <div className="all-submitted">
                <span className="status-icon">🎉</span>
                <span className="status-text">All drawings submitted!</span>
              </div>
            ) : (
              <div 
                className="waiting-submissions clickable"
                onClick={() => setShowPlayerDetails(!showPlayerDetails)}
                title="Click to see player details"
              >
                <span className="status-icon">⏳</span>
                <span className="status-text">
                  {playerList.filter(p => p.submitted).length} of {playerCount} submitted
                </span>
              </div>
            )}
          </div>
          
          {/* Player Details Modal */}
          {showPlayerDetails && (
            <div className="player-details-modal">
              <div className="modal-header">
                <h4>Player Status</h4>
                <button 
                  className="close-button"
                  onClick={() => setShowPlayerDetails(false)}
                >
                  ✕
                </button>
              </div>
              <div className="player-list">
                {playerList.map((player) => (
                  <div key={player.id} className={`player-item ${player.submitted ? 'submitted' : 'not-submitted'}`}>
                    <span className="player-name">{player.name}</span>
                    <span className="player-status">
                      {player.submitted ? '✅ Submitted' : '⏳ Waiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Word Display Section - Show when connected */}
      {isConnected && (
        <div className="word-display">
          <div className="word-info">
            <div className="word-category">
              <span className="category-icon">
                {wordCategory === 'animals' && '🐾'}
                {wordCategory === 'objects' && '🔧'}
                {wordCategory === 'nature' && '🌿'}
                {wordCategory === 'food' && '🍕'}
                {wordCategory === 'fantasy' && '✨'}
                {wordCategory === 'general' && '🎯'}
              </span>
              <span className="category-text">{wordCategory}</span>
            </div>
            <div className="current-word">
              <h3>Draw this:</h3>
              <div className="word-text">{currentWord}</div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Toolbar - Show when connected */}
      {isConnected && (
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
      )}

      {/* Color Palette - Show when connected */}
      {isConnected && DEBUG && (
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

      {/* Canvas - Only show when connected */}
      {isConnected && (
        <div className="canvas-wrapper">
          {!imageLoaded ? (
            <div className="loading-message">
              <p>Loading background image...</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          )}
        </div>
      )}

      {/* Canvas Info - Show when connected */}
      {isConnected && (
        <div className="canvas-info">
          <p>🎨 Draw only within {minDist}px of the board lines! The canvas restricts drawing to valid areas.</p>
        </div>
      )}

      {/* Submission Controls - Only show when connected */}
      {isConnected && (
        <div className="submission-controls">
          {!isSubmitted ? (
            <button
              className="submit-button"
              onClick={submitDrawing}
              disabled={!imageLoaded}
              title="Submit your drawing"
            >
              ✅ Submit Drawing
            </button>
          ) : (
            <button
              className="unsubmit-button"
              onClick={unsubmitDrawing}
              disabled={allSubmitted}
              title="Unsubmit your drawing (until all players submit)"
            >
              🔄 Unsubmit Drawing
            </button>
          )}
        </div>
      )}

      {/* Game Results - Show regardless of connection status */}
      {gameResults && (
        <div className="game-results">
          <h3>🎯 Game Results</h3>
          <div className="results-content">
            <div className="drawings-section">
              <h4>All Drawings:</h4>
              <div className="drawings-grid">
                {gameResults.drawings.map((drawing: any, index: number) => (
                  <div key={index} className="drawing-item">
                    <img 
                      src={drawing.drawing} 
                      alt={`Drawing ${index + 1}`}
                      className="result-drawing"
                    />
                    <p className="drawing-label">Player {index + 1}</p>
                    {drawing.originalWord && <p className="original-word">Was supposed to draw: <strong>{drawing.originalWord}</strong></p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="words-section">
              <h4>All Words in the Game:</h4>
              <div className="words-list">
                {gameResults.allWords.map((word: string, index: number) => (
                  <span key={index} className="word-tag">
                    {word}
                  </span>
                ))}
              </div>
              <p className="words-note">
                <em>Includes original words each player was supposed to draw + additional words for voting</em>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DrawingCanvas
