const Quiz = require('../models/quiz');
const Game = require('../models/game');
const { isAuthenticated } = require('./quizcontroller');

// Display game hosting page
exports.getHostGame = async (req, res) => {
  try {
    console.log('\n--- Host Game Debug ---');
    console.log('Quiz ID:', req.params.quizId);
    console.log('Session User:', req.session.user);

    // Check if user is logged in
    if (!req.session.user) {
      console.log('Error: User not logged in');
      req.flash('error_msg', 'Please log in to host a game');
      return res.redirect('/auth/login');
    }

    // Find quiz
    const quiz = await Quiz.findById(req.params.quizId);
    console.log('Found Quiz:', {
      id: quiz?._id,
      title: quiz?.title,
      questionCount: quiz?.questions?.length
    });
    
    if (!quiz) {
      console.log('Error: Quiz not found');
      req.flash('error_msg', `Quiz not found (ID: ${req.params.quizId})`);
      return res.redirect('/quiz');
    }

    // Check if user owns the quiz
    if (!quiz.creator.equals(req.session.user.id)) {
      console.log('Error: Unauthorized quiz access');
      req.flash('error_msg', 'You can only host games with your own quizzes');
      return res.redirect('/quiz');
    }
    
    // Create a new game
    const game = new Game({
      quiz: quiz._id,
      host: req.session.user.id
    });
    
    await game.save();
    console.log('Game Created:', {
      id: game._id,
      pin: game.pin,
      quizId: game.quiz
    });
    
    res.render('game/host', { 
      title: 'Host Game', 
      game, 
      quiz,
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  } catch (error) {
    console.error('Host Game Error:', {
      message: error.message,
      stack: error.stack,
      quizId: req.params.quizId
    });
    req.flash('error_msg', `Error setting up game: ${error.message}`);
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
    console.log('\n--- Join Game Debug ---');
    const { pin, username } = req.body;
    console.log('Join Request:', { pin, username });
    
    // Find active game by PIN
    const game = await Game.findOne({ pin }).populate('quiz');
    console.log('Found Game:', {
      id: game?._id,
      pin: game?.pin,
      hasQuiz: !!game?.quiz,
      quizId: game?.quiz?._id,
      active: game?.active,
      hostId: game?.host
    });
    
    if (!game) {
      console.log('Error: Game not found with PIN:', pin);
      req.flash('error_msg', `Game not found with PIN: ${pin}`);
      return res.redirect('/game/join');
    }

    // Check if the user is the host
    if (req.session.user && game.host.equals(req.session.user.id)) {
      console.log('Error: Host trying to join their own game');
      req.flash('error_msg', 'You cannot join your own game as a player');
      return res.redirect('/game/join');
    }

    if (!game.quiz) {
      console.log('Error: Quiz not found for game with PIN:', pin);
      req.flash('error_msg', `Internal error: Quiz not found for game (PIN: ${pin})`);
      return res.redirect('/game/join');
    }

    if (game.active) {
      console.log('Error: Game already started');
      req.flash('error_msg', 'This game has already started');
      return res.redirect('/game/join');
    }
    
    // Store temporary player info in session
    req.session.tempPlayer = {
      gameId: game._id,
      username
    };
    
    console.log('Player session created:', req.session.tempPlayer);
    res.redirect(`/game/lobby/${game._id}`);
  } catch (error) {
    console.error('Join Game Error:', {
      message: error.message,
      stack: error.stack,
      pin: req.body.pin
    });
    req.flash('error_msg', `Error joining game: ${error.message}. Please try again.`);
    res.redirect('/game/join');
  }
};

// Display game lobby
exports.getLobby = async (req, res) => {
  try {
    console.log('\n--- Game Lobby Debug ---');
    console.log('Game ID:', req.params.gameId);
    console.log('Session:', req.session);

    // Find game and populate quiz
    const game = await Game.findById(req.params.gameId).populate('quiz');
    console.log('Found Game:', {
      id: game?._id,
      pin: game?.pin,
      hasQuiz: !!game?.quiz,
      quizId: game?.quiz?._id
    });
    
    if (!game) {
      console.log('Error: Game not found');
      req.flash('error_msg', `Game not found (ID: ${req.params.gameId})`);
      return res.redirect('/game/join');
    }

    if (!game.quiz) {
      console.log('Error: Quiz not found in game');
      req.flash('error_msg', `Quiz not found for game (Game PIN: ${game.pin})`);
      return res.redirect('/game/join');
    }
    
    // Check if user is host or player
    const isHost = req.session.user && game.host.equals(req.session.user.id);
    const isPlayer = req.session.tempPlayer && String(req.session.tempPlayer.gameId) === String(game._id);
    
    console.log('Auth Check:', {
      isHost,
      isPlayer,
      sessionUser: req.session.user?.id,
      gameHost: game.host,
      tempPlayer: req.session.tempPlayer
    });
    
    // If neither host nor player, redirect to join
    if (!isHost && !isPlayer) {
      console.log('Error: Unauthorized access attempt');
      req.flash('error_msg', 'You are not authorized to view this lobby. Please join the game first.');
      return res.redirect('/game/join');
    }
    
    // If host, redirect to host view
    if (isHost) {
      console.log('Redirecting host to host view');
      return res.redirect(`/game/host/${game._id}`);
    }
    
    // Render lobby for player
    console.log('Rendering lobby for player');
    res.render('game/lobby', {
      title: 'Game Lobby',
      game,
      quiz: game.quiz,
      isHost: false, // Force this to false for player view
      player: req.session.tempPlayer,
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  } catch (error) {
    console.error('Lobby Error:', {
      message: error.message,
      stack: error.stack,
      gameId: req.params.gameId
    });
    req.flash('error_msg', `Error loading lobby: ${error.message}. Please try again.`);
    res.redirect('/game/join');
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