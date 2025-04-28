const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gamecontroller');

// Host game (requires authentication)
router.get('/host/:quizId', gameController.isAuthenticated, gameController.getHostGame);

// Join game (open to all)
router.get('/join', gameController.getJoinGame);
router.post('/join', gameController.postJoinGame);

// Lobby routes
router.get('/lobby/:gameId', gameController.getLobby);

// Start game (host only)
router.post('/start/:gameId', gameController.isAuthenticated, gameController.startGame);

// Play game
router.get('/play/:gameId', gameController.getPlayGame);

module.exports = router;