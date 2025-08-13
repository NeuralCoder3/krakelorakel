import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { gameRouter } from './routes/game';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const DEBUG = process.env.DEBUG === 'true';

// Game state management
interface Player {
  id: string;
  name: string;
  submitted: boolean;
  joined: boolean;
  originalWord?: string;
  rotation?: number;
  drawing?: string;
  assignedBoard?: string; // Track which board this player has
}

// Game state interface
interface GameState {
  allSubmitted: boolean;
  gameResults?: {
    drawings: Array<{
      playerId: string;
      playerName: string;
      drawing: string;
      rotation: number;
      originalWord?: string;
    }>;
    allWords: string[];
    additionalWords?: string[];
  };
  votingPhase?: {
    currentPlayerIndex: number;
    votedWords: Set<string>;
    playerVotes: Map<string, string>;
    isComplete: boolean;
  };
}

// Room interface
interface Room {
  id: string; // room code
  players: Map<string, Player>;
  gameState: GameState;
  createdAt: Date;
}

// Global state: rooms instead of single game state
const rooms = new Map<string, Room>();

// Helper function to get or create a room
function getOrCreateRoom(roomCode: string): Room {
  if (!rooms.has(roomCode)) {
    console.log(`Creating new room: ${roomCode}`);
    rooms.set(roomCode, {
      id: roomCode,
      players: new Map(),
      gameState: {
        allSubmitted: false
      },
      createdAt: new Date()
    });
  }
  return rooms.get(roomCode)!;
}

// Track used words to avoid duplicates
const usedWords = new Set<string>();

// Helper function to get random words
function getRandomWords(count: number): string[] {
  const allWords = [
    'cat', 'dog', 'house', 'tree', 'car', 'flower', 'bird', 'fish', 'sun', 'moon',
    'mountain', 'river', 'ocean', 'forest', 'beach', 'stars', 'clouds', 'rain', 'snow',
    'grass', 'rocks', 'cave', 'volcano', 'island', 'desert', 'lake', 'waterfall', 'bridge',
    'dragon', 'unicorn', 'wizard', 'witch', 'fairy', 'castle', 'knight', 'princess',
    'king', 'queen', 'magic wand', 'crystal ball', 'flying carpet', 'treasure chest'
  ];
  
  // Filter out already used words
  const availableWords = allWords.filter(word => !usedWords.has(word));
  
  if (availableWords.length < count) {
    // If we run out of words, reset the used words set
    usedWords.clear();
    console.log('Warning: Reset used words set - all words available again');
  }
  
  const shuffled = availableWords.sort(() => Math.random() - 0.5);
  const selectedWords = shuffled.slice(0, count);
  
  // Mark selected words as used
  selectedWords.forEach(word => usedWords.add(word));
  
  return selectedWords;
}

