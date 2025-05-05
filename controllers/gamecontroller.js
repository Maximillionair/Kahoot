const Quiz = require('../models/quiz');
const Game = require('../models/game');
const { isAuthenticated } = require('./quizcontroller');

// Display game hosting page
exports.getHostGame = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    
    if (!quiz) {
      req.flash('error_msg', 'Quiz not found');
      return res.redirect('/quiz');
    }
    
    // Create a new game
    const game = new Game({
      quiz: quiz._id,
      host: req.session.user.id
    });
    
    await game.save();
    
    res.render('game/host', { 
      title: 'Host Game', 
      game, 
      quiz
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error setting up game');
    res.redirect('/quiz');
  }
};

// Display join game page
exports.getJoinGame = (req, res) => {
  res.render('game/join', { title: 'Join Game' });
};

// Process game join request
exports.postJoinGame = async (req, res) => {
  try {
    const { pin, username } = req.body;
    
    const game = await Game.findOne({ pin, active: false });
    
    if (!game) {
      req.flash('error_msg', 'Game not found or already started');
      return res.redirect('/game/join');
    }
    
    // Store temporary player info in session
    req.session.tempPlayer = {
      gameId: game._id,
      username
    };
    
    res.redirect(`/game/lobby/${game._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error joining game');
    res.redirect('/game/join');
  }
};

// Display game lobby
exports.getLobby = async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);
    
    if (!game) {
      req.flash('error_msg', 'Game not found');
      return res.redirect('/game/join');
    }
    
    // Check if user is host or player
    const isHost = req.session.user && game.host.equals(req.session.user.id);
    const isPlayer = req.session.tempPlayer && String(req.session.tempPlayer.gameId) === String(game._id);
    
    
    if (!isHost && !isPlayer) {
      req.flash('error_msg', 'You are not authorized to view this lobby');
      return res.redirect('/');
    }
    
    const quiz = await Quiz.findById(game.quiz);
    
    res.render('game/lobby', {
      title: 'Game Lobby',
      game,
      quiz,
      isHost,
      player: isPlayer ? req.session.tempPlayer : null
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error loading lobby');
    res.redirect('/');
  }
};

// Start the game
exports.startGame = async (req, res) => {
  try {
    const game = await Game.findOne({
      _id: req.params.gameId,
      host: req.session.user.id
    });
    
    if (!game) {
      req.flash('error_msg', 'Game not found or you are not the host');
      return res.redirect('/quiz');
    }
    
    game.active = true;
    game.startTime = new Date();
    await game.save();
    
    res.redirect(`/game/play/${game._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error starting game');
    res.redirect('/quiz');
  }
};

// Game play screen
exports.getPlayGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId).populate('quiz');
    
    if (!game) {
      req.flash('error_msg', 'Game not found');
      return res.redirect('/');
    }
    
    // Check if user is host or player
    const isHost = req.session.user && game.host.equals(req.session.user.id);
    const isPlayer = req.session.tempPlayer && req.session.tempPlayer.gameId.equals(game._id);
    
    if (!isHost && !isPlayer) {
      req.flash('error_msg', 'You are not authorized to play this game');
      return res.redirect('/');
    }
    
    if (!game.active) {
      req.flash('error_msg', 'Game has not started yet');
      return res.redirect(`/game/lobby/${game._id}`);
    }
    
    res.render('game/play', {
      title: 'Play Game',
      game,
      isHost,
      player: isPlayer ? req.session.tempPlayer : null
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error loading game');
    res.redirect('/');
  }
};

exports.isAuthenticated = isAuthenticated;