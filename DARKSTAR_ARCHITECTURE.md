<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="220">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.9.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Angular-v21.0.8-dd0031?logo=angular" alt="Angular"/>
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/Tor-P2P-7D4698?logo=tor-browser" alt="Tor Network"/>
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go" alt="Go"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust" alt="Rust"/>
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

# Darkstar V2 Encryption & P2P Architecture

This document illustrates the internal workings of the Darkstar V2 Security System. It combines **Dynamic Structural Obfuscation**, **AES-256-CBC Encryption**, and a **Decentralized P2P Messaging Network** to create a comprehensive defense-grade security suite.

## 1. High-Level Workflow

The system transforms sensitive data into secure, multi-layered opaque blobs and enables anonymous communication.

```mermaid
graph TD
    User([User Input]) -->|Data + Password| Layers[Multi-Layer Protection]

    subgraph Layers [Security Gauntlet]
        Obf[Dynamic Obfuscation Pipeline]
        MemH[V2 Memory Hardening: Uint8Array]
        AES[AES-256-CBC Encryption]
        Safe[Electron SafeStorage: Hardware Binding]
    end

    Safe -->|Encrypted Payload| Storage[(Device Storage)]
    
    subgraph P2P [Anonymous Network]
        Id[Cryptographic Identity]
        Tor[Tor Hidden Service]
    end

    Storage -.->|Unlocks| Id
    Id -->|Sign Messages| Tor
    Tor -->|Receive & Verify| Id

    style User fill:#f9f,stroke:#333
    style Layers fill:#f8f9fa,stroke:#333
    style Safe fill:#bbf,stroke:#333
    style Obf fill:#bfb,stroke:#333
    style P2P fill:#e1f5fe,stroke:#333
```

---

## 2. The Core: Dynamic Obfuscation Pipeline (Mnemonic Engine)

Unlike standard encryption which applies a static algorithm, the Mnemonic Engine applies a **unique, chaotic sequence of transformations** to every single word.

### Per-Word Processing Logic

```mermaid
flowchart TD
    %% Nodes
    Start(Start: Word Input)
    SeedGen{Generate Seed}
    PRNG[Initialize Mulberry32 PRNG]

    DefaultList[Default Function List: 0..11]
    Shuffle[Shuffle List using Seed]
    ShuffledList[Result: 7, 2, 11, 4...]

    Checksum(Calculate Checksum)
    FinalSeed[Final Seed: Password + Checksum]

    Execute(Execute 12-Stage Gauntlet)
    Result(Final Obfuscated Blob)

    %% Connections
    Start --> SeedGen
    SeedGen -->|Password + Word| PRNG

    PRNG --> Shuffle
    DefaultList --> Shuffle
    Shuffle -->|Randomized| ShuffledList

    ShuffledList --> Checksum
    ShuffledList --> Execute

    Checksum --> FinalSeed
    FinalSeed -.-> Execute

    Execute --> Result

    style Start fill:#f9f,stroke:#333
    style SeedGen fill:#ff9,stroke:#333
    style Result fill:#f9f,stroke:#333
    style Shuffle fill:#ff9,stroke:#333
```

### The "Reverse Key"

Because the functions are shuffled randomly for every word, we must save the **order** in which they were applied to reverse the process tailored to that specific word.

**V2.1: Reverse Key Compression**
The reverse key is compressed using binary packing (4 bits per value), reducing the key size by ~75%.

---

## 3. V2 Memory Hardening (Uint8Array)

Darkstar implements a specialized memory hardening strategy to mitigate sensitive data residency in JavaScript's heap.

- **Strict Buffer Usage**: All encryption, decryption, and obfuscation operations now occur on `Uint8Array` rather than `string`.
- **Explicit Zeroing**: Sensitive buffers (passwords, intermediate states) are explicitly filled with zeros (`buffer.fill(0)`) immediately after their useful lifespan.
- **Async Web Crypto**: Leverages the browser's native `SubtleCrypto` for faster and more secure key derivation (PBKDF2) and AES operations.

---

## 4. Hardware-Bound Protection (Electron SafeStorage)

For Secure Vault data, Darkstar utilizes **Electron SafeStorage** to provide a final layer of protection that is bound to the user's host machine.

```mermaid
graph TD
    Data[JSON Notes] --> AES[AES-256 Master Password]
    AES --> Safe[Electron SafeStorage Layer]
    Safe -->|Machine Locked| File[localStorage]

    subgraph "OS Security Entropy"
        DPAPI[Windows DPAPI]
        KC[macOS Keychain]
        KWallet[Linux KWallet/Secret Service]
    end

    Safe -.-> DPAPI
    Safe -.-> KC
    Safe -.-> KWallet
```

**Benefits:**

- **Theft Resistance**: Even if the local storage database is stolen, it cannot be decrypted on any other machine or OS user account.
- **Offline Hardening**: Renders massive cracking clusters ineffective unless they have physical access to the device's hardware-backed security entropy.

---

## 5. Secure Vault: Zero-Knowledge Architecture

The Secure Vault is designed so that the application itself has "Zero Knowledge" of the user's secrets between sessions.

- **Session State**: The Master Key and decrypted notes are stored in Angular Signals (volatile memory) and are cleared on page reload or app close.
- **Multi-Factor Persistence**:
  1. **Something You Know**: Master Password (AES-256-CBC).
  2. **Something You Have**: The specific physical machine hardware (SafeStorage).

---

## 6. Structural Steganography (Stealth Export)

This optional layer allows encrypted blobs to be hidden inside common file formats as "noise" or "metadata" to provide plausible deniability. Supported formats include `.log`, `.csv`, and `.json`.

---

