// Main game socket.io implementation
document.addEventListener('DOMContentLoaded', () => {
    // Get game data from the page
    const gameId = document.getElementById('game-data').dataset.gameId;
    const isHost = document.getElementById('game-data').dataset.isHost === 'true';
    const username = document.getElementById('game-data').dataset.username || '';
    
    // Initialize socket connection
    const socket = io();
    
    // Common elements
    const waitingScreen = document.getElementById('waiting-screen');
    const questionContainer = document.getElementById('question-container');
    
    // Connect to the appropriate game room
    if (isHost) {
      // HOST LOGIC
      console.log('Connected as host for game:', gameId);
      
      const playerList = document.getElementById('players');
      const playerCount = document.getElementById('player-count');
      const startBtn = document.getElementById('start-btn');
      const nextQuestionBtn = document.getElementById('next-question-btn');
      const questionDisplay = document.getElementById('question-display');
      const questionText = document.getElementById('question-text');
      const options = document.querySelectorAll('.option');
      const timerElement = document.getElementById('timer');
      const timerText = document.getElementById('timer-text');
      const answeredCount = document.getElementById('answered-count');
      const leaderboard = document.getElementById('leaderboard');
      const scoresList = document.getElementById('scores-list');
      
      let currentQuestionIndex = 0;
      let timerInterval;
      let players = [];
      
      // Create game room
      socket.emit('create-game', { gameId });
      
      // Handle player joins
      socket.on('player-joined', function(data) {
        players = data.players || [];
        
        // Update player list
        playerList.innerHTML = '';
        players.forEach(playerName => {
          const li = document.createElement('li');
          li.textContent = playerName;
          playerList.appendChild(li);
        });
        
        // Update player count
        playerCount.textContent = players.length;
        
        // Enable start button if there's at least one player
        if (startBtn) {
          startBtn.disabled = players.length === 0;
        }
      });
      
      // Handle player answers
      socket.on('player-answered', function(data) {
        const answeredPlayers = data.answeredCount;
        const totalPlayers = data.totalPlayers;
        
        answeredCount.textContent = answeredPlayers;
        playerCount.textContent = totalPlayers;
        
        // If all players answered, show results after a short delay
        if (answeredPlayers === totalPlayers) {
          setTimeout(() => {
            socket.emit('show-question-results', { gameId });
          }, 1000);
        }
      });
      
      // Handle question results
      socket.on('question-results', function(data) {
        questionDisplay.style.display = 'none';
        leaderboard.style.display = 'block';
        
        // Update leaderboard
        scoresList.innerHTML = '';
        data.scores.forEach(player => {
          const li = document.createElement('li');
          li.textContent = `${player.username}: ${player.score} points`;
          scoresList.appendChild(li);
        });
        
        // Change button text for next action
        if (data.isLastQuestion) {
          nextQuestionBtn.textContent = 'End Game';
        } else {
          nextQuestionBtn.textContent = 'Next Question';
        }
        
        nextQuestionBtn.style.display = 'block';
      });
      
      // Handle game over
      socket.on('game-over', function(data) {
        questionDisplay.style.display = 'none';
        leaderboard.style.display = 'block';
        
        // Update final leaderboard
        scoresList.innerHTML = '';
        data.scores.forEach(player => {
          const li = document.createElement('li');
          li.textContent = `${player.username}: ${player.score} points`;
          scoresList.appendChild(li);
        });
        
        nextQuestionBtn.style.display = 'none';
      });
      
      // Start game button click
      if (startBtn) {
        startBtn.addEventListener('click', function(e) {
          e.preventDefault();
          socket.emit('start-game', { gameId });
          
          // Redirect to game play page
          window.location.href = `/game/play/${gameId}`;
        });
      }
      
      // Next question button click
      if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', function() {
          socket.emit('next-question', { gameId });
          leaderboard.style.display = 'none';
          questionDisplay.style.display = 'block';
          nextQuestionBtn.style.display = 'none';
        });
      }
      
      // Receive new question
      socket.on('new-question', function(data) {
        leaderboard.style.display = 'none';
        questionDisplay.style.display = 'block';
        
        questionText.textContent = data.question;
        
        // Set options
        options.forEach((option, index) => {
          option.textContent = data.options[index];
        });
        
        // Handle timer
        let timeLeft = data.timeLimit;
        timerText.textContent = timeLeft;
        timerElement.style.width = '100%';
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          timeLeft--;
          timerText.textContent = timeLeft;
          timerElement.style.width = (timeLeft / data.timeLimit * 100) + '%';
          
          if (timeLeft <= 0) {
            clearInterval(timerInterval);
            socket.emit('question-time-up', { gameId });
          }
        }, 1000);
        
        // Reset answered count
        answeredCount.textContent = '0';
      });
      
    } else {
      // PLAYER LOGIC
      console.log('Connected as player for game:', gameId);
      
      const waitingScreen = document.getElementById('waiting-screen');
      const questionContainer = document.getElementById('question-container');
      const questionText = document.getElementById('question-text');
      const optionsGrid = document.getElementById('options-grid');
      const options = document.querySelectorAll('.option');
      const timerElement = document.getElementById('timer');
      const timerText = document.getElementById('timer-text');
      const answerResult = document.getElementById('answer-result');
      const resultIcon = document.getElementById('result-icon');
      const resultText = document.getElementById('result-text');
      const pointsText = document.getElementById('points-text');
      const gameOver = document.getElementById('game-over');
      const finalScore = document.getElementById('final-score');
      const finalRank = document.getElementById('final-rank');
      
      let hasAnswered = false;
      let startTime;
      let timerInterval;
      
      // Join the game as player
      socket.emit('join-game', {
        gameId: gameId,
        username: username
      });
      
      // Handle game join response
      socket.on('game-joined', function(data) {
        if (!data.success) {
          alert(data.message || 'Failed to join the game');
          window.location.href = '/game/join';
        }
      });
      
      // Handle game start
      socket.on('game-started', function() {
        if (window.location.pathname.includes('/lobby/')) {
          window.location.href = `/game/play/${gameId}`;
        }
      });
      
      // Receive new question from server
      socket.on('new-question', function(data) {
        waitingScreen.style.display = 'none';
        questionContainer.style.display = 'block';
        answerResult.style.display = 'none';
        
        hasAnswered = false;
        questionText.textContent = data.question;
        
        // Enable all options
        options.forEach((option, index) => {
          option.textContent = data.options[index];
          option.disabled = false;
          option.classList.remove('selected');
        });
        
        // Start timer
        let timeLeft = data.timeLimit;
        timerText.textContent = timeLeft;
        timerElement.style.width = '100%';
        startTime = Date.now();
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          timeLeft--;
          timerText.textContent = timeLeft;
          timerElement.style.width = (timeLeft / data.timeLimit * 100) + '%';
          
          if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            if (!hasAnswered) {
              disableOptions();
              // Time's up, no answer submitted
              socket.emit('submit-answer', {
                gameId: gameId,
                answer: -1, // No answer
                time: data.timeLimit * 1000
              });
            }
          }
        }, 1000);
      });
      
      // Handle option click
      if (optionsGrid) {
        optionsGrid.addEventListener('click', function(e) {
          if (e.target.classList.contains('option') && !hasAnswered) {
            const selectedOption = parseInt(e.target.dataset.option);
            const timeElapsed = Date.now() - startTime;
            
            // Mark as answered
            hasAnswered = true;
            e.target.classList.add('selected');
            
            // Disable all options
            disableOptions();
            
            // Send answer to server
            socket.emit('submit-answer', {
              gameId: gameId,
              answer: selectedOption,
              time: timeElapsed
            });
          }
        });
      }
      
      // Function to disable options
      function disableOptions() {
        options.forEach(option => {
          option.disabled = true;
        });
      }
      
      // Receive answer result
      socket.on('answer-result', function(data) {
        questionContainer.style.display = 'none';
        answerResult.style.display = 'block';
        
        if (data.correct) {
          resultIcon.innerHTML = '✅';
          resultText.textContent = 'Correct!';
          pointsText.textContent = `+${data.points} points`;
        } else {
          resultIcon.innerHTML = '❌';
          resultText.textContent = 'Wrong!';
          pointsText.textContent = '0 points';
        }
      });
      
      // Game over
      socket.on('game-over', function(data) {
        waitingScreen.style.display = 'none';
        questionContainer.style.display = 'none';
        answerResult.style.display = 'none';
        gameOver.style.display = 'block';
        
        // Find player's score and rank
        const playerData = data.scores.find(p => p.username === username);
        const rank = data.scores.findIndex(p => p.username === username) + 1;
        
        if (playerData) {
          finalScore.textContent = `Your score: ${playerData.score} points`;
          finalRank.textContent = `Your rank: ${rank} of ${data.scores.length}`;
        }
      });
      
      // Handle host disconnect
      socket.on('host-disconnected', function() {
        alert('The host has left the game.');
        window.location.href = '/game/join';
      });
    }
  });