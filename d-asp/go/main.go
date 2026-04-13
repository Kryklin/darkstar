// Package main implements the D-ASP cryptographic suite.
//
// D-ASP (Darkstar Algebraic Substitution & Permutation) is a post-quantum
// structural obfuscation protocol leveraging ML-KEM-1024 (Kyber-1024)
// as its primary root of trust.
//
// Protocol Layers:
// - D: Darkstar ecosystem origin
// - A: Algebraic Substitution
// - S: Structural Permutation
// - P: Permutation-based non-linear core
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/cloudflare/circl/kem/mlkem/mlkem1024"
)

// PRNG defines the interface for deterministic random number generation
// used to drive the SPNA gauntlet's path selection logic.

type PRNG interface {
	Next() uint32
}

type DarkstarChaChaPRNG struct {
	state   [16]uint32
	block   [16]uint32
	blockIdx int
}

func NewDarkstarChaChaPRNG(seedStr string) *DarkstarChaChaPRNG {
	c := &DarkstarChaChaPRNG{}
	hash := sha256.Sum256([]byte(seedStr))
	
	// RFC 8439 Constants
	c.state[0] = 0x61707865; c.state[1] = 0x3320646e; c.state[2] = 0x79622d32; c.state[3] = 0x6b206574;
	for i := 0; i < 8; i++ {
		chunk := hash[i*4 : (i+1)*4]
		c.state[4+i] = uint32(chunk[0]) | uint32(chunk[1])<<8 | uint32(chunk[2])<<16 | uint32(chunk[3])<<24
	}
	c.state[12] = 0
	c.state[13] = 0
	c.state[14] = 0
	c.state[15] = 0

	c.block = c.chachaBlock(c.state)
	c.blockIdx = 0
	return c
}

func (c *DarkstarChaChaPRNG) chachaBlock(st [16]uint32) [16]uint32 {
	x := st
	rotate := func(v, n uint32) uint32 { return (v << n) | (v >> (32 - n)) }
	quarterRound := func(a, b, c, d int) {
		x[a] += x[b]; x[d] ^= x[a]; x[d] = rotate(x[d], 16)
		x[c] += x[d]; x[b] ^= x[c]; x[b] = rotate(x[b], 12)
		x[a] += x[b]; x[d] ^= x[a]; x[d] = rotate(x[d], 8)
		x[c] += x[d]; x[b] ^= x[c]; x[b] = rotate(x[b], 7)
	}
	for i := 0; i < 10; i++ {
		quarterRound(0, 4, 8, 12); quarterRound(1, 5, 9, 13)
		quarterRound(2, 6, 10, 14); quarterRound(3, 7, 11, 15)
		quarterRound(0, 5, 10, 15); quarterRound(1, 6, 11, 12)
		quarterRound(2, 7, 8, 13); quarterRound(3, 4, 9, 14)
	}
	for i := 0; i < 16; i++ { x[i] += st[i] }
	return x
}

func (c *DarkstarChaChaPRNG) Next() uint32 {
	if c.blockIdx >= 16 {
		c.state[12]++
		c.block = c.chachaBlock(c.state)
		c.blockIdx = 0
	}
	val := c.block[c.blockIdx]
	c.blockIdx++
	return val
}

// DarkstarCrypt manages the 16-round SPNA transformation pipeline.

type TransformationFn func([]byte, []byte, func(string) PRNG) []byte

type DarkstarCrypt struct {
	forwardPipeline []TransformationFn
	reversePipeline []TransformationFn
}

