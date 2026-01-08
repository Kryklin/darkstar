// Package main implements the Darkstar V2 encryption scheme.
//
// Features:
// - 12-layer dynamic obfuscation pipeline
// - Mulberry32 deterministic PRNG
// - AES-256-CBC encryption with PBKDF2 key derivation
// - Self-validating checksums
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

const (
	ITERATIONS_V2   = 600000
	KEY_SIZE        = 32
	SALT_SIZE_BYTES = 16
	IV_SIZE_BYTES   = 16
)

// --- PRNG ---

type Mulberry32 struct {
	state uint32
}

func NewMulberry32(seedStr string) *Mulberry32 {
	m := &Mulberry32{}
	m.seed(seedStr)
	return m
}

func (m *Mulberry32) seed(seedStr string) {
	var h uint32 = 0
	for _, char := range seedStr {
		code := uint32(char)
		h = (h ^ code)
		h = h * 3432918353
		h = (h << 13) | (h >> 19)
	}
	h = (h ^ (h >> 16))
	h = h * 2246822507
	h = (h ^ (h >> 13))
	h = h * 3266489909
	h = (h ^ (h >> 16))
	m.state = h
}

func (m *Mulberry32) Next() float64 {
	m.state = (m.state + 0x6d2b79f5)
	t := (m.state ^ (m.state >> 15))
	t = (t * (1 | m.state))
	term2 := (t ^ (t >> 7))
	term2 = (term2 * (61 | t))
	t = (t + term2) ^ t

	res := (t ^ (t >> 14))
	return float64(res) / 4294967296.0
}

// --- DarkstarCrypt ---

type DarkstarCrypt struct {
	obfuscationFunctionsV2   []func([]byte, []byte, func(string) *Mulberry32) []byte
	deobfuscationFunctionsV2 []func([]byte, []byte, func(string) *Mulberry32) []byte
}

// NewDarkstarCrypt creates a new instance of DarkstarCrypt with initialized functions.
func NewDarkstarCrypt() *DarkstarCrypt {
	dc := &DarkstarCrypt{}
	dc.obfuscationFunctionsV2 = []func([]byte, []byte, func(string) *Mulberry32) []byte{
		dc.obfuscateByReversingV2,
		dc.obfuscateWithAtbashCipherV2,
		dc.obfuscateToCharCodesV2,
		dc.obfuscateToBinaryV2,
		dc.obfuscateWithCaesarCipherV2,
		dc.obfuscateBySwappingAdjacentBytesV2,
		dc.obfuscateByShufflingV2,
		dc.obfuscateWithXORV2,
		dc.obfuscateByInterleavingV2,
		dc.obfuscateWithVigenereCipherV2,
		dc.obfuscateWithSeededBlockReversalV2,
		dc.obfuscateWithSeededSubstitutionV2,
	}
	dc.deobfuscationFunctionsV2 = []func([]byte, []byte, func(string) *Mulberry32) []byte{
		dc.deobfuscateByReversingV2,
		dc.deobfuscateWithAtbashCipherV2,
		dc.deobfuscateFromCharCodesV2,
		dc.deobfuscateFromBinaryV2,
		dc.deobfuscateWithCaesarCipherV2,
		dc.deobfuscateBySwappingAdjacentBytesV2,
		dc.deobfuscateByShufflingV2,
		dc.deobfuscateWithXORV2,
		dc.deobfuscateByDeinterleavingV2,
		dc.deobfuscateWithVigenereCipherV2,
		dc.deobfuscateWithSeededBlockReversalV2,
		dc.deobfuscateWithSeededSubstitutionV2,
	}
	return dc
}

// --- Helpers ---

func generateChecksum(numbers []int) int {
	if len(numbers) == 0 {
		return 0
	}
	sum := 0
	for _, n := range numbers {
		sum += n
	}
	return sum % 997
}

// --- Obfuscation Functions (V2) ---

