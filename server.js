// server.js
const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kahoot-clone')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io for real-time game functionality
const games = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Host creates a game
  socket.on('create-game', ({ gameId, quiz }) => {
    games[gameId] = {
      host: socket.id,
      players: {},
      quiz: quiz,
      active: false,
      currentQuestion: 0,
      scores: {}
    };
    socket.join(gameId);
    console.log(`Game created: ${gameId}`);
  });

  // Player joins a game
  socket.on('join-game', ({ gameId, username }) => {
    if (games[gameId]) {
      games[gameId].players[socket.id] = {
        username,
        score: 0
      };
      socket.join(gameId);
      socket.emit('game-joined', { success: true });
      io.to(games[gameId].host).emit('player-joined', { 
        players: Object.values(games[gameId].players).map(p => p.username)
      });
      console.log(`${username} joined game: ${gameId}`);
    } else {
      socket.emit('game-joined', { success: false, message: 'Game not found' });
    }
  });

  // Host starts the game
  socket.on('start-game', ({ gameId }) => {
    if (games[gameId] && games[gameId].host === socket.id) {
      games[gameId].active = true;
      io.to(gameId).emit('game-started');
      console.log(`Game started: ${gameId}`);
    }
  });

  // Host sends a question
  socket.on('next-question', ({ gameId }) => {
    if (games[gameId] && games[gameId].host === socket.id) {
      const game = games[gameId];
      const questionIndex = game.currentQuestion;
      
      if (questionIndex < game.quiz.questions.length) {
        const question = game.quiz.questions[questionIndex];
        // Send question without the correct answer
        io.to(gameId).emit('new-question', {
          question: question.question,
          options: question.options,
          timeLimit: question.timeLimit,
          questionIndex
        });
        
        game.currentQuestion++;
        console.log(`Sent question ${questionIndex + 1} to game: ${gameId}`);
      } else {
        // End of quiz
        io.to(gameId).emit('game-over', {
          scores: Object.values(game.players).map(p => ({
            username: p.username,
            score: p.score
          })).sort((a, b) => b.score - a.score)
        });
        console.log(`Game over: ${gameId}`);
      }
    }
  });

  // Player answers a question
  socket.on('submit-answer', ({ gameId, answer, time }) => {
    if (games[gameId] && games[gameId].players[socket.id]) {
      const game = games[gameId];
      const currentQuestion = game.quiz.questions[game.currentQuestion - 1];
      const player = game.players[socket.id];
      
      let points = 0;
      if (answer === currentQuestion.correctAnswer) {
        // Calculate points based on time (faster = more points)
        points = Math.max(1000 - Math.floor(time / 10), 500);
        player.score += points;
      }
      
      socket.emit('answer-result', {
        correct: answer === currentQuestion.correctAnswer,
        points
      });
      
      io.to(game.host).emit('player-answered', {
        username: player.username
      });
      
      console.log(`${player.username} answered question in game: ${gameId}`);
    }
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from games they were in
    for (const gameId in games) {
      const game = games[gameId];
      
      // If host disconnects, end the game
      if (game.host === socket.id) {
        io.to(gameId).emit('host-disconnected');
        delete games[gameId];
        console.log(`Game ${gameId} ended because host disconnected`);
      } 
      // If player disconnects, remove them from the game
      else if (game.players[socket.id]) {
        const username = game.players[socket.id].username;
        delete game.players[socket.id];
        io.to(game.host).emit('player-left', { username });
        console.log(`${username} left game: ${gameId}`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});