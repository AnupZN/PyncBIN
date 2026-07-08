/**
 * PyncBIN Secure Zero-Knowledge Cryptography Utils
 * Powered by standard Web Crypto API (AES-GCM 256)
 */

// Generate a random key (Base64URL safe)
export function generateRandomKey(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert Base64URL string back to a Uint8Array with proper padding restoration
export function base64UrlToBytes(base64url: string): Uint8Array {
  try {
    if (!base64url || typeof base64url !== "string") {
      return new Uint8Array(0);
    }
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return new Uint8Array(0);
  }
}

// Encrypt plaintext with an AES-256-GCM key
export async function encryptContent(text: string, keyB64: string): Promise<{ ciphertext: string; iv: string }> {
  try {
    const keyBytes = base64UrlToBytes(keyB64);

    // Import the raw bytes as an AES-GCM key
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Generate random IV (Initialization Vector) - 12 bytes is standard for GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(text);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      encodedData
    );

    // Encode ciphertext and IV to standard Base64
    const ciphertextB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
    const ivB64 = btoa(String.fromCharCode(...iv));

    return {
      ciphertext: ciphertextB64,
      iv: ivB64,
    };
  } catch (error: any) {
    console.warn("[Crypto] Encryption failed:", error?.message || error);
    throw new Error("Failed to encrypt content. Check cryptographic support.");
  }
}

// Decrypt ciphertext with an AES-256-GCM key and IV
export async function decryptContent(ciphertextB64: string, ivB64: string, keyB64: string): Promise<string> {
  try {
    const keyBytes = base64UrlToBytes(keyB64);

    // Import the raw bytes as an AES-GCM key
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Decode IV bytes from Base64
    let ivBytes: Uint8Array;
    try {
      const binaryIv = atob(ivB64);
      ivBytes = new Uint8Array(binaryIv.length);
      for (let i = 0; i < binaryIv.length; i++) {
        ivBytes[i] = binaryIv.charCodeAt(i);
      }
    } catch (e) {
      ivBytes = new Uint8Array(0);
    }

    // Decode ciphertext bytes from Base64
    let ciphertextBytes: Uint8Array;
    try {
      const binaryCipher = atob(ciphertextB64);
      ciphertextBytes = new Uint8Array(binaryCipher.length);
      for (let i = 0; i < binaryCipher.length; i++) {
        ciphertextBytes[i] = binaryCipher.charCodeAt(i);
      }
    } catch (e) {
      ciphertextBytes = new Uint8Array(0);
    }

    // Decrypt content
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
      },
      cryptoKey,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error: any) {
    console.warn("[Crypto] Decryption failed:", error?.message || error);
    throw new Error("Failed to decrypt content. This may be due to an incorrect secret key.");
  }
}

// Simple key derivation from user-provided password (PBKDF2 helper)
export async function deriveKeyFromPassword(password: string, saltB64: string = "PyncBINSaltValue"): Promise<string> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const saltBytes = enc.encode(saltB64);

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const rawKey = await window.crypto.subtle.exportKey("raw", derivedKey);
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
