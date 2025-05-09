const express = require('express');
const router = express.Router();
const homomorphicController = require('../controllers/homomorphic.controller');
const authMiddleware = require('../middleware/auth.middleware');

/**
 * @route   POST /api/homomorphic/initialize
 * @desc    Initialize homomorphic encryption for an election
 * @access  Private/Admin
 */
router.post('/initialize', 
  authMiddleware.verifyToken, 
  authMiddleware.verifyAdmin, 
  homomorphicController.initializeElection);

/**
 * @route   POST /api/homomorphic/encrypt-vote
 * @desc    Encrypt a vote for a candidate
 * @access  Private/Voter
 */
router.post('/encrypt-vote', 
  authMiddleware.verifyToken, 
  authMiddleware.verifyVoter, 
  homomorphicController.encryptVote);

/**
 * @route   POST /api/homomorphic/verify-vote
 * @desc    Verify an encrypted vote
 * @access  Private/Voter
 */
router.post('/verify-vote', 
  authMiddleware.verifyToken, 
  homomorphicController.verifyVote);

/**
 * @route   POST /api/homomorphic/calculate-results
 * @desc    Calculate results for an election using homomorphic tallying
 * @access  Private/Admin
 */
router.post('/calculate-results', 
  authMiddleware.verifyToken, 
  authMiddleware.verifyAdmin, 
  homomorphicController.calculateResults);

module.exports = router;