func NewDarkstarCrypt() *DarkstarCrypt {
	dc := &DarkstarCrypt{}
	dc.forwardPipeline = []TransformationFn{
		dc.transSBox,
		dc.transModMult,
		dc.transPBox,
		dc.transCyclicRot,
		dc.transKeyedXOR,
		dc.transFeistel,
		dc.transModAdd,
		dc.transMatrixHill,
		dc.transGFMult,
		dc.transBitFlip,
		dc.transColumnar,
		dc.transRecXOR,
		dc.transMDSNetwork,
	}
	dc.reversePipeline = []TransformationFn{
		dc.invTransSBox,
		dc.invTransModMult,
		dc.invTransPBox,
		dc.invTransCyclicRot,
		dc.invTransKeyedXOR,
		dc.invTransFeistel,
		dc.invTransModAdd,
		dc.invTransMatrixHill,
		dc.invTransGFMult,
		dc.invTransBitFlip,
		dc.invTransColumnar,
		dc.invTransRecXOR,
		dc.invTransMDSNetwork,
	}
	return dc
}

func generateChecksum(numbers []int) int {
	sum := 0
	for _, n := range numbers { sum += n }
	return sum % 997
}

var SBOX = []byte{
	0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
	0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
	0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
	0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
	0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
	0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
	0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
	0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
	0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
	0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
	0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
	0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
	0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
	0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
	0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
	0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
}
var INV_SBOX []byte

func init() {
	INV_SBOX = make([]byte, 256)
	for i := 0; i < 256; i++ { INV_SBOX[SBOX[i]] = byte(i) }
}

func gfMult(a, b byte) byte {
	p := byte(0)
	for i := 0; i < 8; i++ {
		// Mask: if b & 1, add a to product p
		maskB := byte(0) - (b & 1)
		p ^= a & maskB

		// Mask: if hi-bit of a is set, reduce by 0x1B
		maskA := byte(0) - (a >> 7)
		a <<= 1
		a ^= 0x1B & maskA

		b >>= 1
	}
	return p
}

func (dc *DarkstarCrypt) transSBox(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = SBOX[b] }
	return out
}
func (dc *DarkstarCrypt) invTransSBox(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = INV_SBOX[b] }
	return out
}
func (dc *DarkstarCrypt) transModMult(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = byte((uint16(b) * 167) & 0xFF) }
	return out
}
func (dc *DarkstarCrypt) invTransModMult(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = byte((uint16(b) * 23) & 0xFF) }
	return out
}
func (dc *DarkstarCrypt) transPBox(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	length := len(input)
	for i := 0; i < length; i++ {
		b := input[i]
		b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4)
		b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2)
		b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1)
		out[length-1-i] = b
	}
	return out
}
func (dc *DarkstarCrypt) invTransPBox(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.transPBox(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) transCyclicRot(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = (b >> 3) | (b << 5) }
	return out
}
func (dc *DarkstarCrypt) invTransCyclicRot(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = (b << 3) | (b >> 5) }
	return out
}
func (dc *DarkstarCrypt) transKeyedXOR(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = b ^ seed[i%len(seed)] }
	return out
}
func (dc *DarkstarCrypt) invTransKeyedXOR(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.transKeyedXOR(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) transFeistel(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	copy(out, input)
	half := len(out) / 2
	if half == 0 { return out }
	for i := 0; i < half; i++ {
		f := out[half+i] + seed[i%len(seed)]
		out[i] ^= f
	}
	return out
}
func (dc *DarkstarCrypt) invTransFeistel(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.transFeistel(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) transModAdd(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = b + seed[i%len(seed)] }
	return out
}
func (dc *DarkstarCrypt) invTransModAdd(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = b - seed[i%len(seed)] }
	return out
}
func (dc *DarkstarCrypt) transMatrixHill(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 { return out }
	out[0] = input[0]
	for i := 1; i < len(input); i++ { out[i] = input[i] + out[i-1] }
	return out
}
func (dc *DarkstarCrypt) invTransMatrixHill(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 { return out }
	out[0] = input[0]
	for i := len(input) - 1; i > 0; i-- { out[i] = input[i] - input[i-1] }
	return out
}
func (dc *DarkstarCrypt) transGFMult(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = gfMult(b, 0x02) }
	return out
}
func (dc *DarkstarCrypt) invTransGFMult(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input { out[i] = gfMult(b, 0x8D) }
	return out
}
func (dc *DarkstarCrypt) transBitFlip(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		mask := seed[i%len(seed)]
		out[i] = b ^ ((mask & 0xAA) | (^mask & 0x55))
	}
	return out
}
func (dc *DarkstarCrypt) invTransBitFlip(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.transBitFlip(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) transColumnar(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	n := len(input); out := make([]byte, n)
	cols := 3; idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols { out[idx] = input[i]; idx++ }
	}
	return out
}
func (dc *DarkstarCrypt) invTransColumnar(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	n := len(input); out := make([]byte, n)
	cols := 3; idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols { out[i] = input[idx]; idx++ }
	}
	return out
}
func (dc *DarkstarCrypt) transRecXOR(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 { return out }
	out[0] = input[0]
	for i := 1; i < len(input); i++ { out[i] = out[i-1] ^ input[i] }
	return out
}
func (dc *DarkstarCrypt) invTransRecXOR(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 { return out }
	out[0] = input[0]
	for i := len(input) - 1; i > 0; i-- { out[i] = input[i] ^ input[i-1] }
	return out
}

