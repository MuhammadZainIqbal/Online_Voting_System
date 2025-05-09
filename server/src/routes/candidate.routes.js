const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const candidateModel = require('../models/candidate.model');
const electionModel = require('../models/election.model');

/**
 * @route   GET /api/candidates
 * @desc    Get all candidates
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Filter by election ID if provided in query params
    const { electionId } = req.query;
    let candidates;
    
    if (electionId) {
      candidates = await candidateModel.getByElection(electionId);
    } else {
      // This would need to be implemented in the model
      // For now, we'll just return a message
      return res.status(400).json({ message: 'Election ID is required' });
    }
    
    res.json(candidates);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/candidates/count
 * @desc    Get total count of candidates
 * @access  Public
 */
router.get('/count', async (req, res) => {
  try {
    // Get count from the model
    const count = await candidateModel.getCount();
    
    res.json({ count });
  } catch (error) {
    console.error('Get candidates count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/candidates/:id
 * @desc    Get candidate by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const candidateId = req.params.id;
    const candidate = await candidateModel.findById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    res.json(candidate);
  } catch (error) {
    console.error('Get candidate by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/candidates
 * @desc    Create a new candidate
 * @access  Private/Admin
 */
router.post('/', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { electionId, name, party, symbol } = req.body;
    
    if (!electionId || !name || !party || !symbol) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Check if the election exists
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Create the candidate
    const newCandidate = await candidateModel.create(electionId, name, party, symbol);
    
    res.status(201).json(newCandidate);
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/candidates/:id
 * @desc    Update a candidate
 * @access  Private/Admin
 */
router.put('/:id', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { name, party, symbol } = req.body;
    
    // Check if the candidate exists
    const existingCandidate = await candidateModel.findById(candidateId);
    if (!existingCandidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Update the candidate
    const updatedCandidate = await candidateModel.update(
      candidateId,
      name || existingCandidate.name,
      party || existingCandidate.party,
      symbol || existingCandidate.symbol
    );
    
    res.json(updatedCandidate);
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/candidates/:id
 * @desc    Delete a candidate
 * @access  Private/Admin
 */
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const candidateId = req.params.id;
    
    // Check if the candidate exists
    const existingCandidate = await candidateModel.findById(candidateId);
    if (!existingCandidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Delete the candidate
    const deletedCandidate = await candidateModel.delete(candidateId);
    
    res.json({ 
      message: 'Candidate deleted successfully',
      candidate: deletedCandidate
    });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;