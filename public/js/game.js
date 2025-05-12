document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Get game data from the hidden div
    const gameData = document.getElementById('game-data');
    const gameId = gameData.dataset.gameId;
    const isHost = gameData.dataset.isHost === 'true';
    const username = gameData.dataset.username;
    
    if (isHost) {
        // Host specific elements
        const playerList = document.getElementById('players');
        const playerCount = document.getElementById('player-count');
        const startBtn = document.getElementById('start-btn');
        
        // Create game room
        socket.emit('create-game', { gameId });
        
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
            if (startBtn) {
                startBtn.disabled = players.length === 0;
            }
        });
        
        // Handle player leaves
        socket.on('player-left', function(data) {
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
            
            // Disable start button if no players
            if (startBtn) {
                startBtn.disabled = players.length === 0;
            }
        });
        
        // Handle start button click
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                socket.emit('start-game', { gameId });
            });
        }
    } else {
        // Player specific code
        socket.emit('join-game', {
            gameId,
            username
        });
    }
    
    // Common handlers for both host and players
    socket.on('game-started', () => {
        window.location.href = `/game/play/${gameId}`;
    });
    
    socket.on('host-disconnected', () => {
        alert('The host has left the game.');
        window.location.href = '/game/join';
    });
}); 