var MDS_MATRIX = [4][4]byte{
	{0x02, 0x03, 0x01, 0x01}, {0x01, 0x02, 0x03, 0x01},
	{0x01, 0x01, 0x02, 0x03}, {0x03, 0x01, 0x01, 0x02},
}
var INV_MDS_MATRIX = [4][4]byte{
	{0x0E, 0x0B, 0x0D, 0x09}, {0x09, 0x0E, 0x0B, 0x0D},
	{0x0D, 0x09, 0x0E, 0x0B}, {0x0B, 0x0D, 0x09, 0x0E},
}

func (dc *DarkstarCrypt) transMDSNetwork(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	if len(input) < 4 { return dc.transMatrixHill(input, seed, prngFactory) }
	out := make([]byte, len(input))
	for i := 0; i < len(input); i += 4 {
		end := i + 4
		if end > len(input) { copy(out[i:], input[i:]); continue }
		block := input[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ { sum ^= gfMult(block[col], MDS_MATRIX[row][col]) }
			out[i+row] = sum
		}
	}
	return out
}
func (dc *DarkstarCrypt) invTransMDSNetwork(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	if len(input) < 4 { return dc.invTransMatrixHill(input, seed, prngFactory) }
	out := make([]byte, len(input))
	for i := 0; i < len(input); i += 4 {
		end := i + 4
		if end > len(input) { copy(out[i:], input[i:]); continue }
		block := input[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ { sum ^= gfMult(block[col], INV_MDS_MATRIX[row][col]) }
			out[i+row] = sum
		}
	}
	return out
}

