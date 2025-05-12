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
  console.log('A user connected:', socket.id);

  // Host creates a game
  socket.on('create-game', async ({ gameId }) => {
    try {
      const game = await Game.findById(gameId).populate('quiz');
      if (!game) return;
      
      games[gameId] = {
        host: socket.id,
        players: {},
        active: false,
        pin: game.pin
      };
      
      socket.join(gameId);
      console.log(`Host created game: ${gameId} with PIN: ${game.pin}`);
    } catch (error) {
      console.error('Error creating game:', error);
    }
  });

  // Player joins a game
  socket.on('join-game', async ({ gameId, username }) => {
    try {
      const game = await Game.findById(gameId);
      if (!game) return;
      
      // Initialize game state if not exists
      if (!games[gameId]) {
        games[gameId] = {
          players: {},
          active: false,
          pin: game.pin
        };
      }
      
      // Add player to game
      games[gameId].players[socket.id] = {
        username,
        score: 0
      };
      
      socket.join(gameId);
      
      // Notify host of new player
      io.to(gameId).emit('player-joined', {
        players: Object.values(games[gameId].players).map(p => p.username)
      });
      
      console.log(`Player ${username} joined game: ${gameId}`);
    } catch (error) {
      console.error('Error joining game:', error);
    }
  });

  // Host starts the game
  socket.on('start-game', async ({ gameId }) => {
    try {
      const gameState = games[gameId];
      if (!gameState || gameState.host !== socket.id) return;
      
      const game = await Game.findById(gameId);
      if (!game) return;
      
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
  socket.on('submit-answer', async ({ gameId, answer, time }) => {
    if (games[gameId] && games[gameId].players[socket.id]) {
      const game = games[gameId];
      const player = game.players[socket.id];
      
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
    console.log('User disconnected:', socket.id);
    
    // Find and handle player/host disconnection for all games
    Object.entries(games).forEach(([gameId, game]) => {
      // If host disconnects
      if (game.host === socket.id) {
        io.to(gameId).emit('host-disconnected');
        delete games[gameId];
        console.log(`Host left game: ${gameId}`);
      }
      // If player disconnects
      else if (game.players[socket.id]) {
        const username = game.players[socket.id].username;
        delete game.players[socket.id];
        
        // Notify remaining players
        io.to(gameId).emit('player-joined', {
          players: Object.values(game.players).map(p => p.username)
        });
        
        console.log(`Player ${username} left game: ${gameId}`);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});