func (dc *DarkstarCrypt) obfuscateByReversingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		output[len(input)-1-i] = b
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateByReversingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateByReversingV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateWithAtbashCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		if b >= 65 && b <= 90 {
			output[i] = 90 - (b - 65)
		} else if b >= 97 && b <= 122 {
			output[i] = 122 - (b - 97)
		} else {
			output[i] = b
		}
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateWithAtbashCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateWithAtbashCipherV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateToCharCodesV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	var parts []byte
	for i, b := range input {
		if i > 0 {
			parts = append(parts, 44) // comma
		}
		strVal := strconv.Itoa(int(b))
		parts = append(parts, []byte(strVal)...)
	}
	return parts
}

func (dc *DarkstarCrypt) deobfuscateFromCharCodesV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	s := string(input)
	if s == "" {
		return []byte{}
	}
	parts := strings.Split(s, ",")
	output := make([]byte, 0, len(parts))
	for _, p := range parts {
		if p == "" {
			continue
		}
		num, err := strconv.Atoi(p)
		if err == nil {
			output = append(output, byte(num))
		}
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateToBinaryV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	var parts []byte
	for i, b := range input {
		if i > 0 {
			parts = append(parts, 44) // comma
		}
		strVal := strconv.FormatInt(int64(b), 2)
		parts = append(parts, []byte(strVal)...)
	}
	return parts
}

