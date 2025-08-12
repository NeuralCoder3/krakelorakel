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
  drawing?: string; // base64 encoded drawing
  joined: boolean; // whether player has actually joined the game
  originalWord?: string; // the word they were supposed to draw (tracked by server)
  rotation?: number; // rotation data for the drawing
}

interface GameState {
  players: Map<string, Player>;
  allSubmitted: boolean;
  gameResults?: {
    drawings: { playerId: string; drawing: string; originalWord?: string }[];
    allWords: string[]; // original words + additional words
    additionalWords?: string[]; // just the extra words for voting
  };
  votingPhase?: {
    currentPlayerIndex: number;
    votedWords: Set<string>;
    playerVotes: Map<string, string>; // playerId -> votedWord
    isComplete: boolean;
  };
}

const gameState: GameState = {
  players: new Map(),
  allSubmitted: false
};

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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Add socket to game but don't count as player yet
  const player: Player = {
    id: socket.id,
    name: '',
    submitted: false,
    joined: false
  };
  gameState.players.set(socket.id, player);
  
  // Handle player joining with name
  socket.on('setPlayerName', (data: { name: string }) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.name = data.name;
      player.joined = true;
      
      // Note: We don't assign a word here - the frontend gets it from /api/game/word
      // We'll store the word when the player submits their drawing
      console.log(`Player joined: ${data.name} (${socket.id})`);
      
      // Broadcast updated player count (only joined players)
      const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
      io.emit('playerCount', joinedPlayers.length);
      io.emit('playerList', joinedPlayers);
    }
  });
  
  // Handle player submission
  socket.on('submitDrawing', (data: { drawing: string; rotation: number }) => {
    const player = gameState.players.get(socket.id);
    if (player && player.joined) {
      player.submitted = true;
      player.drawing = data.drawing;
      player.rotation = data.rotation; // Store rotation data
      // player.originalWord is already set by the server when player joins
      
      console.log(`Player ${player.name} submitted drawing with rotation: ${data.rotation}°`);
      
      // Check if all joined players submitted
      const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
      const allSubmitted = joinedPlayers.every(p => p.submitted);
      gameState.allSubmitted = allSubmitted;
      
      if (allSubmitted) {
        // Generate game results
        const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
        
        const drawings = joinedPlayers
          .filter(p => p.drawing)
          .map(p => ({ 
            playerId: p.id, 
            drawing: p.drawing!, 
            rotation: p.rotation || 0, // Include rotation data
            ...(DEBUG && { originalWord: p.originalWord }) // Only include detailed field if DEBUG is active
          }));
        
        // Get additional words for voting (avoid duplicates with player words)
        const additionalWords = getRandomWords(joinedPlayers.length);
        
        // Always include original words in allWords array (for display)
        const originalWords = joinedPlayers.map(p => p.originalWord || '').filter(w => w) as string[];
        const allWords = [...originalWords, ...additionalWords].sort();
        
        console.log(`Game completed! Player words: [${originalWords.join(', ')}], Additional words: [${additionalWords.join(', ')}]`);
        
        gameState.gameResults = {
          drawings,
          allWords,
          ...(DEBUG && {additionalWords: additionalWords})
        };
        
        // Send results to all players
        io.emit('gameResults', gameState.gameResults);
        
        // Initialize voting phase
        gameState.votingPhase = {
          currentPlayerIndex: 0,
          votedWords: new Set(),
          playerVotes: new Map(),
          isComplete: false
        };
        
        // Start voting phase
        io.emit('votingStarted', {
          currentPlayerId: joinedPlayers[0].id,
          currentPlayerName: joinedPlayers[0].name,
          totalPlayers: joinedPlayers.length,
          allWords: gameState.gameResults.allWords
        });
      }
      
      // Broadcast updated submission status
      io.emit('playerList', joinedPlayers);
      io.emit('allSubmitted', allSubmitted);
    }
  });
  
  // Handle player voting
  socket.on('voteWord', (data: { word: string }) => {
    if (!gameState.votingPhase || gameState.votingPhase.isComplete) return;
    
    const player = gameState.players.get(socket.id);
    if (!player || !player.joined) return;
    
    const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
    const currentPlayer = joinedPlayers[gameState.votingPhase.currentPlayerIndex];
    
    // Check if it's this player's turn
    if (currentPlayer.id !== socket.id) {
      console.log(`Player ${player.name} tried to vote out of turn`);
      return;
    }
    
    // Record the vote
    gameState.votingPhase.playerVotes.set(socket.id, data.word);
    gameState.votingPhase.votedWords.add(data.word);
    
    console.log(`Player ${player.name} voted out: ${data.word}`);
    
    // Broadcast the vote to all players
    io.emit('wordVotedOut', {
      word: data.word,
      playerName: player.name,
      votedWords: Array.from(gameState.votingPhase.votedWords)
    });
    
    // Move to next player
    gameState.votingPhase.currentPlayerIndex++;
    
    if (gameState.votingPhase.currentPlayerIndex >= joinedPlayers.length) {
      // Voting phase complete
      gameState.votingPhase.isComplete = true;
      
      // Calculate score - count remaining player words vs total players
      const playerWords = joinedPlayers.map(p => p.originalWord || '').filter(w => w);
      const remainingPlayerWords = playerWords.filter(word => 
        !gameState.votingPhase!.votedWords.has(word)
      );
      const correctWords = remainingPlayerWords.length;
      const totalPlayers = joinedPlayers.length;
      const score = `${correctWords}/${totalPlayers}`;
      
      // Categorize remaining words for display
      const remainingWords = gameState.gameResults!.allWords.filter(word => 
        !gameState.votingPhase!.votedWords.has(word)
      );
      const remainingPlayerWordsForDisplay = remainingWords.filter(word => 
        playerWords.includes(word)
      );
      const remainingAdditionalWordsForDisplay = remainingWords.filter(word => 
        !playerWords.includes(word)
      );
      
      console.log(`Voting complete! Score: ${score} (${correctWords} player words remaining out of ${totalPlayers} players)`);
      
      // Send final results
      io.emit('votingComplete', {
        score,
        correctWords,
        totalPlayers,
        remainingWords,
        remainingPlayerWords: remainingPlayerWordsForDisplay,
        remainingAdditionalWords: remainingAdditionalWordsForDisplay,
        votedWords: Array.from(gameState.votingPhase.votedWords),
        votedPlayerWords: Array.from(gameState.votingPhase.votedWords).filter(word => 
          playerWords.includes(word)
        ),
        votedAdditionalWords: Array.from(gameState.votingPhase.votedWords).filter(word => 
          !playerWords.includes(word)
        ),
        playerVotes: Object.fromEntries(gameState.votingPhase.playerVotes)
      });
    } else {
      // Next player's turn
      const nextPlayer = joinedPlayers[gameState.votingPhase.currentPlayerIndex];
      io.emit('nextPlayerTurn', {
        currentPlayerId: nextPlayer.id,
        currentPlayerName: nextPlayer.name,
        playerIndex: gameState.votingPhase.currentPlayerIndex + 1,
        totalPlayers: joinedPlayers.length
      });
    }
  });
  
  // Handle new round request
  socket.on('newRound', () => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.joined) return;
    
    console.log(`Player ${player.name} requested a new round`);
    
    // Reset game state for new round
    gameState.allSubmitted = false;
    gameState.gameResults = undefined;
    gameState.votingPhase = undefined;
    
    // Reset all players for new round and assign new words
    const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
    const newWords = getRandomWords(joinedPlayers.length);
    
    joinedPlayers.forEach((p, index) => {
      p.submitted = false;
      p.drawing = undefined;
      p.originalWord = newWords[index]; // Assign new word
    });
    
    console.log(`New round started with words: [${newWords.join(', ')}]`);
    
    // Broadcast new round started
    io.emit('newRoundStarted');
    
    // Send individual word assignments to each player
    joinedPlayers.forEach((player, index) => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('newWord', {
          word: newWords[index]
        });
      }
    });
    
    // Broadcast updated status
    io.emit('playerList', joinedPlayers);
    io.emit('allSubmitted', false);
  });
  
  // Handle player unsubmission
  socket.on('unsubmitDrawing', () => {
    const player = gameState.players.get(socket.id);
    if (player && player.joined) {
      player.submitted = false;
      delete player.drawing;
      gameState.allSubmitted = false;
      
      // Broadcast updated submission status
      const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
      io.emit('playerList', joinedPlayers);
      io.emit('allSubmitted', false);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    gameState.players.delete(socket.id);
    
    // Check if game should continue
    const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
    if (joinedPlayers.length === 0) {
      // Reset game state when no joined players
      gameState.allSubmitted = false;
      gameState.gameResults = undefined;
    } else {
      // Check if all remaining joined players submitted
      const allSubmitted = joinedPlayers.every(p => p.submitted);
      gameState.allSubmitted = allSubmitted;
    }
    
    // Broadcast updated player count and status (only joined players)
    io.emit('playerCount', joinedPlayers.length);
    io.emit('playerList', joinedPlayers);
    io.emit('allSubmitted', gameState.allSubmitted);
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
  const joinedPlayers = Array.from(gameState.players.values()).filter(p => p.joined);
  res.status(200).json({
    status: 'OK',
    message: 'KrakelOrakel backend is running',
    timestamp: new Date().toISOString(),
    connectedSockets: gameState.players.size,
    joinedPlayers: joinedPlayers.length
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
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Boards directory: ${path.join(__dirname, '../boards')}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔌 WebSocket server ready`);
});

export default app;
