use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

const STORAGE_FILE: &str = "secure_credentials.enc";

#[derive(Debug, thiserror::Error)]
pub enum SecureStorageError {
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Credential not found for key: {0}")]
    NotFound(String),
}

impl Serialize for SecureStorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub struct SecureStorage {
    storage_path: PathBuf,
    cache: Mutex<HashMap<String, String>>,
    encryption_key: [u8; 32],
}

impl SecureStorage {
    pub fn new(app_data_dir: PathBuf) -> Self {
        // Generate encryption key from machine-specific data
        // In production, you might want to use a more sophisticated key derivation
        let machine_id = whoami::devicename();
        let mut hasher = Sha256::new();
        hasher.update(machine_id.as_bytes());
        hasher.update(b"com.assistant.app.secret"); // App-specific salt
        let hash = hasher.finalize();

        let mut key = [0u8; 32];
        key.copy_from_slice(&hash[..]);

        Self {
            storage_path: app_data_dir.join(STORAGE_FILE),
            cache: Mutex::new(HashMap::new()),
            encryption_key: key,
        }
    }

    fn load_credentials(&self) -> Result<HashMap<String, String>, SecureStorageError> {
        if !self.storage_path.exists() {
            return Ok(HashMap::new());
        }

        let encrypted_data = fs::read(&self.storage_path)?;
        if encrypted_data.is_empty() {
            return Ok(HashMap::new());
        }

        // Decrypt
        let cipher = Aes256Gcm::new((&self.encryption_key).into());

        // First 12 bytes are nonce
        if encrypted_data.len() < 12 {
            return Ok(HashMap::new());
        }

        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let decrypted = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| SecureStorageError::Encryption(format!("Decryption failed: {}", e)))?;

        let credentials: HashMap<String, String> = serde_json::from_slice(&decrypted)?;
        Ok(credentials)
    }

    fn save_credentials(&self, credentials: &HashMap<String, String>) -> Result<(), SecureStorageError> {
        // Serialize
        let json_data = serde_json::to_vec(credentials)?;

        // Encrypt
        let cipher = Aes256Gcm::new((&self.encryption_key).into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, json_data.as_ref())
            .map_err(|e| SecureStorageError::Encryption(format!("Encryption failed: {}", e)))?;

        // Prepend nonce to ciphertext
        let mut encrypted_data = nonce.to_vec();
        encrypted_data.extend_from_slice(&ciphertext);

        // Ensure directory exists
        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&self.storage_path, encrypted_data)?;
        Ok(())
    }

    pub fn set_credential(&self, key: &str, value: &str) -> Result<(), SecureStorageError> {
        let mut credentials = self.load_credentials()?;
        credentials.insert(key.to_string(), value.to_string());
        self.save_credentials(&credentials)?;

        // Update cache
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(key.to_string(), value.to_string());
        }

        Ok(())
    }

    pub fn get_credential(&self, key: &str) -> Result<String, SecureStorageError> {
        // Try cache first
        if let Ok(cache) = self.cache.lock() {
            if let Some(value) = cache.get(key) {
                return Ok(value.clone());
            }
        }

        // Load from file
        let credentials = self.load_credentials()?;
        match credentials.get(key) {
            Some(value) => {
                // Update cache
                if let Ok(mut cache) = self.cache.lock() {
                    cache.insert(key.to_string(), value.clone());
                }
                Ok(value.clone())
            }
            None => Err(SecureStorageError::NotFound(key.to_string())),
        }
    }

    pub fn delete_credential(&self, key: &str) -> Result<(), SecureStorageError> {
        let mut credentials = self.load_credentials()?;
        credentials.remove(key);
        self.save_credentials(&credentials)?;

        // Remove from cache
        if let Ok(mut cache) = self.cache.lock() {
            cache.remove(key);
        }

        Ok(())
    }

    pub fn has_credential(&self, key: &str) -> bool {
        // Check cache first
        if let Ok(cache) = self.cache.lock() {
            if cache.contains_key(key) {
                return true;
            }
        }

        // Check file
        if let Ok(credentials) = self.load_credentials() {
            credentials.contains_key(key)
        } else {
            false
        }
    }
}

// Tauri Commands

#[tauri::command]
pub fn secure_storage_set(
    storage: State<'_, SecureStorage>,
    key: String,
    value: String,
) -> Result<(), SecureStorageError> {
    storage.set_credential(&key, &value)
}

#[tauri::command]
pub fn secure_storage_get(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<String, SecureStorageError> {
    storage.get_credential(&key)
}

#[tauri::command]
pub fn secure_storage_delete(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<(), SecureStorageError> {
    storage.delete_credential(&key)
}

#[tauri::command]
pub fn secure_storage_has(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<bool, SecureStorageError> {
    Ok(storage.has_credential(&key))
}

/// Store multiple provider API keys at once
#[tauri::command]
pub fn secure_storage_set_provider_keys(
    storage: State<'_, SecureStorage>,
    provider_keys: HashMap<String, String>,
) -> Result<(), SecureStorageError> {
    for (provider_uuid, api_key) in &provider_keys {
        let key = format!("provider_{}", provider_uuid);
        storage.set_credential(&key, api_key)?;
    }
    Ok(())
}

/// Get all provider API keys
#[tauri::command]
pub fn secure_storage_get_provider_keys(
    storage: State<'_, SecureStorage>,
    provider_uuids: Vec<String>,
) -> Result<HashMap<String, String>, SecureStorageError> {
    let mut result = HashMap::new();

    for uuid in &provider_uuids {
        let key = format!("provider_{}", uuid);
        if let Ok(api_key) = storage.get_credential(&key) {
            result.insert(uuid.clone(), api_key);
        }
    }

    Ok(result)
}