func (dc *DarkstarCrypt) deobfuscateFromBinaryV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	s := string(input)
	if s == "" {
		return []byte{}
	}
	parts := strings.Split(s, ",")
	output := make([]byte, 0, len(parts))
	for _, p := range parts {
		if p == "" {
			continue
		}
		num, err := strconv.ParseInt(p, 2, 64)
		if err == nil {
			output = append(output, byte(num))
		}
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithCaesarCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		if b >= 65 && b <= 90 {
			output[i] = ((b - 65 + 13) % 26) + 65
		} else if b >= 97 && b <= 122 {
			output[i] = ((b - 97 + 13) % 26) + 97
		} else {
			output[i] = b
		}
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateWithCaesarCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateWithCaesarCipherV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateBySwappingAdjacentBytesV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	copy(output, input)
	for i := 0; i < len(output)-1; i += 2 {
		output[i], output[i+1] = output[i+1], output[i]
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateBySwappingAdjacentBytesV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateBySwappingAdjacentBytesV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateByShufflingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	copy(output, input)
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := len(output) - 1; i > 0; i-- {
		randVal := rng.Next()
		j := int(randVal * float64(i+1))
		output[i], output[j] = output[j], output[i]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateByShufflingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	n := len(input)
	indices := make([]int, n)
	for i := 0; i < n; i++ {
		indices[i] = i
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := n - 1; i > 0; i-- {
		randVal := rng.Next()
		j := int(randVal * float64(i+1))
		indices[i], indices[j] = indices[j], indices[i]
	}
	output := make([]byte, n)
	for i := 0; i < n; i++ {
		output[indices[i]] = input[i]
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithXORV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		output[i] = b ^ seed[i%len(seed)]
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateWithXORV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateWithXORV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateByInterleavingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	randomChars := "abcdefghijklmnopqrstuvwxyz0123456789"
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	output := make([]byte, len(input)*2)
	for i, b := range input {
		output[i*2] = b
		randIdx := int(rng.Next() * float64(len(randomChars)))
		output[i*2+1] = randomChars[randIdx]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateByDeinterleavingV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	output := make([]byte, len(input)/2)
	for i := 0; i < len(input); i += 2 {
		output[i/2] = input[i]
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithVigenereCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	var parts []byte
	for i, b := range input {
		if i > 0 {
			parts = append(parts, byte(44))
		}
		keyCode := seed[i%len(seed)]
		val := int(b) + int(keyCode) // Can exceed 255? JS: input[i] + seed... result is string.
		valStr := strconv.Itoa(val)
		parts = append(parts, []byte(valStr)...)
	}
	return parts
}

func (dc *DarkstarCrypt) deobfuscateWithVigenereCipherV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	s := string(input)
	if s == "" {
		return []byte{}
	}
	parts := strings.Split(s, ",")
	output := make([]byte, 0, len(parts))
	for i, p := range parts {
		if p == "" {
			continue
		}
		val, err := strconv.Atoi(p)
		if err == nil {
			keyCode := seed[i%len(seed)]
			output = append(output, byte(val-int(keyCode)))
		}
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithSeededBlockReversalV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	blockSize := int(rng.Next()*float64(len(input)/2)) + 2
	output := make([]byte, 0, len(input))
	for i := 0; i < len(input); i += blockSize {
		end := i + blockSize
		if end > len(input) {
			end = len(input)
		}
		chunk := make([]byte, end-i)
		copy(chunk, input[i:end])
		// reverse chunk
		for k, l := 0, len(chunk)-1; k < l; k, l = k+1, l-1 {
			chunk[k], chunk[l] = chunk[l], chunk[k]
		}
		output = append(output, chunk...)
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateWithSeededBlockReversalV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	return dc.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateWithSeededSubstitutionV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	chars := make([]byte, 256)
	for i := 0; i < 256; i++ {
		chars[i] = byte(i)
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := 255; i > 0; i-- {
		j := int(rng.Next() * float64(i+1))
		chars[i], chars[j] = chars[j], chars[i]
	}
	output := make([]byte, len(input))
	for i, b := range input {
		output[i] = chars[b]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateWithSeededSubstitutionV2(input []byte, seed []byte, prngFactory func(string) *Mulberry32) []byte {
	chars := make([]byte, 256)
	for i := 0; i < 256; i++ {
		chars[i] = byte(i)
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := 255; i > 0; i-- {
		j := int(rng.Next() * float64(i+1))
		chars[i], chars[j] = chars[j], chars[i]
	}
	unsubMap := make([]byte, 256)
	for i := 0; i < 256; i++ {
		unsubMap[chars[i]] = byte(i)
	}
	output := make([]byte, len(input))
	for i, b := range input {
		output[i] = unsubMap[b]
	}
	return output
}

// --- Encrypt/Decrypt ---

// Encrypt encrypts the mnemonic using the password and the V2 obfuscation scheme.
func (dc *DarkstarCrypt) Encrypt(mnemonic, password string) (map[string]interface{}, error) {
	words := strings.Split(mnemonic, " ")
	var obfuscatedWords [][]byte
	var reverseKey [][]int

	passwordBytes := []byte(password)
	prngFactory := func(s string) *Mulberry32 {
		return NewMulberry32(s)
	}

	for _, word := range words {
		currentWordBytes := []byte(word)

		selectedFunctions := make([]int, 12)
		for i := 0; i < 12; i++ {
			selectedFunctions[i] = i
		}

		// Shuffle functions using password + word as seed
		seedForSelection := password + word
		rngSel := prngFactory(seedForSelection)
		for i := 11; i > 0; i-- {
			j := int(rngSel.Next() * float64(i+1))
			selectedFunctions[i], selectedFunctions[j] = selectedFunctions[j], selectedFunctions[i]
		}

		checksum := generateChecksum(selectedFunctions)
		checksumBytes := []byte(strconv.Itoa(checksum))
		combinedSeed := append(append([]byte{}, passwordBytes...), checksumBytes...)

		var wordReverseKey []int

		for _, funcIndex := range selectedFunctions {
			isSeeded := funcIndex >= 6
			var seed []byte
			if isSeeded {
				seed = combinedSeed
			}

			// Apply correct function
			f := dc.obfuscationFunctionsV2[funcIndex]
			currentWordBytes = f(currentWordBytes, seed, prngFactory)
			wordReverseKey = append(wordReverseKey, funcIndex)
		}
		obfuscatedWords = append(obfuscatedWords, currentWordBytes)
		reverseKey = append(reverseKey, wordReverseKey)
	}

	// Construct final blob
	totalLen := 0
	for _, wb := range obfuscatedWords {
		totalLen += 2 + len(wb)
	}
	finalBlob := make([]byte, 0, totalLen)
	for _, wb := range obfuscatedWords {
		l := len(wb)
		finalBlob = append(finalBlob, byte((l>>8)&0xff), byte(l&0xff))
		finalBlob = append(finalBlob, wb...)
	}

	// Base64 encode for AES
	base64Content := base64.StdEncoding.EncodeToString(finalBlob)

	// AES Encrypt
	encryptedContent, err := dc.encryptAES256(base64Content, password, ITERATIONS_V2)
	if err != nil {
		return nil, err
	}

	// Reverse Key serialization (Packed)
	encodedReverseKey, err := dc.packReverseKey(reverseKey)
	if err != nil {
		return nil, err
	}

	// Construct result structure
	resultObj := map[string]interface{}{
		"v":    2,
		"data": encryptedContent,
	}

	resultJSON, err := json.Marshal(resultObj)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"encryptedData": string(resultJSON),
		"reverseKey":    encodedReverseKey,
	}, nil
}

// Decrypt decrypts the encrypted data using the reverse key and password.
func (dc *DarkstarCrypt) Decrypt(encryptedDataRaw, reverseKeyB64, password string) (string, error) {
	// 1. Decode Reverse Key
	rkBytes, err := base64.StdEncoding.DecodeString(reverseKeyB64)
	if err != nil {
		return "", errors.New("invalid reverse key base64")
	}

	var reverseKey [][]int
	// Try JSON first (Legacy)
	if err := json.Unmarshal(rkBytes, &reverseKey); err != nil {
		// Not JSON, try Packed (V2 Compressed)
		reverseKey, err = dc.unpackReverseKey(reverseKeyB64)
		if err != nil {
			return "", errors.New("invalid reverse key format (json or packed)")
		}
	}

	// 2. Parse encrypted data
	var encryptedContent string
	var parsed map[string]interface{}
	// Check if JSON
	if err := json.Unmarshal([]byte(encryptedDataRaw), &parsed); err == nil {
		if v, ok := parsed["v"].(float64); ok && v == 2 {
			if data, ok := parsed["data"].(string); ok {
				encryptedContent = data
			}
		}
	}
	if encryptedContent == "" {
		encryptedContent = encryptedDataRaw // Fallback or direct string
	}

	// 3. AES Decrypt
	decryptedBase64Bytes, err := dc.decryptAES256(encryptedContent, password, ITERATIONS_V2)
	if err != nil {
		return "", fmt.Errorf("aes decryption failed: %v", err)
	}

	// 4. Decode Base64 Blob
	binaryString, err := base64.StdEncoding.DecodeString(string(decryptedBase64Bytes))
	if err != nil {
		return "", errors.New("failed to decode inner base64 blob")
	}
	fullBlob := binaryString

	var deobfuscatedWords []string
	passwordBytes := []byte(password)
	prngFactory := func(s string) *Mulberry32 { return NewMulberry32(s) }

	offset := 0
	wordIndex := 0

	for offset < len(fullBlob) {
		if wordIndex >= len(reverseKey) {
			break
		}
		if offset+2 > len(fullBlob) {
			break
		}
		// Length
		length := (int(fullBlob[offset]) << 8) | int(fullBlob[offset+1])
		offset += 2
		if offset+length > len(fullBlob) {
			break
		}
		currentWordBytes := fullBlob[offset : offset+length]
		offset += length

		// Deobfuscate
		wordReverseList := reverseKey[wordIndex]
		checksum := generateChecksum(wordReverseList)
		checksumBytes := []byte(strconv.Itoa(checksum))
		combinedSeed := append(append([]byte{}, passwordBytes...), checksumBytes...)

		for j := len(wordReverseList) - 1; j >= 0; j-- {
			funcIndex := wordReverseList[j]
			f := dc.deobfuscationFunctionsV2[funcIndex]
			isSeeded := funcIndex >= 6
			var seed []byte
			if isSeeded {
				seed = combinedSeed
			}
			currentWordBytes = f(currentWordBytes, seed, prngFactory)
		}

		deobfuscatedWords = append(deobfuscatedWords, string(currentWordBytes))
		wordIndex++
	}

	return strings.Join(deobfuscatedWords, " "), nil
}

// --- Compression Helpers ---

func (dc *DarkstarCrypt) packReverseKey(reverseKey [][]int) (string, error) {
	var buffer []byte
	for _, wordKey := range reverseKey {
		if len(wordKey) != 12 {
			return "", errors.New("cannot pack reverse key: invalid word length")
		}
		for i := 0; i < 12; i += 2 {
			high := byte(wordKey[i] & 0x0F)
			low := byte(wordKey[i+1] & 0x0F)
			buffer = append(buffer, (high<<4)|low)
		}
	}
	return base64.StdEncoding.EncodeToString(buffer), nil
}

func (dc *DarkstarCrypt) unpackReverseKey(b64 string) ([][]int, error) {
	bytes, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, err
	}
	var reverseKey [][]int
	const bytesPerWord = 6
	if len(bytes)%bytesPerWord != 0 {
		return nil, errors.New("invalid packed key length")
	}

	numWords := len(bytes) / bytesPerWord
	for w := 0; w < numWords; w++ {
		var wordKey []int
		chunk := bytes[w*bytesPerWord : (w+1)*bytesPerWord]
		for _, b := range chunk {
			high := int((b >> 4) & 0x0F)
			low := int(b & 0x0F)
			wordKey = append(wordKey, high, low)
		}
		reverseKey = append(reverseKey, wordKey)
	}
	return reverseKey, nil
}

// --- AES Helpers ---

func (dc *DarkstarCrypt) encryptAES256(data, password string, iterations int) (string, error) {
	salt := make([]byte, SALT_SIZE_BYTES)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	key := pbkdf2.Key([]byte(password), salt, iterations, KEY_SIZE, sha256.New)

	iv := make([]byte, IV_SIZE_BYTES)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// Padding
	dataBytes := []byte(data)
	paddingSize := aes.BlockSize - (len(dataBytes) % aes.BlockSize)
	padding := bytes.Repeat([]byte{byte(paddingSize)}, paddingSize)
	paddedData := append(dataBytes, padding...)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	ciphertext := make([]byte, len(paddedData))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, paddedData)

	// Zeroize sensitive materials
	for i := range key {
		key[i] = 0
	}

	// salt(hex) + iv(hex) + content(base64)
	saltHex := fmt.Sprintf("%x", salt)
	ivHex := fmt.Sprintf("%x", iv)
	contentBase64 := base64.StdEncoding.EncodeToString(ciphertext)

	return saltHex + ivHex + contentBase64, nil
}

func (dc *DarkstarCrypt) decryptAES256(transitMessage, password string, iterations int) ([]byte, error) {
	if len(transitMessage) < 64 {
		return nil, errors.New("invalid message length")
	}
	saltHex := transitMessage[:32]
	ivHex := transitMessage[32:64]
	encryptedBase64 := transitMessage[64:]

	salt, err := parseHex(saltHex)
	if err != nil {
		return nil, err
	}
	iv, err := parseHex(ivHex)
	if err != nil {
		return nil, err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedBase64)
	if err != nil {
		return nil, err
	}

	key := pbkdf2.Key([]byte(password), salt, iterations, KEY_SIZE, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	if len(ciphertext)%aes.BlockSize != 0 {
		return nil, errors.New("ciphertext is not a multiple of block size")
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	// Zeroize sensitive materials
	for i := range key {
		key[i] = 0
	}

	// Unpad
	if len(plaintext) == 0 {
		return nil, errors.New("plaintext empty")
	}
	paddingSize := int(plaintext[len(plaintext)-1])
	if paddingSize < 1 || paddingSize > aes.BlockSize {
		return nil, errors.New("invalid padding")
	}

	// Check all padding bytes
	for i := len(plaintext) - paddingSize; i < len(plaintext); i++ {
		if plaintext[i] != byte(paddingSize) {
			return nil, errors.New("invalid padding bytes")
		}
	}

	return plaintext[:len(plaintext)-paddingSize], nil
}

func parseHex(s string) ([]byte, error) {
	return hexDecodeString(s)
}

// Simple hex decode helper to avoid heavier dependency if needed, but encoding/hex is standard.
// Just using hex.DecodeString equivalent essentially.
func hexDecodeString(s string) ([]byte, error) {
	// use standard library normally, but manual here for dependency check? No, use real one.
	// Actually I missed the import "encoding/hex". Let's just implement a quick one or add import.
	// Adding import is better.
	dst := make([]byte, len(s)/2)
	for i := 0; i < len(s)/2; i++ {
		high := unhex(s[2*i])
		low := unhex(s[2*i+1])
		if high == 255 || low == 255 {
			return nil, errors.New("invalid hex")
		}
		dst[i] = (high << 4) | low
	}
	return dst, nil
}
func unhex(c byte) byte {
	switch {
	case '0' <= c && c <= '9':
		return c - '0'
	case 'a' <= c && c <= 'f':
		return c - 'a' + 10
	case 'A' <= c && c <= 'F':
		return c - 'A' + 10
	}
	return 255
}

// --- Main ---

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  encrypt <mnemonic> <password>                   - Encrypt a mnemonic phrase")
	fmt.Println("  decrypt <encrypted_json> <reverse_key> <password> - Decrypt a phrase")
	fmt.Println("  test                                            - Run self-test")
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	dc := NewDarkstarCrypt()
	command := os.Args[1]

	switch command {
	case "encrypt":
		if len(os.Args) != 4 {
			fmt.Println("Error: 'encrypt' requires <mnemonic> and <password>")
			return
		}
		mnemonic := os.Args[2]
		password := os.Args[3]
		result, err := dc.Encrypt(mnemonic, password)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		jsonRes, _ := json.Marshal(result)
		fmt.Println(string(jsonRes))

	case "decrypt":
		if len(os.Args) != 5 {
			fmt.Println("Error: 'decrypt' requires <encrypted_json_or_data> <reverse_key> <password>")
			return
		}
		data := os.Args[2]
		reverseKey := os.Args[3]
		password := os.Args[4]
		decrypted, err := dc.Decrypt(data, reverseKey, password)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(decrypted)

	case "test":
		mnemonic := "cat dog fish bird"
		password := "MySecre!Password123"

		fmt.Println("--- Darkstar Go Self-Test ---")
		fmt.Printf("Plaintext: %s\n", mnemonic)

		result, err := dc.Encrypt(mnemonic, password)
		if err != nil {
			panic(err)
		}

		encryptedDataRaw := result["encryptedData"].(string)
		reverseKey := result["reverseKey"].(string)

		// Parse the JSON inside encryptedData if it exists
		var parsedData map[string]interface{}
		var encryptedData string
		if err := json.Unmarshal([]byte(encryptedDataRaw), &parsedData); err == nil {
			encryptedData = parsedData["data"].(string)
		} else {
			encryptedData = encryptedDataRaw
		}

		fmt.Println("Encrypted:", encryptedData)

		decrypted, err := dc.Decrypt(encryptedDataRaw, reverseKey, password)
		if err != nil {
			panic(err)
		}

		fmt.Printf("Decrypted: '%s'\n", decrypted)

		if decrypted == mnemonic {
			fmt.Println("Result: PASSED")
		} else {
			fmt.Println("Result: FAILED")
			os.Exit(1)
		}

	default:
		fmt.Printf("Error: Unknown command '%s'\n", command)
		printUsage()
	}
}
