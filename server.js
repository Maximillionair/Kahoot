// server.js
const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Game = require('./models/game');  // Add Game model import
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

connectDB()


// Updated Socket.io implementation for server.js

// Socket.io for real-time game functionality
const games = {};

io.on('connection', (socket) => {
  console.log('\n--- Socket Connection ---');
  console.log('New connection:', socket.id);
  console.log('Current games state:', Object.keys(games).map(gameId => ({
    gameId,
    host: games[gameId].host,
    playerCount: Object.keys(games[gameId].players).length,
    players: Object.values(games[gameId].players).map(p => p.username)
  })));

  // Host creates a game
  socket.on('create-game', async ({ gameId }) => {
    try {
      console.log('\n--- Create Game ---');
      console.log('Game ID:', gameId);
      console.log('Socket ID:', socket.id);
      
      const game = await Game.findById(gameId).populate('quiz');
      if (!game) {
        console.log('Error: Game not found');
        return;
      }
      
      games[gameId] = {
        host: socket.id,
        players: {},
        active: false,
        pin: game.pin,
        currentQuestion: 0,
        answeredCount: 0
      };
      
      socket.join(gameId);
      console.log(`Host created game: ${gameId} with PIN: ${game.pin}`);
      console.log('Current game state:', games[gameId]);
    } catch (error) {
      console.error('Error creating game:', error);
    }
  });

  // Player joins a game
  socket.on('join-game', async ({ gameId, username, playerId }) => {
    try {
      console.log('\n--- Player Join ---');
      console.log('Game ID:', gameId);
      console.log('Username:', username);
      console.log('Socket ID:', socket.id);
      console.log('Player ID:', playerId);
      
      const game = await Game.findById(gameId);
      if (!game) {
        console.log('Error: Game not found');
        return;
      }
      
      // Initialize game state if not exists
      if (!games[gameId]) {
        console.log('Initializing new game state');
        games[gameId] = {
          players: {},
          active: false,
          pin: game.pin,
          currentQuestion: 0,
          answeredCount: 0
        };
      }
      
      // Add or update player by playerId
      games[gameId].players[playerId] = games[gameId].players[playerId] || {
        username,
        score: 0,
        answers: [],
      };
      games[gameId].players[playerId].socketId = socket.id;
      games[gameId].players[playerId].username = username; // update username in case it changed
      
      socket.join(gameId);
      
      // Notify host of new player
      io.to(gameId).emit('player-joined', {
        players: Object.values(games[gameId].players).map(p => p.username)
      });
      
      console.log(`Player ${username} joined game: ${gameId}`);
      console.log('Current game state:', games[gameId]);
    } catch (error) {
      console.error('Error joining game:', error);
    }
  });

  // Host starts the game
  socket.on('start-game', async ({ gameId }) => {
    try {
      console.log('\n--- Start Game ---');
      console.log('Game ID:', gameId);
      console.log('Socket ID:', socket.id);
      
      const gameState = games[gameId];
      if (!gameState) {
        console.log('Error: Game state not found');
        return;
      }
      if (gameState.host !== socket.id) {
        console.log('Error: Not the host of this game');
        return;
      }
      
      const game = await Game.findById(gameId).populate('quiz');
      if (!game) {
        console.log('Error: Game not found in database');
        return;
      }
      
      console.log('Current players before start:', Object.values(gameState.players).map(p => p.username));
      
      // Initialize game state for play
      gameState.active = true;
      gameState.currentQuestion = 0;
      gameState.answeredCount = 0;
      
      // Update database
      game.active = true;
      game.startTime = new Date();
      await game.save();
      
      // Store current players before redirect
      const currentPlayers = Object.values(gameState.players).map(p => p.username);
      
      // Notify all players that game has started
      io.to(gameId).emit('game-started', { players: currentPlayers });
      console.log(`Game started: ${gameId} with ${currentPlayers.length} players`);
      console.log('Players in game:', currentPlayers);
      console.log('Final game state:', gameState);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  });

  // Host sends next question
  socket.on('next-question', async ({ gameId }) => {
    if (games[gameId] && games[gameId].host === socket.id) {
      const game = games[gameId];
      
      try {
        // Fetch quiz from database
        const gameData = await Game.findById(gameId).populate('quiz');
        
        // Debug logging
        console.log('--- next-question DEBUG ---');
        console.log('game.currentQuestion:', game.currentQuestion);
        console.log('Number of questions:', gameData.quiz && gameData.quiz.questions ? gameData.quiz.questions.length : 'NO QUIZ OR QUESTIONS');
        console.log('Questions array:', gameData.quiz && gameData.quiz.questions ? gameData.quiz.questions : 'NO QUIZ OR QUESTIONS');
        
        if (!gameData || !gameData.quiz || !gameData.quiz.questions) {
          socket.emit('error', { message: 'Quiz data not found' });
          return;
        }
        
        const questionIndex = game.currentQuestion;
        
        if (questionIndex < gameData.quiz.questions.length) {
          const question = gameData.quiz.questions[questionIndex];
          
          // Reset answered count for this question
          game.answeredCount = 0;
          
          // Send question without the correct answer
          io.to(gameId).emit('new-question', {
            question: question.question,
            options: question.options,
            timeLimit: question.timeLimit || 20,
            questionIndex
          });
          
          game.currentQuestion++;
          console.log(`Sent question ${questionIndex + 1} to game: ${gameId}`);
        } else {
          // End of quiz
          const finalScores = Object.values(game.players).map(p => ({
            username: p.username,
            score: p.score
          })).sort((a, b) => b.score - a.score);
          
          io.to(gameId).emit('game-over', { scores: finalScores });
          console.log(`Game over: ${gameId}`);
          
          // Save results to database if needed
        }
      } catch (error) {
        console.error('Error sending question:', error);
        socket.emit('error', { message: 'Failed to load question' });
      }
    }
  });

  // Player answers a question
  socket.on('submit-answer', async ({ gameId, answer, time, playerId }) => {
    if (games[gameId] && games[gameId].players[playerId]) {
      const game = games[gameId];
      const player = game.players[playerId];
      
      try {
        // Get quiz data from database
        const gameData = await Game.findById(gameId).populate('quiz');
        const currentQuestionIndex = game.currentQuestion - 1;
        const currentQuestion = gameData.quiz.questions[currentQuestionIndex];
        
        let points = 0;
        let isCorrect = false;
        
        if (answer === currentQuestion.correctAnswer) {
          // Calculate points based on time (faster = more points)
          points = Math.max(1000 - Math.floor(time / 10), 500);
          player.score += points;
          isCorrect = true;
        }
        
        // Store player's answer
        player.answers.push({
          questionIndex: currentQuestionIndex,
          answer: answer,
          correct: isCorrect,
          time: time
        });
        
        // Send result to player
        socket.emit('answer-result', {
          correct: isCorrect,
          points
        });
        
        // Increment answered count
        game.answeredCount++;
        
        // Inform host about player's answer
        io.to(game.host).emit('player-answered', {
          username: player.username,
          answeredCount: game.answeredCount,
          totalPlayers: Object.keys(game.players).length
        });
        
        console.log(`${player.username} answered question in game: ${gameId}`);
      } catch (error) {
        console.error('Error processing answer:', error);
      }
    }
  });

  // Question time is up
  socket.on('question-time-up', ({ gameId }) => {
    if (games[gameId] && games[gameId].host === socket.id) {
      // Process any unanswered players
      socket.emit('show-question-results', { gameId });
    }
  });

  // Show question results
  socket.on('show-question-results', ({ gameId }) => {
    if (games[gameId] && games[gameId].host === socket.id) {
      const game = games[gameId];
      
      // Send scores to all players
      const scores = Object.values(game.players).map(p => ({
        username: p.username,
        score: p.score
      })).sort((a, b) => b.score - a.score);
      
      io.to(gameId).emit('question-results', { 
        scores,
        isLastQuestion: game.currentQuestion >= game.quiz.questions.length
      });
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('\n--- Socket Disconnect ---');
    console.log('Disconnected socket:', socket.id);
    
    // Find and handle player/host disconnection for all games
    Object.entries(games).forEach(([gameId, game]) => {
      // If host disconnects
      if (game.host === socket.id) {
        console.log(`Host left game: ${gameId}`);
        io.to(gameId).emit('host-disconnected');
        delete games[gameId];
      }
      // If player disconnects
      else {
        // Find player(s) with this socket.id
        const playerIds = Object.keys(game.players).filter(pid => game.players[pid].socketId === socket.id);
        playerIds.forEach(pid => {
          const username = game.players[pid].username;
          console.log(`Player ${username} (playerId: ${pid}) left game: ${gameId}`);
          delete game.players[pid];
        });
        if (playerIds.length > 0) {
          // Notify remaining players
          io.to(gameId).emit('player-joined', {
            players: Object.values(game.players).map(p => p.username)
          });
          console.log('Remaining players:', Object.values(game.players).map(p => p.username));
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});