## 7. Decryption Flow (Mnemonic)

```mermaid
sequenceDiagram
    participant User
    participant App
    participant AES
    participant Deobfuscator

    User->>App: Input Output JSON + Password
    App->>App: Extract Salt & IV
    App->>AES: Decrypt(Data, Password, Salt, IV)
    AES-->>App: Base64 String
    App->>App: Decode Base64 -> Binary Blob

    loop For Each Word in Binary Blob
        App->>App: Read Length Header
        App->>App: Extract Word Chunk
        App->>App: Get Function Order from ReverseKey
        App->>Deobfuscator: Apply Functions in REVERSE order
        Deobfuscator-->>App: Original Word
    end

    App-->>User: "cat dog fish bird"
```

---

## 8. Anonymous P2P Messaging System

New in V1.8.3, Darkstar introduces a decentralized communication layer built on the Tor network, tightly integrated with the Secure Vault.

### 8.1 Cryptographic Identity Layer
Each vault automatically generates a unique **ECDSA P-256** keypair upon creation or migration.
- **Private Key**: Encrypted within the vault content; never leaves the secure enclave.
- **Public Key**: Exported as a JWK for sharing. Used as the user's cryptographic fingerprint.
- **Purpose**: All outgoing P2P messages are signed with the private key to ensure authenticity and non-repudiation.

### 8.2 Tor Hidden Service Integration
Darkstar bundles a managed Tor process to provide true anonymity.
- **Persistence**: Upon going online, the application creates a Long-Lived Tor Hidden Service.
- **Addressing**: Users are reachable via a unique `.onion` address (e.g., `v2...f4.onion`).
- **End-to-End Encryption**: Communication is encrypted by the Tor protocol and further secured by application-level signatures.

### 8.3 Security Enforcement: The "Vault Lock" Dependency
To prevent identity exposure and ensure message security, the P2P service is reactive to the Vault's state:
1. **Startup Requirement**: The P2P service cannot be started unless the Vault is unlocked.
2. **Emergency Shutdown**: If the Vault is locked (timer, duress, or manual logout), an Angular `effect` triggers an immediate shutdown of the Tor process and clears all messaging buffers from memory.
3. **Signature Verification**: Incoming messages are verified against the sender's public key in real-time using the **Web Crypto API**.

```mermaid
sequenceDiagram
    participant V as Vault (Unlocked)
    participant S as P2P Service
    participant T as Tor Manager
    participant N as Outer Network

    V->>S: Provide Private/Public Keys
    S->>T: Start Hidden Service
    T-->>S: Assign .onion Address
    S->>N: Broadcast Presence
    
    Note over S,N: Messaging Active
    
    V->>S: [EVENT] Vault Locked
    S->>T: Terminate Process Immediately
    S->>S: Purge Message Buffers
    T-->>N: Service Offline
```

---

## 9. Audio Steganography (WAV LSB)

V1.10 introduces the ability to hide encrypted payloads within audio files using Least Significant Bit (LSB) steganography.

### 9.1 The Process
1.  **Payload Preparation**: The encrypted blob is prefixed with a 32-bit length header.
2.  **Carrier Generation**:
    *   **Custom Cover**: If a user uploads a `.wav` file, its PCM data is used as the carrier.
    *   **White Noise**: If no cover is provided, the system generates random 16-bit PCM noise at -20dB.
3.  **LSB Injection**: The system iterates through the PCM samples, replacing the least significant bit of each 16-bit sample with a bit from the payload.
4.  **Result**: A playable `.wav` file that sounds like the original (or static noise) but contains the hidden data.

---

## 10. Hardware & Biometric Authentication

Darkstar now supports WebAuthn for unlocking the vault, allowing for passwordless entry via:
1.  **Platform Authenticators**: Windows Hello (Face/Fingerprint), TouchID.
2.  **Cross-Platform Authenticators**: YubiKeys, Solokeys (FIDO2/U2F).

**Security Model:**
*   The **Master Password** is not replaced but *wrapped*.
*   When "Registering" biometrics, the Master Password is encrypted using `Electron SafeStorage` (OS-level key).
*   The `SafeStorage` blob is stored locally.
*   **Authentication Flow**:
    1.  User proves presence/identity via WebAuthn (Biometric/YubiKey).
    2.  If successful, the app requests `SafeStorage` to decrypt the stored Master Password blob.
    3.  The decrypted password is then used to unlock the AESVault.
*   **Safety**: This ensures that even if the local storage is dumped, the biometrically protected password cannot be retrieved without the physical device AND the user's biometric authorization.

---

## 11. P2P File Transfer ("DarkDrop") & Reputation

### 11.1 DarkDrop Protocol
Files are too large to send as single JSON payloads over Tor. DarkDrop implements a chunked streaming protocol:
1.  **FILE_START**: Metadata (Name, Size, ID) sent to Receiver. Receiver opens a write stream.
2.  **FILE_CHUNK**: 16KB Base64-encoded chunks sent sequentially.
3.  **FILE_END**: Signals completion. Receiver closes stream.

**Security**:
*   **Path Sanitization**: Filenames are strictly sanitized (`path.basename`) to prevent Directory Traversal attacks.
*   **Consent**: Transfers currently auto-accept from *Trusted* peers (future improvement: manual accept).

### 11.2 Decentralized Reputation (Trust Graph)
A localized "Web of Trust" stored entirely within the encrypted vault.
*   **Trust Score**: 0 (Untrusted) to 100 (Trusted).
*   **Storage**: `VaultTrustNode` objects in the vault JSON.
*   **Visual Indicators**: The UI displays trust badges (Shield icons) based on the local score, helping users distinguish verified contacts from strangers.
