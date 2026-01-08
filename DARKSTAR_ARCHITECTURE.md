<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="220">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Angular-v20.3.0-dd0031?logo=angular" alt="Angular"/>
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go" alt="Go"/>
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust" alt="Rust"/>
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

# Darkstar V2 Encryption Architecture

This document illustrates the internal workings of the Darkstar V2 Encryption System. It combines **Dynamic Structural Obfuscation** with standard **AES-256-CBC** to create a defense-grade security layer for mnemonic phrases.

## 1. High-Level Workflow

The system transforms a readable mnemonic into a secure, opaque JSON blob.

```mermaid
graph LR
    User([User Input]) -->|Mnemonic + Password| Split(Split Words)
    Split -->|Word 1| Pipeline[Dynamic Obfuscation Pipeline]
    Split -->|Word 2| Pipeline
    Split -->|Word N| Pipeline
    
    Pipeline -->|Obfuscated Bytes| Assembler(Blob Assembly)
    Assembler -->|Binary Blob| Base64[Base64 Encoding]
    Base64 -->|Payload| AES[AES-256-CBC Encryption]
    AES -->|Encrypted Data| JSON[Final JSON Output]
    
    style User fill:#f9f,stroke:#333
    style AES fill:#bbf,stroke:#333
    style Pipeline fill:#bfb,stroke:#333
    
    %% Spacing Fixes
    linkStyle default interpolate basis
```

---

## 2. The Core: Dynamic Obfuscation Pipeline

Unlike standard encryption which applies a static algorithm, Darkstar V2 applies a **unique, chaotic sequence of transformations** to every single word. The order of these transformations is determined by the data itself.

### Per-Word Processing Logic

```mermaid
flowchart TD
    Start(Start Word) --> SeedGen{Generate Seed}
    SeedGen -->|Seed = Password + Word| PRNG[Initialize Mulberry32 PRNG]
    
    PRNG --> Shuffle[Shuffle Function List]
    
    subgraph "Function Selection (The Shuffle)"
        direction TB
        List[Default List: 0,1,2...11]
        Shuffle -->|Randomized| NewList[Shuffled: 7,2,11,4...]
    end
    
    NewList --> Checksum(Calculate Checksum)
    Checksum -->|New Seed Component| CombinedSeed[Final Seed: Password + Checksum]
    
    NewList --> Loop(Execute Functions in Order)
    
    subgraph "The Gauntlet (12 Layers)"
        direction TB
        Loop --> F1["Function 1 (e.g. Shuffle)"]
        F1 --> F2["Function 2 (e.g. XOR)"]
        F2 --> F...["..."]
        F... --> F12["Function 12 (e.g. Binary)"]
    end
    
    F12 --> Result(Obfuscated Word Blob)
    
    style SeedGen fill:#ff9,stroke:#333
    style Shuffle fill:#ff9,stroke:#333

    %% Spacing adjustments
    classDef spaced padding:20px;
```

### The "Reverse Key"
Because the functions are shuffled randomly for every word, we must save the **order** in which they were applied to reverse the process tailored to that specific word.

**New in V2.1: Reverse Key Compression**
To improve efficiency, the reverse key (a sequence of integers) is now compressed using binary packing (4 bits per value) instead of plain JSON. This reduces the key size by ~75%.

```mermaid
classDiagram
    class EncryptedPackage {
        +Version: 2
        +Data: AES_Encrypted_String
        +ReverseKey: Packed_Binary_Base64
    }
    
    class ReverseKeyMap {
        +Word1: [7, 2, 11, 4, ...]
        +Word2: [1, 5, 9, 0, ...]
        +WordN: [3, 8, 12, 6, ...]
    }
    
    EncryptedPackage --> ReverseKeyMap : Encodes (Compressed)
```

---

## 3. The 12 Obfuscation Layers

Each word passes through all 12 of these layers. Some are structural (changing the format), some are entropic (increasing noise).

| Type | Function | Visual Effect |
| :--- | :--- | :--- |
| **Structure** | `ObfuscateToBinary` | `A` -> `01000001` |
| **Structure** | `ObfuscateToCharCodes` | `A` -> `65` |
| **Cipher** | `AtbashCipher` | `A` -> `Z` |
| **Cipher** | `CaesarCipher` | `A` -> `N` (ROT13) |
| **Cipher** | `VigenereCipher` | Uses seed to shift values |
| **Chaos** | `Shuffle` | Randomizes byte positions |
| **Chaos** | `Interleave` | Injects random noise characters |
| **Chaos** | `BlockReversal` | Flips chunks of data |
| **Chaos** | `SwapAdjacent` | Swaps neighbors `AB` -> `BA` |
| **Bitwise** | `XOR` | Flips bits using seed |
| **Substitution** | `SeededSubstitution` | Maps bytes to new values |
| **Simple** | `Reverse` | Reverses the entire array |

---

## 4. Final Data Assembly

Once obfuscated, the data isn't just concatenated. It's packed into a structured binary format before encryption.

```mermaid
erDiagram
    FINAL_BLOB {
        byte Length_High
        byte Length_Low
        bytes Obfuscated_Word_Data
    }
    
    FINAL_BLOB ||--o{ WORD_1 : contains
    FINAL_BLOB ||--o{ WORD_2 : contains
```

**Example Binary Structure:**
`[00 05 HELLO] [00 05 WORLD]`

1. **Pack**: All words are packed into this binary stream.
2. **Encode**: The stream is Base64 encoded.
3. **Encrypt**: The Base64 string is encrypted via **AES-256-CBC**.
    - **Key**: Derived from Password + Random Salt (PBKDF2).
    - **IV**: Random 16 bytes.
4. **Output**: `Salt (Hex) + IV (Hex) + Ciphertext (Base64)`

---

## 5. Structural Steganography (Stealth Export)

New in V2.1, this optional layer allows the encrypted blob to be hidden inside common file formats to provide plausible deniability.

```mermaid
graph TD
    EncryptedBlob[Standard Encrypted Blob] --> Transmuter{Stego Transmuter}
    
    Transmuter -->|Mode: Log| LogFile[System.log]
    Transmuter -->|Mode: CSV| CsvFile[SensorData.csv]
    Transmuter -->|Mode: JSON| JsonFile[Config.json]
    
    subgraph "Mimicry Generation"
        LogFile -- Contains --> FakeEntries[Fake Errors/Warnings]
        CsvFile -- Contains --> FakeData[Fake Sensor Readings]
        JsonFile -- Contains --> FakeConfig[Fake App Settings]
    end
    
    FakeEntries -. Hides .-> EncryptedBlob
    FakeData -. Hides .-> EncryptedBlob
    FakeConfig -. Hides .-> EncryptedBlob
    
    style Transmuter fill:#f96,stroke:#333
    classDef spaced padding:20px;
```

**Mechanisms:**
- **Logs**: Payload is split and appended to realistic-looking log lines as "error codes" or "trace IDs".
- **CSV**: Payload is injected into a specific "hash" or "comment" column amidst generated sensor data.
- **JSON**: Payload is distributed across multiple deep fields (e.g., `telemetry.id`, `cache.hash`) in a generated configuration file.

---

## 5. Decryption Flow

Reversing the process requires the `ReverseKey`.

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
