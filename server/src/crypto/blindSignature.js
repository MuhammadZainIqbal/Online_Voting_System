const crypto = require('crypto');
const forge = require('node-forge');
const BigInt = require('big-integer');

/**
 * Implementation of the blind signature protocol for anonymous ballot authorization
 * This allows voters to get their ballots signed by the election authority
 * without revealing their vote choices.
 */
class BlindSignature {
  /**
   * Generate a blinding factor for the voter to blind their message
   * @param {String} publicKey - Authority's public key in PEM format
   * @returns {Object} Blinding factor and its inverse
   */
  static generateBlindingFactor(publicKey) {
    try {
      // Extract modulus (n) from the public key
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const n = BigInt(publicKeyObj.n.toString());
      
      // Generate a random number r such that gcd(r, n) = 1
      let r;
      let attempts = 0;
      const MAX_ATTEMPTS = 10;
      
      do {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          throw new Error('Failed to generate valid blinding factor after maximum attempts');
        }
        
        // Generate random bytes
        const randomBytes = crypto.randomBytes(Math.ceil(n.toString().length / 2));
        r = BigInt(`0x${randomBytes.toString('hex')}`).mod(n);
        
        // Ensure r is not zero
        if (r.equals(BigInt.zero)) {
          continue;
        }
      } while (this._gcd(r, n).notEquals(BigInt.one));
      
      // Compute r^-1 mod n
      const rInverse = r.modInv(n);
      
      return {
        r: r.toString(),
        rInverse: rInverse.toString()
      };
    } catch (error) {
      console.error('Error generating blinding factor:', error);
      throw new Error(`Failed to generate blinding factor: ${error.message}`);
    }
  }
  
  /**
   * Blind a message before sending it to the authority for signing
   * @param {string} message - The original message to blind
   * @param {string} r - The blinding factor
   * @param {string} publicKey - Authority's public key in PEM format
   * @returns {string} The blinded message
   */
  static blindMessage(message, r, publicKey) {
    try {
      // Extract public key components
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const n = BigInt(publicKeyObj.n.toString());
      const e = BigInt(publicKeyObj.e.toString());
      
      // Convert r to BigInt
      const rBigInt = BigInt(r);
      
      // Convert message to BigInt (assuming it's a hex hash)
      let messageInt;
      if (/^[0-9a-fA-F]+$/.test(message)) {
        messageInt = BigInt('0x' + message);
      } else {
        // Hash the message first if it's not already a hex string
        const messageHash = crypto.createHash('sha256').update(message).digest('hex');
        messageInt = BigInt('0x' + messageHash);
      }
      
      // Blind the message: m' = m * r^e mod n
      const rE = rBigInt.modPow(e, n);
      const blindedMessage = messageInt.multiply(rE).mod(n);
      
      // Return as hex string
      return blindedMessage.toString(16);
    } catch (error) {
      console.error('Error blinding message:', error);
      throw new Error(`Failed to blind message: ${error.message}`);
    }
  }
  
  /**
   * Sign a blinded message using the authority's private key
   * @param {string} blindedMessage - The blinded message to sign
   * @param {string} privateKey - Authority's private key in PEM format
   * @returns {string} The blind signature
   */
  static signBlindedMessage(blindedMessage, privateKey) {
    try {
      // Parse private key
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const n = BigInt(privateKeyObj.n.toString());
      const d = BigInt(privateKeyObj.d.toString());
      
      // Convert blinded message to BigInt
      let bm;
      if (/^[0-9a-fA-F]+$/.test(blindedMessage)) {
        // It's a hex string, use base 16
        bm = BigInt(blindedMessage, 16);
      } else {
        bm = BigInt(blindedMessage);
      }
      
      // Sign the blinded message: s' = (m')^d mod n
      const blindSignature = bm.modPow(d, n);
      
      // Return as hex string for consistent handling
      return blindSignature.toString(16);
    } catch (error) {
      console.error('Error signing blinded message:', error);
      throw new Error(`Failed to sign blinded message: ${error.message}`);
    }
  }
  
  /**
   * Unblind a blind signature to get a valid signature on the original message
   * @param {string} blindSignature - The blind signature
   * @param {string} rInverse - The inverse of the blinding factor
   * @param {string} publicKey - Authority's public key in PEM format
   * @returns {string} The unblinded signature
   */
  static unblindSignature(blindSignature, rInverse, publicKey) {
    try {
      // Parse public key to get modulus n
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const n = BigInt(publicKeyObj.n.toString());
      
      // Convert blind signature to BigInt
      let bs;
      if (/^[0-9a-fA-F]+$/.test(blindSignature)) {
        bs = BigInt(blindSignature, 16);
      } else {
        bs = BigInt(blindSignature);
      }
      
      const ri = BigInt(rInverse);
      
      // Compute unblinded signature: s = s' * r^-1 mod n
      const signature = bs.multiply(ri).mod(n);
      
      // Return the signature as a hexadecimal string
      return signature.toString(16);
    } catch (error) {
      console.error('Error unblinding signature:', error);
      throw new Error(`Failed to unblind signature: ${error.message}`);
    }
  }
  
  /**
   * Verify a signature on a message using the authority's public key
   * @param {string} message - The original message or its hash
   * @param {string} signature - The signature to verify
   * @param {string} publicKey - Authority's public key in PEM format
   * @returns {boolean} True if the signature is valid
   */
  static verifySignature(message, signature, publicKey) {
    try {
      console.log('\nVerifying signature...');
      console.log(`Signature format: ${typeof signature}`);
      // Limit signature output to prevent console flooding
      console.log(`Signature value: ${signature.substring(0, 40)}...${signature.substring(signature.length - 40)}`);
      
      // Parse public key
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const n = BigInt(publicKeyObj.n.toString());
      const e = BigInt(publicKeyObj.e.toString());
      
      // Convert signature to BigInt
      let signatureValue;
      try {
        // First, ensure the signature has no '0x' prefix and is a valid hex string
        let signatureHex = signature;
        
        // Remove '0x' prefix if present
        if (signatureHex.startsWith('0x')) {
          signatureHex = signatureHex.substring(2);
        }
        
        // Check if it's a valid hex string
        if (/^[0-9a-fA-F]+$/i.test(signatureHex)) {
          console.log('Signature validated as proper hex string');
          
          // Try parsing in smaller chunks to avoid BigInt size issues
          try {
            signatureValue = BigInt(signatureHex);
          } catch (sizeError) {
            console.log('Error with full signature, trying chunk-based parsing');
            // Process signature in chunks if too large (can happen with longer keys)
            const chunkSize = 20; // Process in 20 char chunks
            let result = BigInt(0);
            
            for (let i = 0; i < signatureHex.length; i += chunkSize) {
              const chunk = signatureHex.substring(i, Math.min(i + chunkSize, signatureHex.length));
              const chunkValue = BigInt('0x' + chunk);
              // Shift left 4 bits per hex char
              result = result.multiply(BigInt(16).pow(BigInt(chunk.length))).add(chunkValue);
            }
            signatureValue = result;
          }
        } else {
          // If it's not a valid hex string, try to interpret it as decimal
          console.log('Signature not a valid hex string, treating as decimal');
          signatureValue = BigInt(signature);
        }
      } catch (sigError) {
        // If conversion fails, try more robust approach
        console.error('Error converting signature to BigInt:', sigError.message);
        
        // Try chunking with a simpler approach
        try {
          const signatureBuffer = Buffer.from(signature, 'hex');
          signatureValue = BigInt('0x' + signatureBuffer.toString('hex'));
          console.log('Converted signature using Buffer approach');
        } catch (bufferError) {
          console.error('Buffer conversion failed:', bufferError.message);
          
          // Last resort approach: try with node-forge's built-in BigInteger
          try {
            const forgeInt = new forge.jsbn.BigInteger(signature, 16);
            signatureValue = BigInt(forgeInt.toString());
            console.log('Converted signature using node-forge BigInteger');
          } catch (forgeError) {
            console.error('All conversion methods failed:', forgeError.message);
            return false;
          }
        }
      }
      
      // Calculate s^e mod n
      const calculated = signatureValue.modPow(e, n);
      
      // Convert message to BigInt - with proper error handling
      let messageValue;
      try {
        // First check if this is a hex string and handle the 0x prefix if present
        let messageHex = message;
        if (messageHex.startsWith('0x')) {
          messageHex = messageHex.substring(2);
        }
        
        if (/^[0-9a-fA-F]+$/.test(messageHex)) {
          try {
            // Try direct conversion first (without 0x prefix)
            messageValue = BigInt(messageHex);
          } catch (directError) {
            console.log('Direct conversion failed, trying alternative methods:', directError.message);
            
            try {
              // Try using the buffer method
              const msgBuffer = Buffer.from(messageHex, 'hex');
              messageValue = BigInt('0x' + msgBuffer.toString('hex'));
              console.log('Converted message using Buffer approach');
            } catch (bufferError) {
              console.log('Buffer conversion failed for message, using forge:', bufferError.message);
              
              // Try with node-forge
              const forgeMsgInt = new forge.jsbn.BigInteger(messageHex, 16);
              messageValue = BigInt(forgeMsgInt.toString());
              console.log('Converted message using node-forge BigInteger');
            }
          }
        } else {
          // If it's not already a hex hash, create one
          const messageHash = crypto.createHash('sha256').update(message).digest('hex');
          try {
            messageValue = BigInt(messageHash);
          } catch (hashError) {
            console.log('Hash conversion failed, using alternative method');
            messageValue = BigInt('0x' + messageHash);
          }
        }
      } catch (messageError) {
        console.error('Fatal error converting message to BigInt:', messageError);
        return false;
      }
      
      // Normalize message hash to modulus
      const normalizedMessage = messageValue.mod(n);
      
      // Normalize calculated value
      const normalizedCalculated = calculated.mod(n);
      
      // Convert to hex strings for comparison
      const messageHex = normalizedMessage.toString(16);
      const calculatedHex = normalizedCalculated.toString(16);
      
      console.log(`Message hash: ${messageHex.substring(0, 20)}...`);
      console.log(`Calculated: ${calculatedHex.substring(0, 20)}...`);
      
      // Compare normalized values
      const isValid = normalizedCalculated.equals(normalizedMessage);
      console.log(`Signature verification result: ${isValid ? 'VALID' : 'INVALID'}`);
      
      return isValid;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
  
  /**
   * Calculate the greatest common divisor of two numbers
   * @private
   * @param {BigInt} a - First number
   * @param {BigInt} b - Second number
   * @returns {BigInt} Greatest common divisor
   */
  static _gcd(a, b) {
    let x = BigInt(a);
    let y = BigInt(b);
    
    while (!y.equals(BigInt.zero)) {
      const temp = y;
      y = x.mod(y);
      x = temp;
    }
    
    return x;
  }
}

module.exports = BlindSignature;