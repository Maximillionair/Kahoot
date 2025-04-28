const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const PlayerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  answers: [{
    questionIndex: Number,
    answer: Number,
    correct: Boolean,
    time: Number
  }]
});

const GameSchema = new mongoose.Schema({
  pin: {
    type: String,
    default: () => Math.floor(100000 + Math.random() * 900000).toString(),
    unique: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  players: [PlayerSchema],
  active: {
    type: Boolean,
    default: false
  },
  currentQuestion: {
    type: Number,
    default: -1
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Game', GameSchema);