// Helper function to get available board files
function getAvailableBoards(): string[] {
  try {
    const boardsDir = path.join(__dirname, '../boards');
    if (!fs.existsSync(boardsDir)) {
      console.log('Boards directory not found, using default board');
      return ['board1.jpg']; // Fallback to default board
    }
    
    const files = fs.readdirSync(boardsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
    });
    
    if (imageFiles.length === 0) {
      console.log('No board images found, using default board');
      return ['board1.jpg']; // Fallback to default board
    }
    
    return imageFiles;
  } catch (error) {
    console.error('Error reading boards directory:', error);
    return ['board1.jpg']; // Fallback to default board
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Handle player joining with name
  socket.on('setPlayerName', (data: { name: string; roomCode: string }) => {
    const room = getOrCreateRoom(data.roomCode);
    
    // Create and add player to the room
    const player: Player = {
      id: socket.id,
      name: data.name,
      submitted: false,
      joined: true
    };
    
    // Add player to the room
    room.players.set(socket.id, player);
    
    // Join the socket to the room for broadcasting
    socket.join(data.roomCode);
    
    // Assign a random word and board to this player when they join
    const newWords = getRandomWords(1);
    const availableBoards = getAvailableBoards();
    const boardIndex = Math.floor(Math.random() * availableBoards.length);
    
    player.originalWord = newWords[0];
    player.assignedBoard = availableBoards[boardIndex];
    
    console.log(`Player joined room ${data.roomCode}: ${data.name} (${socket.id}) with word: ${player.originalWord} and board: ${player.assignedBoard}`);
    
    // Send the assigned word and board to this player
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    socket.emit('wordAssigned', { 
      word: player.originalWord,
      board: `${backendUrl}/boards/${player.assignedBoard}`
    });
    
    // Broadcast updated player count (only joined players) to this room
    const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
    socket.to(data.roomCode).emit('playerCount', joinedPlayers.length);
    socket.to(data.roomCode).emit('playerList', joinedPlayers);
    
    // Also emit to the joining player
    socket.emit('playerCount', joinedPlayers.length);
    socket.emit('playerList', joinedPlayers);
  });
  
  // Handle player submission
  socket.on('submitDrawing', (data: { drawing: string; rotation: number; roomCode: string }) => {
    const room = getOrCreateRoom(data.roomCode);
    const player = room.players.get(socket.id);
    
    if (player && player.joined) {
      player.submitted = true;
      player.drawing = data.drawing;
      player.rotation = data.rotation; // Store rotation data
      // player.originalWord is already tracked by server
      
      console.log(`Player ${player.name} submitted drawing with rotation: ${data.rotation}° in room ${data.roomCode}`);
      
      // Check if all joined players submitted
      const roomJoinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
      const allSubmitted = roomJoinedPlayers.every(p => p.submitted);
      room.gameState.allSubmitted = allSubmitted;
      
      if (allSubmitted) {
        // Generate game results
        const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
        
        const drawings = joinedPlayers
          .filter(p => p.drawing)
          .map(p => ({ 
            playerId: p.id, 
            playerName: p.name,
            drawing: p.drawing!, 
            rotation: p.rotation || 0, // Include rotation data
            ...(DEBUG && { originalWord: p.originalWord }) // Only include detailed field if DEBUG is active
          }));
        
        // Get additional words for voting (avoid duplicates with player words)
        const additionalWords = getRandomWords(joinedPlayers.length);
        
        // Always include original words in allWords array (for display)
        const originalWords = joinedPlayers.map(p => p.originalWord || '').filter(w => w) as string[];
        const allWords = [...originalWords, ...additionalWords].sort();
        
        console.log(`Game completed in room ${data.roomCode}! Player words: [${originalWords.join(', ')}], Additional words: [${additionalWords.join(', ')}]`);
        
        room.gameState.gameResults = {
          drawings,
          allWords,
          ...(DEBUG && {additionalWords: additionalWords})
        };
        
        // Send results to all players in this room
        io.to(data.roomCode).emit('gameResults', room.gameState.gameResults);
        
        // Initialize voting phase
        room.gameState.votingPhase = {
          currentPlayerIndex: 0,
          votedWords: new Set(),
          playerVotes: new Map(),
          isComplete: false
        };
        
        // Start voting phase
        const votingData = {
          currentPlayerId: joinedPlayers[0].id,
          currentPlayerName: joinedPlayers[0].name,
          totalPlayers: joinedPlayers.length,
          allWords: room.gameState.gameResults.allWords
        };
        console.log('Starting voting phase with data:', votingData);
        console.log('allWords array:', room.gameState.gameResults.allWords);
        io.to(data.roomCode).emit('votingStarted', votingData);
      }
      
      // Broadcast updated submission status to this room
      const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
      io.to(data.roomCode).emit('playerList', joinedPlayers);
      io.to(data.roomCode).emit('allSubmitted', allSubmitted);
    }
  });
  
  // Handle player voting
  socket.on('voteWord', (data: { word: string; roomCode: string }) => {
    const room = getOrCreateRoom(data.roomCode);
    if (!room.gameState.votingPhase || room.gameState.votingPhase.isComplete) return;
    
    const player = room.players.get(socket.id);
    if (!player || !player.joined) return;
    
    const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
    const currentPlayer = joinedPlayers[room.gameState.votingPhase.currentPlayerIndex];
    
    // Check if it's this player's turn
    if (currentPlayer.id !== socket.id) {
      console.log(`Player ${player.name} tried to vote out of turn in room ${data.roomCode}`);
      return;
    }
    
    // Record the vote
    room.gameState.votingPhase.playerVotes.set(socket.id, data.word);
    room.gameState.votingPhase.votedWords.add(data.word);
    
    console.log(`Player ${player.name} voted out: ${data.word} in room ${data.roomCode}`);
    
    // Broadcast the vote to all players in this room
    io.to(data.roomCode).emit('wordVotedOut', {
      word: data.word,
      playerName: player.name,
      votedWords: Array.from(room.gameState.votingPhase.votedWords)
    });
    
    // Move to next player
    room.gameState.votingPhase.currentPlayerIndex++;
    
    if (room.gameState.votingPhase.currentPlayerIndex >= joinedPlayers.length) {
      // Voting phase complete
      room.gameState.votingPhase.isComplete = true;
      
      // Calculate score - count remaining player words vs total players
      const playerWords = joinedPlayers.map(p => p.originalWord || '').filter(w => w);
      const remainingPlayerWords = playerWords.filter(word => 
        !room.gameState.votingPhase!.votedWords.has(word)
      );
      const correctWords = remainingPlayerWords.length;
      const totalPlayers = joinedPlayers.length;
      const score = `${correctWords}/${totalPlayers}`;
      
      // Categorize remaining words for display
      const remainingWords = room.gameState.gameResults!.allWords.filter(word => 
        !room.gameState.votingPhase!.votedWords.has(word)
      );
      const remainingPlayerWordsForDisplay = remainingWords.filter(word => 
        playerWords.includes(word)
      );
      const remainingAdditionalWordsForDisplay = remainingWords.filter(word => 
        !playerWords.includes(word)
      );
      
      console.log(`Voting complete in room ${data.roomCode}! Score: ${score} (${correctWords} player words remaining out of ${totalPlayers} players)`);
      
      // Send final results to this room
      io.to(data.roomCode).emit('votingComplete', {
        score,
        correctWords,
        totalPlayers,
        remainingWords,
        remainingPlayerWords: remainingPlayerWordsForDisplay,
        remainingAdditionalWords: remainingAdditionalWordsForDisplay,
        votedWords: Array.from(room.gameState.votingPhase.votedWords),
        votedPlayerWords: Array.from(room.gameState.votingPhase.votedWords).filter(word => 
          playerWords.includes(word)
        ),
        votedAdditionalWords: Array.from(room.gameState.votingPhase.votedWords).filter(word => 
          !playerWords.includes(word)
        ),
        playerVotes: Object.fromEntries(room.gameState.votingPhase.playerVotes)
      });
    } else {
      // Next player's turn
      const nextPlayer = joinedPlayers[room.gameState.votingPhase.currentPlayerIndex];
      io.to(data.roomCode).emit('nextPlayerTurn', {
        currentPlayerId: nextPlayer.id,
        currentPlayerName: nextPlayer.name,
        playerIndex: room.gameState.votingPhase.currentPlayerIndex + 1,
        totalPlayers: joinedPlayers.length
      });
    }
  });
  
  // Handle new round request
  socket.on('newRound', (data: { roomCode: string }) => {
    const room = getOrCreateRoom(data.roomCode);
    const player = room.players.get(socket.id);
    if (!player || !player.joined) return;
    
    console.log(`Player ${player.name} requested a new round in room ${data.roomCode}`);
    
    // Reset game state for new round
    room.gameState.allSubmitted = false;
    room.gameState.gameResults = undefined;
    room.gameState.votingPhase = undefined;
    
    // Reset all players for new round and assign new words and boards
    const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
    const newWords = getRandomWords(joinedPlayers.length);
    
    // Debug: Log current board state before cycling
    console.log('=== BOARD CYCLING DEBUG ===');
    console.log('Current board assignments before cycling:');
    joinedPlayers.forEach((p, index) => {
      console.log(`  Player ${index}: ${p.name} has board: ${p.assignedBoard}`);
    });
    
    // First, collect all current board assignments to avoid reference issues
    const currentBoards = joinedPlayers.map(p => p.assignedBoard);
    console.log('Collected boards array:', currentBoards);
    
    // Cycle boards: each player gets the board that the next player had
    // Player 0 gets Player 1's board, Player 1 gets Player 2's board, etc.
    // Last player gets Player 0's board (wraps around)
    joinedPlayers.forEach((p, index) => {
      p.submitted = false;
      p.drawing = undefined;
      p.originalWord = newWords[index]; // Assign new word
      
      // Get the board from the next player (with wraparound) using the collected boards
      const nextPlayerIndex = (index + 1) % joinedPlayers.length;
      const nextPlayerBoard = currentBoards[nextPlayerIndex];
      p.assignedBoard = nextPlayerBoard;
      
      console.log(`Player ${p.name} gets word: ${newWords[index]}, board: ${nextPlayerBoard} (was from player ${joinedPlayers[nextPlayerIndex].name})`);
    });
    
    // Debug: Log final board state after cycling
    console.log('Final board assignments after cycling:');
    joinedPlayers.forEach((p, index) => {
      console.log(`  Player ${index}: ${p.name} now has board: ${p.assignedBoard}`);
    });
    console.log('=== END BOARD CYCLING DEBUG ===');
    
    console.log(`New round started with words: [${newWords.join(', ')}] and board rotation in room ${data.roomCode}`);
    
    // Broadcast new round started
    io.to(data.roomCode).emit('newRoundStarted');
    
    // Send individual word and board assignments to each player
    joinedPlayers.forEach((player, index) => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('newWord', {
          word: newWords[index]
        });
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        playerSocket.emit('newBoard', {
          board: `${backendUrl}/boards/${player.assignedBoard}`
        });
      }
    });
    
    // Broadcast updated status
    io.to(data.roomCode).emit('playerList', joinedPlayers);
    io.to(data.roomCode).emit('allSubmitted', false);
  });
  
  // Handle player unsubmission
  socket.on('unsubmitDrawing', (data: { roomCode: string }) => {
    const room = getOrCreateRoom(data.roomCode);
    const player = room.players.get(socket.id);
    if (player && player.joined) {
      player.submitted = false;
      delete player.drawing;
      room.gameState.allSubmitted = false;
      
      // Broadcast updated submission status
      const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
      io.to(data.roomCode).emit('playerList', joinedPlayers);
      io.to(data.roomCode).emit('allSubmitted', false);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Find and remove player from all rooms
    for (const [roomCode, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        console.log(`Player removed from room ${roomCode}`);
        
        // Check if room should continue
        const joinedPlayers = Array.from(room.players.values()).filter(p => p.joined);
        if (joinedPlayers.length === 0) {
          // Room is empty, remove it
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} removed (no players left)`);
        } else {
          // Check if all remaining joined players submitted
          const allSubmitted = joinedPlayers.every(p => p.submitted);
          room.gameState.allSubmitted = allSubmitted;
          
          // Broadcast updated player count and status to this room
          io.to(roomCode).emit('playerCount', joinedPlayers.length);
          io.to(roomCode).emit('playerList', joinedPlayers);
          io.to(roomCode).emit('allSubmitted', room.gameState.allSubmitted);
        }
        break; // Player can only be in one room
      }
    }
  });
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'board-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (board images)
app.use('/boards', express.static(path.join(__dirname, '../boards')));

// Health check endpoint
app.get('/health', (req, res) => {
  const totalPlayers = Array.from(rooms.values()).reduce((total, room) => {
    return total + Array.from(room.players.values()).filter(p => p.joined).length;
  }, 0);
  
  const totalSockets = Array.from(rooms.values()).reduce((total, room) => {
    return total + room.players.size;
  }, 0);
  
  res.status(200).json({
    status: 'OK',
    message: 'KrakelOrakel backend is running',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    totalSockets: totalSockets,
    joinedPlayers: totalPlayers
  });
});

// API routes
app.use('/api/game', gameRouter);

// Image upload endpoint
app.post('/api/upload-board', upload.single('boardImage'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    return res.status(200).json({
      message: 'Board image uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      error: 'Failed to upload image'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Basic error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Image file must be less than 10MB'
      });
    }
  }
  
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong'
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🧙‍♂️ KrakelOrakel backend running on port ${PORT}`);
  console.log(`�� Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Boards directory: ${path.join(__dirname, '../boards')}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔌 WebSocket server ready`);
});

export default app;
