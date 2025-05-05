document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const gameId = window.gameId;
    const quiz = window.quiz;
    const isHost = window.isHost === 'true';
    const username = window.username;
  
    // Now you can use gameId, quiz, isHost, username safely

    
     if (isHost) { 
      // Host Game Logic
      // [Host logic was already included in the previous artifact]
      
     } else { 
      // Player Game Logic
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
      
      // Join the game as player
      socket.emit('join-game', {
        gameId: gameId,
        username: ' player.username'
      });
      
      // Receive new question from server
      socket.on('new-question', function(data) {
        waitingScreen.style.display = 'none';
        questionContainer.style.display = 'block';
        answerResult.style.display = 'none';
        
        currentQuestion = data;
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
              showAnswer(false, 0);
            }
          }
        }, 1000);
      });
      
      // Handle option click
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
      
      // Function to show answer
      function showAnswer(correct, points) {
        questionContainer.style.display = 'none';
        answerResult.style.display = 'block';
        
        if (correct) {
          resultIcon.innerHTML = '✅';
          resultText.textContent = 'Correct!';
          pointsText.textContent = `+${points} points`;
        } else {
          resultIcon.innerHTML = '❌';
          resultText.textContent = 'Wrong!';
          pointsText.textContent = '0 points';
        }
      }
      
      // Game over
      socket.on('game-over', function(data) {
        waitingScreen.style.display = 'none';
        questionContainer.style.display = 'none';
        answerResult.style.display = 'none';
        gameOver.style.display = 'block';
        
        // Find player's score and rank
        const playerData = data.scores.find(p => p.username === ' player.username');
        const rank = data.scores.findIndex(p => p.username === ' player.username') + 1;
        
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
    
    // Connect to socket and create game room
    socket.emit('create-game', { 
      gameId: gameId,
      quiz: quiz
    });
    
    // Handle player joins
    socket.on('player-joined', function(data) {
      const players = data.players || [];
      
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
      startBtn.disabled = players.length === 0;
    });

  document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const gameId = 'game._id';
    
    if (isHost) {
      const playerList = document.getElementById('players');
      const playerCount = document.getElementById('player-count');
      const startBtn = document.getElementById('start-btn');
      const quizData = ' JSON.stringify(quiz)';
      
      // Host creates the game
      socket.emit('create-game', { 
        gameId: gameId,
        quiz: quiz
      });
      
      // Handle player joins
      socket.on('player-joined', function(data) {
        const players = data.players || [];
        
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
        startBtn.disabled = players.length === 0;
      });
     } else if (player) { 
      // Player joins the game
      socket.emit('join-game', {
        gameId: gameId,
        username: ' player.username'
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
        window.location.href = '/game/play/ game._id ';
      });
    } 
});