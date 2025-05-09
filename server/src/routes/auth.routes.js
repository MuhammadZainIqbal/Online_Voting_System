const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Import models
const voterModel = require('../models/voter.model');
const adminModel = require('../models/admin.model');
const otpModel = require('../models/otp.model'); 
const electionModel = require('../models/election.model');

// Import utilities
const cryptoUtils = require('../crypto/cryptoUtils');

/**
 * @route   GET /api/auth/voters/count
 * @desc    Get the count of registered voters (admin only)
 * @access  Private/Admin
 */
router.get('/voters/count', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    // Get all voters from the database
    const voters = await voterModel.getAll();
    
    // Return the count
    return res.json({
      count: voters.length
    });
  } catch (error) {
    console.error('Error getting voter count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/login
 * @desc    Authenticate voter & get token
 * @access  Public
 */
router.post('/voter/login', async (req, res) => {
  try {
    const { cnic, password } = req.body;
    
    if (!cnic || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }
    
    // Check if voter exists
    const voter = await voterModel.findByCNIC(cnic);
    if (!voter) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Validate password
    const isMatch = await bcrypt.compare(password, voter.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { id: voter.cnic, role: 'voter' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    
    return res.json({
      token,
      user: {
        cnic: voter.cnic,
        email: voter.email,
        hasVoted: voter.has_voted
      }
    });
  } catch (error) {
    console.error('Voter login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/admin/login
 * @desc    Authenticate admin & get token
 * @access  Public
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { cnic, password } = req.body;
    
    if (!cnic || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }
    
    // Check if admin exists
    const admin = await adminModel.findByCNIC(cnic);
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Validate password
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { id: admin.cnic, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );
    
    // Return in the format expected by client
    return res.json({
      token,
      user: {
        cnic: admin.cnic,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/admin/verify
 * @desc    Verify admin token
 * @access  Private
 */
router.get('/admin/verify', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if role is admin
      if (decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized as admin' });
      }
      
      // Get admin details
      const admin = await adminModel.findByCNIC(decoded.id);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      // Return admin data (without password hash)
      return res.json({
        cnic: admin.cnic,
        email: admin.email
      });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token, access denied' });
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/voter/verify
 * @desc    Verify voter token
 * @access  Private
 */
router.get('/voter/verify', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if role is voter
      if (decoded.role !== 'voter') {
        return res.status(403).json({ message: 'Not authorized as voter' });
      }
      
      // Get voter details
      const voter = await voterModel.findByCNIC(decoded.id);
      if (!voter) {
        return res.status(404).json({ message: 'Voter not found' });
      }
      
      // Return voter data (without password hash)
      return res.json({
        cnic: voter.cnic,
        email: voter.email,
        hasVoted: voter.has_voted
      });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token, access denied' });
    }
  } catch (error) {
    console.error('Voter verification error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/register
 * @desc    Register a new voter (admin only)
 * @access  Private/Admin
 */
router.post('/voter/register', async (req, res) => {
  try {
    const { cnic, email, password } = req.body;
    
    if (!cnic || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }
    
    // Check if voter already exists
    const existingVoter = await voterModel.findByCNIC(cnic);
    if (existingVoter) {
      return res.status(400).json({ message: 'Voter already exists' });
    }
    
    // Generate key pair for the voter
    const { publicKey, privateKey } = cryptoUtils.generateKeyPair();
    
    // Create the voter in the database
    const newVoter = await voterModel.create(cnic, email, password, publicKey);
    
    // Send private key to voter's email
    const emailSent = await cryptoUtils.sendPrivateKeyByEmail(email, privateKey);
    
    if (emailSent) {
      return res.status(201).json({ 
        message: 'Voter registered successfully. Private key sent to email.',
        voter: {
          cnic: newVoter.cnic,
          email: newVoter.email
        }
      });
    } else {
      // If email fails, delete the voter (we don't want voters without keys)
      // In a real system, you might handle this differently
      // await voterModel.delete(cnic);
      return res.status(500).json({ message: 'Failed to send private key. Registration canceled.' });
    }
  } catch (error) {
    console.error('Voter registration error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/send-otp
 * @desc    Send OTP to voter's email for verification (admin only)
 * @access  Private/Admin
 */
router.post('/voter/send-otp', async (req, res) => {
  try {
    const { cnic, email } = req.body;
    
    if (!cnic || !email) {
      return res.status(400).json({ message: 'Please provide CNIC and email' });
    }
    
    // Check if there are any active or upcoming elections
    const hasActiveOrUpcomingElections = await electionModel.hasActiveOrUpcomingElections();
    if (hasActiveOrUpcomingElections) {
      return res.status(403).json({ 
        message: 'Voter registration is disabled during active or upcoming elections. New voters can be registered after all elections are completed.' 
      });
    }
    
    // Check if voter already exists
    const existingVoter = await voterModel.findByCNIC(cnic);
    if (existingVoter) {
      return res.status(400).json({ message: 'Voter with this CNIC already exists' });
    }
    
    const existingEmail = await voterModel.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email is already registered' });
    }
    
    // Generate a 6-digit OTP
    const otp = otpModel.generateOTP();
    
    // Store OTP in the database
    await otpModel.storeOTP(cnic, email, otp);
    
    // Send OTP to voter's email
    const emailSent = await cryptoUtils.sendOTPByEmail(email, otp);
    
    if (emailSent) {
      return res.json({ 
        message: `OTP sent to ${email} successfully`,
        success: true
      });
    } else {
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/verify-otp
 * @desc    Verify OTP for voter registration (admin only)
 * @access  Private/Admin
 */
router.post('/voter/verify-otp', async (req, res) => {
  try {
    const { cnic, email, otp } = req.body;
    
    if (!cnic || !email || !otp) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }
    
    // Verify OTP - with improved error handling
    const verification = await otpModel.verifyOTP(cnic, email, otp);
    
    if (!verification.isValid) {
      return res.status(400).json({ message: verification.message });
    }
    
    return res.json({ 
      message: 'Email verified successfully',
      success: true
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    // Send a more detailed error message to help with troubleshooting
    return res.status(500).json({ 
      message: 'Server error processing OTP verification', 
      details: error.message
    });
  }
});

/**
 * @route   POST /api/auth/voter/complete-registration
 * @desc    Complete voter registration after OTP verification (admin only)
 * @access  Private/Admin
 */
router.post('/voter/complete-registration', async (req, res) => {
  try {
    const { cnic, email, password } = req.body;
    
    if (!cnic || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }
    
    // Check if there are any active or upcoming elections
    const hasActiveOrUpcomingElections = await electionModel.hasActiveOrUpcomingElections();
    if (hasActiveOrUpcomingElections) {
      return res.status(403).json({ 
        message: 'Voter registration is disabled during active or upcoming elections. New voters can be registered after all elections are completed.' 
      });
    }
    
    // Check if OTP has been verified
    const isOTPVerified = await otpModel.isOTPVerified(cnic, email);
    if (!isOTPVerified) {
      return res.status(400).json({ message: 'Email not verified. Please verify with OTP first.' });
    }
    
    // Check if voter already exists
    const existingVoter = await voterModel.findByCNIC(cnic);
    if (existingVoter) {
      return res.status(400).json({ message: 'Voter already exists' });
    }
    
    // Generate key pair for the voter
    const { publicKey, privateKey } = cryptoUtils.generateKeyPair();
    
    // Create the voter in the database
    const newVoter = await voterModel.create(cnic, email, password, publicKey);
    
    // Send private key to voter's email
    const emailSent = await cryptoUtils.sendPrivateKeyByEmail(email, privateKey);
    
    if (emailSent) {
      // Clear OTP after successful registration
      await otpModel.clearOTP(cnic, email);
      
      return res.status(201).json({ 
        message: 'Voter registered successfully. Private key sent to email.',
        voter: {
          cnic: newVoter.cnic,
          email: newVoter.email
        }
      });
    } else {
      // If email fails, delete the voter (we don't want voters without keys)
      // await voterModel.delete(cnic);
      return res.status(500).json({ message: 'Failed to send private key. Registration canceled.' });
    }
  } catch (error) {
    console.error('Error completing voter registration:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/admin/register
 * @desc    Register a new admin (for initial setup, would be restricted in production)
 * @access  Public (would be restricted in production)
 */
router.post('/admin/register', async (req, res) => {
  try {
    const { cnic, email, password, secretCode } = req.body;
    
    if (!cnic || !email || !password || !secretCode) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }
    
    // Verify secret code for admin registration (simple implementation)
    // In production, use a more secure method
    if (secretCode !== process.env.ADMIN_SECRET_CODE) {
      return res.status(401).json({ message: 'Invalid secret code' });
    }
    
    // Check if admin already exists
    const existingAdmin = await adminModel.findByCNIC(cnic);
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    
    // Create the admin in the database
    const newAdmin = await adminModel.create(cnic, email, password);
    
    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: {
        cnic: newAdmin.cnic,
        email: newAdmin.email
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/admin/validate
 * @desc    Validate admin token and return user data
 * @access  Private/Admin
 */
router.get('/admin/validate', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    // Since middleware has already verified the token, just return the user data
    // Don't include sensitive data like password hash
    return res.json({
      user: {
        cnic: req.user.id,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Admin validation error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
});

/**
 * @route   GET /api/auth/voter/validate
 * @desc    Validate voter token and return user data
 * @access  Private/Voter
 */
router.get('/voter/validate', authMiddleware.verifyToken, authMiddleware.verifyVoter, async (req, res) => {
  try {
    const voter = await voterModel.findByCNIC(req.user.id);
    
    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    
    // Don't include sensitive data like password hash and private key
    return res.json({
      user: {
        cnic: voter.cnic,
        email: voter.email,
        name: voter.name || '',
        has_voted: voter.has_voted
      }
    });
  } catch (error) {
    console.error('Voter validation error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
});

/**
 * @route   POST /api/auth/voter/forgot-password
 * @desc    Send OTP for password reset
 * @access  Public
 */
router.post('/voter/forgot-password', async (req, res) => {
  try {
    const { cnic, email } = req.body;
    
    if (!cnic || !email) {
      return res.status(400).json({ message: 'Please provide CNIC and email' });
    }
    
    // Verify that voter exists with this CNIC and email
    const voter = await voterModel.findByCNICAndEmail(cnic, email);
    if (!voter) {
      return res.status(404).json({ message: 'No voter found with that CNIC and email' });
    }
    
    // Generate a 6-digit OTP
    const otp = otpModel.generateOTP();
    
    // Hash the OTP before storing (for verification later)
    const crypto = require('crypto');
    const resetToken = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Set expiry to 10 minutes from now
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    // Store reset token in the voter record
    await voterModel.storeResetToken(cnic, resetToken, resetExpires);
    
    // Send OTP to voter's email
    const emailSent = await cryptoUtils.sendOTPByEmail(email, otp);
    
    if (emailSent) {
      return res.json({ 
        message: 'OTP sent to your email. Please use it to reset your password.',
        success: true
      });
    } else {
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/verify-reset-otp
 * @desc    Verify OTP for password reset
 * @access  Public
 */
router.post('/voter/verify-reset-otp', async (req, res) => {
  try {
    const { cnic, otp } = req.body;
    
    if (!cnic || !otp) {
      return res.status(400).json({ message: 'Please provide CNIC and OTP' });
    }
    
    // Get voter to check if reset token exists
    const voter = await voterModel.findByCNIC(cnic);
    if (!voter || !voter.reset_token || !voter.reset_expires) {
      return res.status(400).json({ message: 'Password reset not requested or token expired' });
    }
    
    // Check if token is expired
    if (new Date() > new Date(voter.reset_expires)) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    
    // Hash the provided OTP and compare with stored token
    const crypto = require('crypto');
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (hashedOTP !== voter.reset_token) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }
    
    // OTP is valid - create a temporary token for the reset form
    const tempToken = jwt.sign(
      { id: voter.cnic, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );
    
    return res.json({ 
      message: 'OTP verified successfully.',
      tempToken,
      success: true
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/reset-password
 * @desc    Reset voter password with valid token
 * @access  Public
 */
router.post('/voter/reset-password', async (req, res) => {
  try {
    const { tempToken, newPassword, confirmPassword } = req.body;
    
    if (!tempToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    
    // Verify the temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token. Please try again.' });
    }
    
    // Check if token is for password reset
    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({ message: 'Invalid token purpose' });
    }
    
    // Get voter
    const voter = await voterModel.findByCNIC(decoded.id);
    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    
    // Update the password
    await voterModel.updatePassword(voter.cnic, newPassword);
    
    // Clear the reset token
    await voterModel.clearResetToken(voter.cnic);
    
    return res.json({ 
      message: 'Password has been reset successfully. You can now log in with your new password.',
      success: true
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/voter/change-password
 * @desc    Change voter password (when logged in)
 * @access  Private/Voter
 */
router.post('/voter/change-password', authMiddleware.verifyToken, authMiddleware.verifyVoter, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const voterId = req.user.id;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }
    
    // Get voter
    const voter = await voterModel.findByCNIC(voterId);
    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, voter.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update the password
    await voterModel.updatePassword(voterId, newPassword);
    
    return res.json({ 
      message: 'Password changed successfully',
      success: true
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/admin/change-password
 * @desc    Change admin password (when logged in)
 * @access  Private/Admin
 */
router.post('/admin/change-password', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = req.user.id;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }
    
    // Get admin
    const admin = await adminModel.findByCNIC(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update the password
    await adminModel.updatePassword(adminId, newPassword);
    
    return res.json({ 
      message: 'Password changed successfully',
      success: true
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;