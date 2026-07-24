package com.sofilink.messenger.crypto

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Security
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.jce.provider.BouncyCastleProvider

class CryptoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val secureRandom = SecureRandom()

  override fun getName(): String = "SofiLinkCrypto"

  @ReactMethod
  fun generateKeyPair(promise: Promise) {
    try {
      Security.removeProvider("BC")
      Security.addProvider(BouncyCastleProvider())
      val kpg = KeyPairGenerator.getInstance("Ed25519", "BC")
      val keyPair = kpg.generateKeyPair()
      val result = Arguments.createMap()
      result.putString("publicKey", bytesToHex(keyPair.public.encoded))
      result.putString("secretKey", bytesToHex(keyPair.private.encoded))
      promise.resolve(result)
    } catch (e: Exception) {
      try {
        val kpg = KeyPairGenerator.getInstance("Ed25519")
        val keyPair = kpg.generateKeyPair()
        val result = Arguments.createMap()
        result.putString("publicKey", bytesToHex(keyPair.public.encoded))
        result.putString("secretKey", bytesToHex(keyPair.private.encoded))
        promise.resolve(result)
      } catch (e2: Exception) {
        promise.reject("KEYPAIR_FAILED", e2.message, e2)
      }
    }
  }

  @ReactMethod
  fun encrypt(plaintextHex: String, keyHex: String, promise: Promise) {
    try {
      val keyBytes = hexToBytes(keyHex)
      val plaintext = hexToBytes(plaintextHex)
      val nonce = ByteArray(12)
      secureRandom.nextBytes(nonce)

      val keySpec = SecretKeySpec(keyBytes, "ChaCha20")
      val cipher = Cipher.getInstance("ChaCha20-Poly1305/None/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, keySpec, IvParameterSpec(nonce))

      val ciphertext = cipher.doFinal(plaintext)

      val result = Arguments.createMap()
      result.putString("ciphertext", bytesToHex(ciphertext))
      result.putString("nonce", bytesToHex(nonce))
      promise.resolve(result)
    } catch (e: Exception) {
      Log.e("SofiLink/Crypto", "Encrypt failed", e)
      promise.reject("ENCRYPT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun decrypt(ciphertextHex: String, nonceHex: String, keyHex: String, promise: Promise) {
    try {
      val keyBytes = hexToBytes(keyHex)
      val nonce = hexToBytes(nonceHex)
      val ciphertext = hexToBytes(ciphertextHex)

      val keySpec = SecretKeySpec(keyBytes, "ChaCha20")
      val cipher = Cipher.getInstance("ChaCha20-Poly1305/None/NoPadding")

      // ChaCha20-Poly1305 stores tag at end of ciphertext
      val decryptNonce = if (nonce.size == 12) nonce else nonce.copyOfRange(0, 12)
      cipher.init(Cipher.DECRYPT_MODE, keySpec, IvParameterSpec(decryptNonce))

      val decrypted = cipher.doFinal(ciphertext)
      promise.resolve(String(decrypted, Charsets.UTF_8))
    } catch (e: Exception) {
      Log.e("SofiLink/Crypto", "Decrypt failed", e)
      promise.reject("DECRYPT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun generateNonce(promise: Promise) {
    try {
      val nonce = ByteArray(12)
      secureRandom.nextBytes(nonce)
      promise.resolve(bytesToHex(nonce))
    } catch (e: Exception) {
      promise.reject("NONCE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun deriveKey(password: String, saltHex: String, promise: Promise) {
    try {
      val salt = hexToBytes(saltHex)
      // PBKDF2-HMAC-SHA256 as lightweight key derivation
      val key = ByteArray(32)
      val spec = javax.crypto.spec.PBEKeySpec(password.toCharArray(), salt, 100000, 256)
      val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      val derived = factory.generateSecret(spec)
      System.arraycopy(derived.encoded, 0, key, 0, 32)
      promise.resolve(bytesToHex(key))
    } catch (e: Exception) {
      Log.e("SofiLink/Crypto", "Derive failed", e)
      promise.reject("DERIVE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun sha256(dataHex: String, promise: Promise) {
    try {
      val data = hexToBytes(dataHex)
      val digest = MessageDigest.getInstance("SHA-256")
      val hash = digest.digest(data)
      promise.resolve(bytesToHex(hash))
    } catch (e: Exception) {
      promise.reject("SHA256_FAILED", e.message, e)
    }
  }

  private fun bytesToHex(bytes: ByteArray): String {
    return bytes.joinToString("") { "%02x".format(it) }
  }

  private fun hexToBytes(hex: String): ByteArray {
    val len = hex.length / 2
    val bytes = ByteArray(len)
    for (i in 0 until len) {
      bytes[i] = ((Character.digit(hex[i * 2], 16) shl 4)
        + Character.digit(hex[i * 2 + 1], 16)).toByte()
    }
    return bytes
  }
}