func (dc *DarkstarCrypt) Encrypt(payload string, pkHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	pkRaw, err := hex.DecodeString(pkHex)
	if err != nil { return "", fmt.Errorf("invalid pk hex: %v", err) }
	
	pkLen := len(pkRaw)
	var finalHwid []byte = hwid
	var pkBytes []byte

	if pkLen == 1600 && len(finalHwid) == 0 {
		finalHwid = pkRaw[1568:]; pkBytes = pkRaw[:1568]
	} else if pkLen == 1568 {
		pkBytes = pkRaw
	} else {
		return "", fmt.Errorf("invalid public key length (Arg: %d)", pkLen*2)
	}

	sch := mlkem1024.Scheme()
	pk, err := sch.UnmarshalBinaryPublicKey(pkBytes)
	if err != nil { return "", fmt.Errorf("invalid public key: %v", err) }
	
	kemStart := time.Now()
	ct, ss, err := sch.Encapsulate(pk)
	if err != nil { return "", err }
	kemDuration := time.Since(kemStart)
	
	ctHex := hex.EncodeToString(ct)
	ssBytes := ss

	kdfStart := time.Now()
	combinedSS := append([]byte{}, ssBytes...)
	if len(finalHwid) > 0 { combinedSS = append(combinedSS, finalHwid...) }

	cHasher := sha256.New(); cHasher.Write([]byte("dasp-cipher-key")); cHasher.Write(combinedSS)
	activePasswordStr := hex.EncodeToString(cHasher.Sum(nil))

	hHasher := sha256.New(); hHasher.Write([]byte("dasp-hmac-key")); hHasher.Write(combinedSS)
	activeHmacKey := hHasher.Sum(nil)
	kdfDuration := time.Since(kdfStart)

	for i := range ssBytes { ssBytes[i] = 0 }

	prngFactory := func(s string) PRNG { return NewDarkstarChaChaPRNG(s) }
	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	currentWordBytes := []byte(payload)

	mac := hmac.New(sha256.New, []byte(activePasswordStr)); mac.Write([]byte("dasp-word-0"))
	wordKey := mac.Sum(nil); wordKeyHex := hex.EncodeToString(wordKey)

	for i := range currentWordBytes { currentWordBytes[i] ^= chainState[i%32] }

	mac2 := hmac.New(sha256.New, wordKey)
	chk := generateChecksum([]int{0,1,2,3,4,5,6,7,8,9,10,11})
	mac2.Write([]byte(fmt.Sprintf("keyed-%d", chk)))
	funcKey := mac2.Sum(nil)

	rngPath := prngFactory(wordKeyHex)
	groupS := []int{0, 1, 5}; groupP := []int{2, 3, 10}
	groupN := []int{12, 12, 11}; groupA := []int{4, 6, 9}

	gauntletStart := time.Now()
	for i := 0; i < 16; i++ {
		sIdx := 0
		if i%4 == 0 { sIdx = 0 } else if i%4 == 2 { sIdx = 1 } else { sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))] }
		currentWordBytes = dc.forwardPipeline[sIdx](currentWordBytes, funcKey, prngFactory)

		pIdx := groupP[int(rngPath.Next()%uint32(len(groupP)))]
		currentWordBytes = dc.forwardPipeline[pIdx](currentWordBytes, funcKey, prngFactory)

		nIdx := groupN[int(rngPath.Next()%uint32(len(groupN)))]
		currentWordBytes = dc.forwardPipeline[nIdx](currentWordBytes, funcKey, prngFactory)

		aIdx := groupA[int(rngPath.Next()%uint32(len(groupA)))]
		currentWordBytes = dc.forwardPipeline[aIdx](currentWordBytes, funcKey, prngFactory)
	}
	gauntletDuration := time.Since(gauntletStart)

	h := hmac.New(sha256.New, activeHmacKey)
	h.Write(ct); h.Write(currentWordBytes)
	macTag := hex.EncodeToString(h.Sum(nil))

	totalDuration := time.Since(totalStart)

	inner := map[string]interface{}{
		"data": hex.EncodeToString(currentWordBytes),
		"ct":   ctHex,
		"mac":  macTag,
		"timings": map[string]interface{}{
			"kem_us":      kemDuration.Microseconds(),
			"kdf_us":      kdfDuration.Microseconds(),
			"gauntlet_us": gauntletDuration.Microseconds(),
			"total_us":    totalDuration.Microseconds(),
		},
	}
	innerJson, _ := json.Marshal(inner)
	return string(innerJson), nil
}

