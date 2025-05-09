const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const electionModel = require('../models/election.model');
const candidateModel = require('../models/candidate.model');
const db = require('../database');

/**
 * @route   GET /api/elections
 * @desc    Get all elections
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const elections = await electionModel.getAll();
    res.json(elections);
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/elections/authority-key
 * @desc    Get the election authority's public key
 * @access  Private (authenticated users only)
 */
router.get('/authority-key', authMiddleware.verifyToken, async (req, res) => {
  try {
    // Get the authority's public key from the admin table
    const authorityResult = await db.query(
      'SELECT signing_public_key FROM admin LIMIT 1'
    );
    
    if (!authorityResult.rows.length || !authorityResult.rows[0].signing_public_key) {
      return res.status(404).json({ message: 'Authority key not found' });
    }
    
    return res.json({
      publicKey: authorityResult.rows[0].signing_public_key
    });
  } catch (error) {
    console.error('Get authority key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/elections/active
 * @desc    Get active elections
 * @access  Public
 */
router.get('/active', async (req, res) => {
  try {
    const activeElections = await electionModel.getActive();
    res.json(activeElections);
  } catch (error) {
    console.error('Get active elections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/elections/completed
 * @desc    Get completed elections
 * @access  Public
 */
router.get('/completed', async (req, res) => {
  try {
    // Make sure election statuses are up to date
    await electionModel.updateElectionStatuses();
    
    // Query for completed elections
    const query = 'SELECT * FROM election WHERE status = $1 ORDER BY end_time DESC';
    const result = await db.query(query, ['completed']);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get completed elections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/elections/:id
 * @desc    Get election by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const electionId = req.params.id;
    const election = await electionModel.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    res.json(election);
  } catch (error) {
    console.error('Get election by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/elections
 * @desc    Create a new election
 * @access  Private/Admin
 */
router.post('/', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { title, startTime, endTime } = req.body;
    
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    if (end <= start) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }
    
    const newElection = await electionModel.create(title, startTime, endTime);
    
    res.status(201).json(newElection);
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/elections/:id
 * @desc    Update an election
 * @access  Private/Admin
 */
router.put('/:id', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const { title, startTime, endTime, status } = req.body;
    
    // Check if the election exists
    const existingElection = await electionModel.findById(electionId);
    if (!existingElection) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Validate status if provided
    if (status && !['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Validate dates if both are provided
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      if (end <= start) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
    } else if (startTime && !endTime) {
      // If only start time is provided, check against existing end time
      const start = new Date(startTime);
      const end = new Date(existingElection.end_time);
      
      if (end <= start) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
    } else if (!startTime && endTime) {
      // If only end time is provided, check against existing start time
      const start = new Date(existingElection.start_time);
      const end = new Date(endTime);
      
      if (end <= start) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
    }
    
    // Update the election
    const updatedElection = await electionModel.update(
      electionId,
      title || existingElection.title,
      startTime || existingElection.start_time,
      endTime || existingElection.end_time,
      status || existingElection.status
    );
    
    // If election is marked as completed, delete all associated candidates
    if (status === 'completed' && existingElection.status !== 'completed') {
      await candidateModel.deleteByElection(electionId);
      console.log(`Election ${electionId} completed - all candidates removed`);
    }
    
    res.json(updatedElection);
  } catch (error) {
    console.error('Update election error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

/**
 * @route   PUT /api/elections/:id/status
 * @desc    Update election status
 * @access  Private/Admin
 */
router.put('/:id/status', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Check if the election exists
    const existingElection = await electionModel.findById(electionId);
    if (!existingElection) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    const updatedElection = await electionModel.updateStatus(electionId, status);
    
    // If election is marked as completed, delete all associated candidates
    if (status === 'completed') {
      await candidateModel.deleteByElection(electionId);
      console.log(`Election ${electionId} completed - all candidates removed`);
    }
    
    res.json(updatedElection);
  } catch (error) {
    console.error('Update election status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;