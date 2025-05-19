document.addEventListener('DOMContentLoaded', () => {
    console.log('\n--- Game Client Initialized ---');
    const socket = io();
    
    // Get game data from the hidden div
    const gameData = document.getElementById('game-data');
    const gameId = gameData.dataset.gameId;
    const isHost = gameData.dataset.isHost === 'true';
    const username = gameData.dataset.username;
    
    // Persistent playerId using sessionStorage
    function getOrCreatePlayerId() {
        let playerId = sessionStorage.getItem('playerId');
        if (!playerId) {
            playerId = crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
            sessionStorage.setItem('playerId', playerId);
        }
        return playerId;
    }
    const playerId = getOrCreatePlayerId();
    
    console.log('Game Data:', { gameId, isHost, username, playerId });
    
    // Socket connection events
    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', () => console.log('Socket disconnected'));
    socket.on('connect_error', (error) => console.error('Socket connection error:', error));
    
    // --- HOST LOGIC ---
    if (isHost) {
        console.log('Initializing host view');
        const playerList = document.getElementById('players');
        const playerCount = document.getElementById('player-count');
        const startBtn = document.getElementById('start-btn');
        const nextQuestionBtn = document.getElementById('next-question-btn');
        const questionDisplay = document.getElementById('question-display');
        const hostOptionsGrid = document.getElementById('host-options-grid');
        const hostQuestionText = document.getElementById('question-text');
        const timerElement = document.getElementById('timer');
        const timerText = document.getElementById('timer-text');
        const answeredCount = document.getElementById('answered-count');
        const leaderboard = document.getElementById('leaderboard');
        const scoresList = document.getElementById('scores-list');

        let timerInterval;
        let currentQuestionIndex = 0;
        let totalQuestions = 0;
        let isLastQuestion = false;

        socket.emit('create-game', { gameId });

        socket.on('player-joined', function(data) {
            const players = data.players || [];
            if (playerList) {
                playerList.innerHTML = '';
                players.forEach(playerName => {
                    const li = document.createElement('li');
                    li.textContent = playerName;
                    playerList.appendChild(li);
                });
            }
            if (playerCount) playerCount.textContent = players.length;
            if (startBtn) startBtn.disabled = players.length === 0;
        });

        socket.on('player-left', function(data) {
            const players = data.players || [];
            if (playerList) {
                playerList.innerHTML = '';
                players.forEach(playerName => {
                    const li = document.createElement('li');
                    li.textContent = playerName;
                    playerList.appendChild(li);
                });
            }
            if (playerCount) playerCount.textContent = players.length;
            if (startBtn) startBtn.disabled = players.length === 0;
        });

        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                socket.emit('start-game', { gameId });
            });
        }

        socket.on('game-started', (data) => {
            if (playerList) {
                playerList.innerHTML = '';
                data.players.forEach(playerName => {
                    const li = document.createElement('li');
                    li.textContent = playerName;
                    playerList.appendChild(li);
                });
            }
            window.location.href = `/game/play/${gameId}`;
        });

        if (nextQuestionBtn) {
            nextQuestionBtn.addEventListener('click', () => {
                socket.emit('next-question', { gameId });
                nextQuestionBtn.disabled = true;
            });
        }

        // Show question to host
        socket.on('new-question', function(data) {
            smoothTransition(questionDisplay, 'block');
            if (leaderboard) leaderboard.style.display = 'none';
            if (hostQuestionText) hostQuestionText.textContent = data.question;
            if (hostOptionsGrid) {
                const optionDivs = hostOptionsGrid.querySelectorAll('.option');
                optionDivs.forEach((div, idx) => {
                    div.textContent = data.options[idx];
                    div.style.animation = 'fadeIn 0.5s ease';
                });
            }
            if (timerText) timerText.textContent = data.timeLimit;
            if (timerElement) timerElement.style.width = '100%';
            if (answeredCount) answeredCount.textContent = '0';
            currentQuestionIndex = data.questionIndex;
            totalQuestions = data.totalQuestions || totalQuestions;
            isLastQuestion = !!data.isLastQuestion;
            if (nextQuestionBtn) {
                nextQuestionBtn.textContent = isLastQuestion ? 'End Game' : (currentQuestionIndex === 0 ? 'Start First Question' : 'Next Question');
                nextQuestionBtn.disabled = true;
            }
            // Start timer for host
            let timeLeft = data.timeLimit;
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                if (timerText) timerText.textContent = timeLeft;
                if (timerElement) timerElement.style.width = (timeLeft / data.timeLimit * 100) + '%';
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    if (nextQuestionBtn) nextQuestionBtn.disabled = false;
                }
            }, 1000);
        });

        // Update player answer count
        socket.on('player-answered', function(data) {
            if (answeredCount) answeredCount.textContent = data.answeredCount;
            if (playerCount) playerCount.textContent = data.totalPlayers;
        });

        // Show leaderboard/results
        socket.on('question-results', function(data) {
            smoothTransition(questionDisplay, 'none');
            smoothTransition(leaderboard, 'block');
            if (scoresList) {
                scoresList.innerHTML = '';
                data.scores.forEach((player, index) => {
                    const li = document.createElement('li');
                    li.textContent = `${player.username}: ${player.score} points`;
                    li.style.animation = `fadeIn 0.3s ease ${index * 0.1}s`;
                    scoresList.appendChild(li);
                });
            }
            if (nextQuestionBtn) {
                nextQuestionBtn.textContent = data.isLastQuestion ? 'End Game' : 'Next Question';
                nextQuestionBtn.style.display = 'block';
                nextQuestionBtn.disabled = false;
            }
        });

        // Show final leaderboard
        socket.on('game-over', function(data) {
            if (questionDisplay) questionDisplay.style.display = 'none';
            if (leaderboard) leaderboard.style.display = 'block';
            if (scoresList) {
                scoresList.innerHTML = '';
                data.scores.forEach(player => {
                    const li = document.createElement('li');
                    li.textContent = `${player.username}: ${player.score} points`;
                    scoresList.appendChild(li);
                });
            }
            if (nextQuestionBtn) nextQuestionBtn.style.display = 'none';
            
            // Add return to menu button for host
            const backToMenuBtn = document.createElement('button');
            backToMenuBtn.id = 'back-to-menu-btn';
            backToMenuBtn.className = 'btn primary';
            backToMenuBtn.textContent = 'Go Back to Menu';
            backToMenuBtn.addEventListener('click', () => {
                window.location.href = '/quiz';
            });
            document.querySelector('.host-view').appendChild(backToMenuBtn);
        });
    }
    
    // --- PLAYER LOGIC ---
    if (!isHost) {
        console.log('Initializing player view');
        socket.emit('join-game', { gameId, username, playerId });
        
        // DOM elements for player view
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
        const leaderboard = document.getElementById('leaderboard');
        const scoresList = document.getElementById('scores-list');
        
        let hasAnswered = false;
        let startTime;
        let timerInterval;
        let pendingQuestionResults = null; // Store results if received before answering
        
        socket.on('game-started', (data) => {
            window.location.href = `/game/play/${gameId}`;
        });
        
        socket.on('new-question', function(data) {
            console.log('[EVENT] new-question:', data);
            smoothTransition(waitingScreen, 'none');
            smoothTransition(questionContainer, 'block');
            if (answerResult) answerResult.style.display = 'none';
            if (leaderboard) leaderboard.style.display = 'none';
            hasAnswered = false;
            pendingQuestionResults = null;
            if (questionText) questionText.textContent = data.question;
            if (options) {
                options.forEach((option, index) => {
                    option.textContent = data.options[index];
                    option.disabled = false;
                    option.classList.remove('selected', 'correct', 'incorrect');
                    option.style.animation = `fadeIn 0.3s ease ${index * 0.1}s`;
                    option.dataset.option = index;
                });
            }
            console.log('[UI] Show questionContainer, hide leaderboard and answerResult');
            
            // Start timer
            let timeLeft = data.timeLimit;
            if (timerText) timerText.textContent = timeLeft;
            if (timerElement) timerElement.style.width = '100%';
            startTime = Date.now();
            
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                if (timerText) timerText.textContent = timeLeft;
                if (timerElement) timerElement.style.width = (timeLeft / data.timeLimit * 100) + '%';
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    if (!hasAnswered) {
                        disableOptions();
                        socket.emit('submit-answer', {
                            gameId: gameId,
                            answer: -1, // No answer
                            time: data.timeLimit * 1000,
                            playerId: playerId
                        });
                    }
                }
            }, 1000);
        });
        
        // Update option click handler
        if (optionsGrid) {
            optionsGrid.addEventListener('click', function(e) {
                const option = e.target.closest('.option');
                if (!option) return;
                console.log('[UI] Option clicked:', {
                    option: option.dataset.option,
                    hasAnswered,
                    disabled: option.disabled
                });
                if (!hasAnswered && !option.disabled) {
                    const selectedOption = parseInt(option.dataset.option);
                    const timeElapsed = Date.now() - startTime;
                    hasAnswered = true;
                    option.classList.add('selected');
                    option.style.animation = 'pulse 0.3s ease';
                    disableOptions();
                    console.log('[EMIT] submit-answer:', {
                        gameId,
                        answer: selectedOption,
                        time: timeElapsed,
                        playerId
                    });
                    socket.emit('submit-answer', {
                        gameId: gameId,
                        answer: selectedOption,
                        time: timeElapsed,
                        playerId: playerId
                    });
                }
            });
        }
        
        function disableOptions() {
            if (options) {
                options.forEach(option => {
                    option.disabled = true;
                    option.style.cursor = 'not-allowed';
                });
            }
        }
        
        socket.on('answer-result', function(data) {
            console.log('[EVENT] answer-result:', data);
            smoothTransition(questionContainer, 'none');
            smoothTransition(answerResult, 'block');
            console.log('[UI] Show answerResult, hide questionContainer');
            if (resultIcon) {
                resultIcon.innerHTML = data.correct ? '✅' : '❌';
                resultIcon.style.animation = 'bounce 0.5s ease';
            }
            if (resultText) {
                resultText.textContent = data.correct ? 'Correct!' : 'Wrong!';
                resultText.style.color = data.correct ? '#4CAF50' : '#f44336';
            }
            if (pointsText) {
                pointsText.textContent = data.correct ? `+${data.points} points` : '0 points';
                pointsText.style.animation = 'fadeIn 0.5s ease';
            }
            if (pendingQuestionResults) {
                console.log('[DELAY] Showing leaderboard after answerResult in 1.5s');
                setTimeout(() => {
                    showLeaderboard(pendingQuestionResults);
                    pendingQuestionResults = null;
                }, 1500);
            }
        });
        
        socket.on('game-over', function(data) {
            console.log('Game over:', data);
            smoothTransition(waitingScreen, 'none');
            smoothTransition(questionContainer, 'none');
            smoothTransition(answerResult, 'none');
            smoothTransition(gameOver, 'block');
            
            const playerData = data.scores.find(p => p.username === username);
            const rank = data.scores.findIndex(p => p.username === username) + 1;
            
            if (playerData && finalScore) {
                finalScore.textContent = `Your score: ${playerData.score} points`;
                finalScore.style.animation = 'fadeInDown 0.5s ease';
            }
            
            if (playerData && finalRank) {
                finalRank.textContent = `Your rank: ${rank} of ${data.scores.length}`;
                finalRank.style.animation = 'fadeInDown 0.5s ease 0.2s';
            }
        });

        // Show leaderboard/results after each question, but only after player has answered
        socket.on('question-results', function(data) {
            console.log('[EVENT] question-results:', data, 'hasAnswered:', hasAnswered);
            if (hasAnswered) {
                console.log('[DELAY] Showing leaderboard after answerResult in 1.5s');
                setTimeout(() => {
                    showLeaderboard(data);
                }, 1500);
            } else {
                console.log('[PENDING] Storing question-results to show after answerResult');
                pendingQuestionResults = data;
            }
        });

        function showLeaderboard(data) {
            console.log('[UI] Show leaderboard, hide questionContainer and answerResult');
            smoothTransition(questionContainer, 'none');
            smoothTransition(answerResult, 'none');
            smoothTransition(leaderboard, 'block');
            if (scoresList) {
                scoresList.innerHTML = '';
                data.scores.forEach((player, index) => {
                    const li = document.createElement('li');
                    li.textContent = `${player.username}: ${player.score} points`;
                    li.style.animation = `fadeIn 0.3s ease ${index * 0.1}s`;
                    scoresList.appendChild(li);
                });
            }
        }
    }
    
    // --- COMMON HANDLERS ---
    socket.on('host-disconnected', () => {
        alert('The host has left the game.');
        window.location.href = '/game/join';
    });

    // Go Back to Menu button
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', () => {
            backToMenuBtn.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                window.location.href = '/quiz';
            }, 300);
        });
    }
});

// Add loading animation function
function showLoading(element) {
    element.innerHTML = '<div class="loading"></div>';
}

// Add smooth transition function
function smoothTransition(element, display) {
    element.style.opacity = '0';
    element.style.display = display;
    setTimeout(() => {
        element.style.opacity = '1';
    }, 50);
} 