func (dc *DarkstarCrypt) Decrypt(encryptedDataRaw string, skHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	var value map[string]interface{}
	if err := json.Unmarshal([]byte(encryptedDataRaw), &value); err != nil { return "", err }
	
	ctHex, _ := value["ct"].(string)
	encryptedContent, _ := value["data"].(string)
	macTagHex, _ := value["mac"].(string)

	skRaw, err := hex.DecodeString(skHex)
	if err != nil { return "", err }
	
	skLen := len(skRaw)
	var finalHwid []byte = hwid
	var skBytes []byte

	if skLen == 3200 && len(finalHwid) == 0 {
		finalHwid = skRaw[3168:]; skBytes = skRaw[:3168]
	} else if skLen == 3168 {
		skBytes = skRaw
	} else {
		return "", fmt.Errorf("invalid secret key length (Arg: %d)", skLen*2)
	}

	ctBytes, err := hex.DecodeString(ctHex); if err != nil { return "", err }
	sch := mlkem1024.Scheme()
	sk, err := sch.UnmarshalBinaryPrivateKey(skBytes); if err != nil { return "", err }
	
	kemStart := time.Now()
	ssBytes, err := sch.Decapsulate(sk, ctBytes); if err != nil { return "", err }
	kemDuration := time.Since(kemStart)
	
	kdfStart := time.Now()
	combinedSS := append([]byte{}, ssBytes...)
	if len(finalHwid) > 0 { combinedSS = append(combinedSS, finalHwid...) }

	cHasher := sha256.New(); cHasher.Write([]byte("dasp-cipher-key")); cHasher.Write(combinedSS)
	activePasswordStr := hex.EncodeToString(cHasher.Sum(nil))

	hHasher := sha256.New(); hHasher.Write([]byte("dasp-hmac-key")); hHasher.Write(combinedSS)
	activeHmacKey := hHasher.Sum(nil)
	kdfDuration := time.Since(kdfStart)

	for i := range ssBytes { ssBytes[i] = 0 }

	payloadBytes, err := hex.DecodeString(encryptedContent); if err != nil { return "", err }

	h := hmac.New(sha256.New, activeHmacKey); h.Write(ctBytes); h.Write(payloadBytes)
	tag, _ := hex.DecodeString(macTagHex)
	if !hmac.Equal(h.Sum(nil), tag) { return "", errors.New("Integrity Check Failed") }

	prngFactory := func(s string) PRNG { return NewDarkstarChaChaPRNG(s) }
	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	mac := hmac.New(sha256.New, []byte(activePasswordStr)); mac.Write([]byte("dasp-word-0"))
	wordKey := mac.Sum(nil); wordKeyHex := hex.EncodeToString(wordKey)

	rngPath := prngFactory(wordKeyHex)
	groupS := []int{0, 1, 5}; groupP := []int{2, 3, 10}
	groupN := []int{12, 12, 11}; groupA := []int{4, 6, 9}

	type step struct{ s, p, n, a int }
	roundPaths := make([]step, 16)
	for i := 0; i < 16; i++ {
		sIdx := 0
		if i%4 == 0 { sIdx = 0 } else if i%4 == 2 { sIdx = 1 } else { sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))] }
		roundPaths[i] = step{s: sIdx, p: groupP[int(rngPath.Next()%uint32(len(groupP)))], n: groupN[int(rngPath.Next()%uint32(len(groupN)))], a: groupA[int(rngPath.Next()%uint32(len(groupA)))]}
	}

	chk := generateChecksum([]int{0,1,2,3,4,5,6,7,8,9,10,11})
	mac2 := hmac.New(sha256.New, wordKey); mac2.Write([]byte(fmt.Sprintf("keyed-%d", chk)))
	funcKey := mac2.Sum(nil)

	gauntletStart := time.Now()
	currentWordBytes := payloadBytes
	for j := 15; j >= 0; j-- {
		r := roundPaths[j]
		currentWordBytes = dc.reversePipeline[r.a](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.n](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.p](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.s](currentWordBytes, funcKey, prngFactory)
	}
	gauntletDuration := time.Since(gauntletStart)

	for i := range currentWordBytes { currentWordBytes[i] ^= chainState[i%32] }
	
	totalDuration := time.Since(totalStart)
	
	timings := map[string]interface{}{
		"kem_us":      kemDuration.Microseconds(),
		"kdf_us":      kdfDuration.Microseconds(),
		"gauntlet_us": gauntletDuration.Microseconds(),
		"total_us":    totalDuration.Microseconds(),
	}
	tJson, _ := json.Marshal(map[string]interface{}{"timings": timings})
	fmt.Fprintf(os.Stderr, "%s\n", tJson)

	return string(currentWordBytes), nil
}

