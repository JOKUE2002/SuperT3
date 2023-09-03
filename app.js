const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.static(path.join(process.cwd(), 'public')));
app.use('socket.io', express.static(path.join(process.cwd(), 'node_modules', 'socket.io', 'client-dist')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//HTTP SERVER
const http = require('http');
const server = http.createServer(app);

//WEBSOCKETS
const { Server } = require("socket.io");
const io = new Server(server);

//DOTENV
require('dotenv').config();

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'views', 'game.html'));
});


const winningMoves = ['012','345','678', '036','147','258', '048','246']
const games = []
const queue = []








io.on('connection', (socket) => {

    socket.on('start', (data) => {
        console.log('START', data);

        if (data.isPVP) {
            const queueFirst = queue.shift()

            if (queueFirst) {
                io.emit('gameStart', {players: [queueFirst, data.uuid]})
                games.push({players: [queueFirst, data.uuid], moves: [], currentSubgame: null, wonSubgames: [[], []]})
            } else {
                queue.push(data.uuid)
            }
        } else {
            socket.emit('error', 'PVC not implemented')
        }

        console.log('DEBUG', games)
        console.log('DEBUG', queue)
    });

    socket.on('move', (move) => {
        console.log('MOVE', move)

        const game = games.find(e => e.players.includes(move.uuid))

        if (!game || game.moves.includes(move.move))
            return

        game.moves.push(move.move)

        const newSubgame = parseInt(move.move.charAt(1))
        const hasWonCurrentSubgame = checkWin(move.move.charAt(0), game.moves)
        const nextSubgameHasBeenWon = checkWin(move.move.charAt(1), game.moves)
        const cntInSubgame = game.moves.filter(e => e.startsWith(move.move.charAt(1))).length
        game.currentSubgame = (cntInSubgame < 9 && !nextSubgameHasBeenWon) ? newSubgame : null

        switch (hasWonCurrentSubgame) {
            case 'X': game.wonSubgames[0].push(move.move.charAt(0)); break;
            case 'O': game.wonSubgames[1].push(move.move.charAt(0)); break;
            default: break;
        }

        console.log('DEBUG', games)

        io.emit('move', games.find(e => e.players.includes(move.uuid)))

        const isGameOver = checkGameOver(game.wonSubgames)

        if (isGameOver) {
            io.emit('gameover', {players: game.players, result: isGameOver})

            const idx = games.indexOf(e => e.players.includes(move.uuid))
            games.splice(idx, 1)
        }
    })

    socket.on('check', (data) => {
        const game = games.find(e => e.players.includes(data.uuid))

        if (game) {
            socket.emit('gameStart', game)

            game.moves.forEach(() => {
                socket.emit('move', game)
            })
        }
    })

    //socket.emit('')
});

server.listen(process.env.PORT ?? 3000, () => {
    console.log(`SuperT3 listening on http://localhost:${process.env.PORT ?? 3000}`);
});

function checkWin(subgame, moves) {
    const xMoves = moves.filter((_, i) => i % 2 === 0).filter(e => e.startsWith(subgame))
    const oMoves = moves.filter((_, i) => i % 2 !== 0).filter(e => e.startsWith(subgame))

    console.log(xMoves, oMoves)

    const xString = xMoves.map(e => parseInt(e.charAt(1))).sort().join('')
    const oString = oMoves.map(e => parseInt(e.charAt(1))).sort().join('')

    console.log(xString, oString)

    let xWon = winningMoves.includes(xString)
    let oWon = winningMoves.includes(oString)

    winningMoves.forEach(winSequence => {
        const parts = winSequence.split('')
        xWon |= parts.map(p => xString.includes(p)).every(e => e)
        oWon |= parts.map(p => oString.includes(p)).every(e => e)
    })

    console.log(xWon, oWon)

    if (xWon)
        return 'X'
    else if (oWon)
        return 'O'
    else
        return ''
}

function checkGameOver(wonSubgames) {
    const xWins = wonSubgames[0].join('')
    const oWins = wonSubgames[1].join('')

    if ((xWins.length + oWins.length) >= 9) {
        return {winner: 'T', sequence: null}
    }

    let xWon = winningMoves.includes(xWins)
    let oWon = winningMoves.includes(oWins)
    let winningSequence = null

    winningMoves.forEach(winSequence => {
        const parts = winSequence.split('')

        if (parts.map(p => xWins.includes(p)).every(e => e)) {
            xWon = true
            winningSequence = winSequence
        }
        if (parts.map(p => oWins.includes(p)).every(e => e)) {
            oWon = true
            winningSequence = winSequence
        }
    })

    if (xWon)
        return {winner: 'X', sequence: winningSequence}
    else if (oWon)
        return {winner: 'O', sequence: winningSequence}
    else
        return null

}