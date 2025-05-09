// Import Node-Forge library correctly
import * as forgeLib from 'node-forge';
import CryptoJS from 'crypto-js';

/**
 * Sign data with RSA private key
 * @param {String} data - The data to sign
 * @param {String} privateKeyPem - Private key in PEM format
 * @returns {String} Base64-encoded signature
 */
export const signData = async (data, privateKeyPem) => {
  try {
    // Parse the private key
    const privateKey = forgeLib.pki.privateKeyFromPem(privateKeyPem);
    
    // Create SHA-256 digest and sign
    const md = forgeLib.md.sha256.create();
    md.update(data, 'utf8');
    const signature = privateKey.sign(md);
    
    // Base64 encode the signature
    const encodedSignature = forgeLib.util.encode64(signature);

    console.log('Created signature using RSA');
    console.log('Signature details:', {
      data,
      signatureLength: encodedSignature.length,
      first30Chars: encodedSignature.substring(0, 30),
    });

    return encodedSignature;
  } catch (error) {
    console.error('Error signing data:', error);
    throw error;
  }
};

/**
 * Generate a random blinding factor for blind signatures
 * @param {String} publicKeyPem - Authority's public key in PEM format
 * @returns {Object} Blinding factor (r) and its modular inverse (rInverse)
 */
export const generateBlindingFactor = (publicKeyPem) => {
  try {
    // Parse the public key to get the modulus n
    const publicKey = forgeLib.pki.publicKeyFromPem(publicKeyPem);
    const n = publicKey.n;
    
    // Generate a random number r such that gcd(r, n) = 1
    let r, rBigInt;
    do {
      r = forgeLib.random.getBytesSync(n.bitLength() / 8);
      rBigInt = new forgeLib.jsbn.BigInteger(forgeLib.util.bytesToHex(r), 16);
    } while (rBigInt.gcd(n).equals(forgeLib.jsbn.BigInteger.ONE) === false);
    
    // Calculate modular inverse of r (mod n)
    const rInverse = rBigInt.modInverse(n);
    
    // Return both for later use
    return {
      r: rBigInt.toString(16),
      rInverse: rInverse.toString(16)
    };
  } catch (error) {
    console.error('Error generating blinding factor:', error);
    throw error;
  }
};

/**
 * Blind a message for blind signature protocol
 * @param {String} message - Original message to be blinded
 * @param {String} rHex - Blinding factor in hexadecimal
 * @param {String} publicKeyPem - Authority's public key in PEM format
 * @returns {Object} Original hash and blinded message
 */
export const blindMessage = (message, rHex, publicKeyPem) => {
  try {
    // Create message hash
    const messageHash = CryptoJS.SHA256(message).toString();
    
    // Parse components
    const publicKey = forgeLib.pki.publicKeyFromPem(publicKeyPem);
    const n = publicKey.n;
    const e = publicKey.e;
    const r = new forgeLib.jsbn.BigInteger(rHex, 16);
    
    // Convert hash to BigInteger
    const messageBigInt = new forgeLib.jsbn.BigInteger(messageHash, 16);
    
    // Blind the message: m' = m * r^e mod n
    const rE = r.modPow(e, n);
    const blindedMessage = messageBigInt.multiply(rE).mod(n).toString(16);
    
    return {
      messageHash,
      blindedMessage
    };
  } catch (error) {
    console.error('Error blinding message:', error);
    throw error;
  }
};

/**
 * Unblinds a blind signature
 * @param {String} blindSignature - The blind signature from the authority
 * @param {String} rInverseHex - Inverse of blinding factor in hexadecimal
 * @param {String} publicKeyPem - Authority's public key in PEM format
 * @returns {String} The unblinded signature
 */
export const unblindSignature = (blindSignature, rInverseHex, publicKeyPem) => {
  try {
    // Parse components
    const publicKey = forgeLib.pki.publicKeyFromPem(publicKeyPem);
    const n = publicKey.n;
    const rInverse = new forgeLib.jsbn.BigInteger(rInverseHex, 16);
    const blindSigBigInt = new forgeLib.jsbn.BigInteger(blindSignature, 16);
    
    // Unblind: s = s' * r^-1 mod n
    const unblindedSignature = blindSigBigInt.multiply(rInverse).mod(n).toString(16);
    
    return unblindedSignature;
  } catch (error) {
    console.error('Error unblinding signature:', error);
    throw error;
  }
};

/**
 * Verify a blind signature
 * @param {String} message - The original message that was signed
 * @param {String} unblindedSignature - The unblinded signature
 * @param {String} publicKeyPem - Authority's public key in PEM format
 * @returns {Boolean} Whether the signature is valid
 */
export const verifyBlindSignature = (message, unblindedSignature, publicKeyPem) => {
  try {
    // Create message hash
    const messageHash = CryptoJS.SHA256(message).toString();
    
    // Parse components
    const publicKey = forgeLib.pki.publicKeyFromPem(publicKeyPem);
    const n = publicKey.n;
    const e = publicKey.e;
    
    // Parse signature to BigInteger
    const sigBigInt = new forgeLib.jsbn.BigInteger(unblindedSignature, 16);
    
    // Verify signature: s^e mod n = m
    const calculatedHash = sigBigInt.modPow(e, n).toString(16);
    
    // Convert message hash to same format for comparison
    const messageHashBigInt = new forgeLib.jsbn.BigInteger(messageHash, 16);
    const normalizedMessageHash = messageHashBigInt.mod(n).toString(16);
    
    return calculatedHash === normalizedMessageHash;
  } catch (error) {
    console.error('Error verifying blind signature:', error);
    return false;
  }
};