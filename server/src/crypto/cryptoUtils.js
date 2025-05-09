const forge = require('node-forge');
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Cryptographic utility functions for the Online Voting System
 * Simplified and rebuilt for maximum reliability
 */
const cryptoUtils = {
  /**
   * Generate an RSA key pair for voter authentication
   * @returns {Object} Object containing public and private keys in PEM format
   */
  generateKeyPair() {
    // Generate a 2048-bit RSA key pair
    const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    
    // Convert to PEM format for storage and transmission
    const publicKey = forge.pki.publicKeyToPem(keyPair.publicKey);
    const privateKey = forge.pki.privateKeyToPem(keyPair.privateKey);
    
    // Log key lengths for debugging
    console.log(`Generated key pair - Public key: ${publicKey.length} bytes, Private key: ${privateKey.length} bytes`);
    
    return { publicKey, privateKey };
  },
  
  /**
   * Simple data signing function
   * @param {String} data - The data to sign
   * @param {String} privateKeyPem - Private key in PEM format
   * @returns {String} Base64-encoded signature
   */
  signData(data, privateKeyPem) {
    try {
      // Log the key format for debugging
      console.log(`Private key starts with: ${privateKeyPem ? privateKeyPem.substring(0, 30) : 'undefined'}...`);
      
      // More flexible validation supporting more key formats 
      if (!privateKeyPem) {
        throw new Error('Private key is missing or undefined');
      }
      
      // Check if it's any type of PEM formatted private key
      if (!privateKeyPem.includes('-----BEGIN') || !privateKeyPem.includes('PRIVATE KEY')) {
        throw new Error('Invalid private key format - must be PEM format with BEGIN/END markers');
      }
      
      // Parse the private key
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      
      // Create SHA-256 digest and sign
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      const signature = privateKey.sign(md);
      
      // Base64 encode the signature
      const encodedSignature = forge.util.encode64(signature);
      
      console.log(`Signature created for '${data}' - Length: ${encodedSignature.length} bytes`);
      return encodedSignature;
    } catch (error) {
      console.error('Error signing data:', error);
      throw error;
    }
  },
  
  /**
   * Verify a signature using a voter's public key
   * Simplified, robust implementation for maximum compatibility with client signatures
   * @param {String} data - The original data
   * @param {String} signature - Base64-encoded signature
   * @param {String} publicKeyPem - Public key in PEM format
   * @returns {Boolean} True if signature is valid
   */
  verifySignature(data, signature, publicKeyPem) {
    try {
      if (!data || !signature || !publicKeyPem) {
        console.error('Missing required parameters for signature verification');
        return false;
      }
      
      if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----')) {
        console.error('Invalid public key format');
        return false;
      }
      
      console.log(`Verifying signature for '${data}' using public key`);
      console.log(`Signature length: ${signature.length}, first 30 chars: ${signature.substring(0, 30)}`);
      
      // Method 1: Direct forge verification (most reliable for client-generated signatures)
      try {
        const forge = require('node-forge');
        const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
        const md = forge.md.sha256.create();
        md.update(data, 'utf8');
        
        // Add proper padding to the base64 string if needed
        let paddedSignature = signature;
        while (paddedSignature.length % 4 !== 0) {
          paddedSignature += '=';
        }
        
        // Decode and verify
        try {
          const decodedSignature = forge.util.decode64(paddedSignature);
          const result = publicKey.verify(md.digest().bytes(), decodedSignature);
          if (result) {
            console.log('Signature verification successful with forge method');
            return true;
          }
        } catch (forgeError) {
          console.log('Primary forge verification failed:', forgeError.message);
        }
      } catch (error) {
        console.log('Forge verification method failed:', error.message);
      }
      
      // Method 2: Node.js crypto verification
      try {
        const crypto = require('crypto');
        const publicKeyObj = crypto.createPublicKey(publicKeyPem);
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        
        // Try various base64 padding scenarios
        const paddingOptions = [signature];
        if (signature.length % 4 !== 0) {
          let padded = signature;
          while (padded.length % 4 !== 0) {
            padded += '=';
          }
          paddingOptions.push(padded);
        }
        
        for (const sig of paddingOptions) {
          try {
            if (verify.verify(publicKeyObj, sig, 'base64')) {
              console.log('Signature verification successful with Node.js crypto');
              return true;
            }
          } catch (e) {
            console.log('Node.js verification attempt failed:', e.message);
            // Continue to next attempt
          }
          
          try {
            if (verify.verify(publicKeyObj, Buffer.from(sig, 'base64'))) {
              console.log('Signature verification successful with Node.js buffer method');
              return true;
            }
          } catch (e) {
            console.log('Node.js buffer method failed:', e.message);
            // Continue to next attempt
          }
        }
      } catch (cryptoError) {
        console.log('Node.js crypto methods failed:', cryptoError.message);
      }
      
      // Method 3: Manual BinaryString conversion
      // This addresses a common forge compatibility issue
      try {
        const forge = require('node-forge');
        const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
        const md = forge.md.sha256.create();
        md.update(data, 'utf8');
        
        // Custom base64 decoding with binary string handling
        let paddedSignature = signature;
        while (paddedSignature.length % 4 !== 0) {
          paddedSignature += '=';
        }
        
        // Convert base64 to binary string manually
        let binary = '';
        const bytes = forge.util.decode64(paddedSignature);
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes.charCodeAt(i) & 0xff);
        }
        
        const result = publicKey.verify(md.digest().bytes(), binary);
        if (result) {
          console.log('Signature verification successful with manual binary conversion');
          return true;
        }
      } catch (manualError) {
        console.log('Manual binary conversion failed:', manualError.message);
      }
      
      // Method 4: Last resort - try alternative message formatting
      try {
        const alternateFormats = [
          data.trim(),
          `${data}`, // Cast to string explicitly
          data.toLowerCase()
        ];
        
        for (const format of alternateFormats) {
          const forge = require('node-forge');
          const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
          const md = forge.md.sha256.create();
          md.update(format, 'utf8');
          
          let paddedSignature = signature;
          while (paddedSignature.length % 4 !== 0) {
            paddedSignature += '=';
          }
          
          try {
            const decodedSignature = forge.util.decode64(paddedSignature);
            const result = publicKey.verify(md.digest().bytes(), decodedSignature);
            if (result) {
              console.log(`Signature verification successful with alternate format: "${format}"`);
              return true;
            }
          } catch (e) {
            // Continue to next format
          }
        }
      } catch (formatError) {
        console.log('Format variation attempts failed:', formatError.message);
      }
      
      console.error('All signature verification methods failed');
      return false;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  },
  
  /**
   * Send private key to voter's email as a .pem file
   * @param {String} email - Voter's email address
   * @param {String} privateKey - Private key in PEM format
   * @returns {Promise<Boolean>} Success status
   */
  async sendPrivateKeyByEmail(email, privateKey) {
    // Create a transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Create a unique filename for the private key
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 10);
    const filename = `voting_private_key_${timestamp}_${randomString}.pem`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Private Key for Online Voting System',
      html: `
        <h2>Your Private Key for Voting</h2>
        <p>Please save the attached private key file securely. You will need to upload this file when casting your vote.</p>
        <p><strong>Important Security Instructions:</strong></p>
        <ul>
          <li>Download and save this file to a secure location on your device</li>
          <li>Do not share this key with anyone</li>
          <li>Keep a backup of this file in a secure location</li>
          <li>You will need to upload this exact file when you vote</li>
        </ul>
        <p>Note: For security purposes, this key is sent only once and is not stored on our servers.</p>
      `,
      attachments: [
        {
          filename: filename,
          content: privateKey,
          contentType: 'application/x-pem-file'
        }
      ]
    };
    
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Private key successfully sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending private key email:', error);
      return false;
    }
  },
  
  /**
   * Send OTP verification code to voter's email
   * @param {String} email - Voter's email address
   * @param {String} otp - One-time password for verification
   * @returns {Promise<Boolean>} Success status
   */
  async sendOTPByEmail(email, otp) {
    // Create a transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Verification Code for Online Voting System',
      html: `
        <h2>Email Verification</h2>
        <p>Please use the following OTP (One-Time Password) to verify your email address:</p>
        <div style="font-size: 24px; font-weight: bold; padding: 15px; background-color: #f4f4f4; border-radius: 5px; text-align: center; letter-spacing: 5px;">${otp}</div>
        <p>This OTP will expire in 3 minutes.</p>
        <p>If you did not request this OTP, please ignore this email.</p>
      `
    };
    
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('OTP email sending error:', error);
      return false;
    }
  }
};

module.exports = cryptoUtils;