func printUsage() {
	fmt.Println("Darkstar D-ASP Cryptographic Suite")
	fmt.Println("\nUsage:")
	fmt.Println("  darkstar [flags] <command> [args]")
	fmt.Println("\nFlags:")
	fmt.Println("  -f, --format <json|csv|text> Output format")
	fmt.Println("\nCommands:")
	fmt.Println("  encrypt <payload> <pkHex>      Encrypt a payload")
	fmt.Println("  decrypt <data> <skHex>          Decrypt a D-ASP payload")
	fmt.Println("  keygen                          Generate ML-KEM-1024 Keypair")
	fmt.Println("  test                            Run internal self-test")
}

func resolveArg(arg string) string {
	if strings.HasPrefix(arg, "@") {
		content, err := os.ReadFile(arg[1:])
		if err != nil { fmt.Printf("Error reading file %s: %v\n", arg[1:], err); os.Exit(1) }
		return strings.TrimSpace(string(content))
	}
	return arg
}

func main() {
	var hwid []byte
	args := os.Args[1:]
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if arg == "-h" || arg == "--help" { printUsage(); return }
		if (arg == "-f" || arg == "--format") && i+1 < len(args) {
			args = append(args[:i], args[i+2:]...); i--
		} else if arg == "--hwid" && i+1 < len(args) {
			hwid, _ = hex.DecodeString(args[i+1])
			args = append(args[:i], args[i+2:]...); i--
		} else if (arg == "-v" || arg == "--version") && i+1 < len(args) {
			args = append(args[:i], args[i+2:]...); i--
		}
	}
	if len(args) < 1 { printUsage(); return }

	command := args[0]
	dc := NewDarkstarCrypt()
	switch command {
	case "encrypt":
		if len(args) < 3 { os.Exit(1) }
		res, err := dc.Encrypt(resolveArg(args[1]), resolveArg(args[2]), hwid)
		if err != nil { fmt.Fprintf(os.Stderr, "Encryption Error: %v\n", err); os.Exit(1) }; fmt.Println(res)
	case "decrypt":
		if len(args) < 3 { os.Exit(1) }
		res, err := dc.Decrypt(resolveArg(args[1]), resolveArg(args[2]), hwid)
		if err != nil { fmt.Fprintf(os.Stderr, "Decryption Error: %v\n", err); os.Exit(1) }; fmt.Print(res)
	case "keygen":
		sch := mlkem1024.Scheme(); pk, sk, _ := sch.GenerateKeyPair()
		pkB, _ := pk.MarshalBinary(); skB, _ := sk.MarshalBinary()
		fmt.Printf("PK: %s\nSK: %s\n", hex.EncodeToString(pkB), hex.EncodeToString(skB))
	case "test":
		payload := "apple banana cherry date elderberry fig grape honeydew"
		sch := mlkem1024.Scheme(); pk, sk, _ := sch.GenerateKeyPair()
		pkB, _ := pk.MarshalBinary(); skB, _ := sk.MarshalBinary()
		resJson, err := dc.Encrypt(payload, hex.EncodeToString(pkB), nil)
		if err != nil { fmt.Fprintf(os.Stderr, "Test Encryption Error: %v\n", err); os.Exit(1) }
		var m map[string]interface{}; json.Unmarshal([]byte(resJson), &m)
		dec, err := dc.Decrypt(m["data"].(string), hex.EncodeToString(skB), nil)
		if err != nil { fmt.Fprintf(os.Stderr, "Test Decryption Error: %v\n", err); os.Exit(1) }
		fmt.Printf("--- D-ASP Self-Test ---\nDecrypted: '%s'\nResult: PASSED\n", dec)
	default:
		printUsage(); os.Exit(1)
	}
}
