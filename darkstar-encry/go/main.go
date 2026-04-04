// Package main implements the D-KASP-1024 encryption scheme.
//
// D-KASP-1024 (V5) Features:
// - D: Darkstar ecosystem origin
// - K: Kyber-1024 (ML-KEM-1024) NIST Root of Trust
// - A: Augmented 64-layer SPN/ARX gauntlet
// - S: Sequential word-based path-logic
// - P: Permutation-based non-linear core
// - 1024: 256-bit Post-Quantum security parity
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/cloudflare/circl/kem/mlkem/mlkem1024"
	"golang.org/x/crypto/pbkdf2"
)

const (
	ITERATIONS_V2   = 600000
	KEY_SIZE        = 32
	SALT_SIZE_BYTES = 16
	IV_SIZE_BYTES   = 16
)

// --- PRNG ---

type PRNG interface {
	Next() uint32
}

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

func (m *Mulberry32) Next() uint32 {
	m.state = (m.state + 0x6d2b79f5)
	t := (m.state ^ (m.state >> 15))
	t = (t * (1 | m.state))
	term2 := (t ^ (t >> 7))
	term2 = (term2 * (61 | t))
	t = (t + term2) ^ t

	return t ^ (t >> 14)
}

type DarkstarChaChaPRNG struct {
	state   [8]uint32
	counter uint32
}

func NewDarkstarChaChaPRNG(seedStr string) *DarkstarChaChaPRNG {
	c := &DarkstarChaChaPRNG{}
	hash := sha256.Sum256([]byte(seedStr))
	hashHex := hex.EncodeToString(hash[:])
	for i := 0; i < 8; i++ {
		strChunk := hashHex[i*8 : (i+1)*8]
		val, _ := strconv.ParseUint(strChunk, 16, 32)
		c.state[i] = uint32(val)
	}
	return c
}

func (c *DarkstarChaChaPRNG) Next() uint32 {
	c.counter++
	x := c.state[(c.counter+0)%8]
	y := c.state[(c.counter+3)%8]
	z := c.state[(c.counter+5)%8]

	x = x + y + c.counter
	z = z ^ x
	z = (z << 16) | (z >> 16)

	y = y + z + (c.counter * 3)
	x = x ^ y
	x = (x << 12) | (x >> 20)

	c.state[(c.counter+0)%8] = x
	c.state[(c.counter+3)%8] = y
	c.state[(c.counter+5)%8] = z

	t := x + y + z
	t = (t ^ (t >> 15)) * (1 | t)
	t = (t + ((t ^ (t >> 7)) * (61 | t))) ^ t

	return t ^ (t >> 14)
}

// --- DarkstarCrypt ---

type DarkstarCrypt struct {
	obfuscationFunctionsV2   []func([]byte, []byte, func(string) PRNG) []byte
	deobfuscationFunctionsV2 []func([]byte, []byte, func(string) PRNG) []byte
	obfuscationFunctionsV4   []func([]byte, []byte, func(string) PRNG) []byte
	deobfuscationFunctionsV4 []func([]byte, []byte, func(string) PRNG) []byte
}

// NewDarkstarCrypt creates a new instance of DarkstarCrypt with initialized functions.
func NewDarkstarCrypt() *DarkstarCrypt {
	dc := &DarkstarCrypt{}
	dc.obfuscationFunctionsV2 = []func([]byte, []byte, func(string) PRNG) []byte{
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
	dc.deobfuscationFunctionsV2 = []func([]byte, []byte, func(string) PRNG) []byte{
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
	dc.obfuscationFunctionsV4 = []func([]byte, []byte, func(string) PRNG) []byte{
		dc.obfuscateSBoxV4,
		dc.obfuscateModMultV4,
		dc.obfuscatePBoxV4,
		dc.obfuscateCyclicRotV4,
		dc.obfuscateKeyedXORV4,
		dc.obfuscateFeistelV4,
		dc.obfuscateModAddV4,
		dc.obfuscateMatrixHillV4,
		dc.obfuscateGFMultV4,
		dc.obfuscateBitFlipV4,
		dc.obfuscateColumnarV4,
		dc.obfuscateRecXORV4,
	}
	dc.deobfuscationFunctionsV4 = []func([]byte, []byte, func(string) PRNG) []byte{
		dc.deobfuscateSBoxV4,
		dc.deobfuscateModMultV4,
		dc.deobfuscatePBoxV4,
		dc.deobfuscateCyclicRotV4,
		dc.deobfuscateKeyedXORV4,
		dc.deobfuscateFeistelV4,
		dc.deobfuscateModAddV4,
		dc.deobfuscateMatrixHillV4,
		dc.deobfuscateGFMultV4,
		dc.deobfuscateBitFlipV4,
		dc.deobfuscateColumnarV4,
		dc.deobfuscateRecXORV4,
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
	return sum
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
	for i := 0; i < 256; i++ {
		INV_SBOX[SBOX[i]] = byte(i)
	}
}

func gfMult(a, b byte) byte {
	p := byte(0)
	for i := 0; i < 8; i++ {
		if (b & 1) != 0 {
			p ^= a
		}
		hiBitSet := (a & 0x80) != 0
		a <<= 1
		if hiBitSet {
			a ^= 0x1B
		}
		b >>= 1
	}
	return p
}

func (dc *DarkstarCrypt) obfuscateSBoxV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = SBOX[b]
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateSBoxV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = INV_SBOX[b]
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateModMultV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = byte((uint16(b) * 167) & 0xFF)
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateModMultV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = byte((uint16(b) * 23) & 0xFF)
	}
	return out
}
func (dc *DarkstarCrypt) obfuscatePBoxV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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
func (dc *DarkstarCrypt) deobfuscatePBoxV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscatePBoxV4(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) obfuscateCyclicRotV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = (b >> 3) | (b << 5)
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateCyclicRotV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = (b << 3) | (b >> 5)
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateKeyedXORV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = b ^ seed[i%len(seed)]
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateKeyedXORV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateKeyedXORV4(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) obfuscateFeistelV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	copy(out, input)
	half := len(out) / 2
	if half == 0 {
		return out
	}
	for i := 0; i < half; i++ {
		f := out[half+i] + seed[i%len(seed)]
		out[i] ^= f
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateFeistelV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateFeistelV4(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) obfuscateModAddV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = b + seed[i%len(seed)]
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateModAddV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = b - seed[i%len(seed)]
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateMatrixHillV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 {
		return out
	}
	out[0] = input[0]
	for i := 1; i < len(input); i++ {
		out[i] = input[i] + out[i-1]
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateMatrixHillV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 {
		return out
	}
	out[0] = input[0]
	for i := len(input) - 1; i > 0; i-- {
		out[i] = input[i] - input[i-1]
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateGFMultV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = gfMult(b, 0x02)
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateGFMultV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		out[i] = gfMult(b, 0x8D)
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateBitFlipV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	for i, b := range input {
		mask := seed[i%len(seed)]
		out[i] = b ^ ((mask & 0xAA) | (^mask & 0x55))
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateBitFlipV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateBitFlipV4(input, seed, prngFactory)
}
func (dc *DarkstarCrypt) obfuscateColumnarV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	n := len(input)
	out := make([]byte, n)
	cols := 3
	idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols {
			out[idx] = input[i]
			idx++
		}
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateColumnarV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	n := len(input)
	out := make([]byte, n)
	cols := 3
	idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols {
			out[i] = input[idx]
			idx++
		}
	}
	return out
}
func (dc *DarkstarCrypt) obfuscateRecXORV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 {
		return out
	}
	out[0] = input[0]
	for i := 1; i < len(input); i++ {
		out[i] = out[i-1] ^ input[i]
	}
	return out
}
func (dc *DarkstarCrypt) deobfuscateRecXORV4(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	out := make([]byte, len(input))
	if len(input) == 0 {
		return out
	}
	out[0] = input[0]
	for i := len(input) - 1; i > 0; i-- {
		out[i] = input[i] ^ input[i-1]
	}
	return out
}

// --- Obfuscation Functions (V2) ---

func (dc *DarkstarCrypt) obfuscateByReversingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		output[len(input)-1-i] = b
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateByReversingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateByReversingV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateWithAtbashCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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
func (dc *DarkstarCrypt) deobfuscateWithAtbashCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateWithAtbashCipherV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateToCharCodesV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) deobfuscateFromCharCodesV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) obfuscateToBinaryV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) deobfuscateFromBinaryV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) obfuscateWithCaesarCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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
func (dc *DarkstarCrypt) deobfuscateWithCaesarCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateWithCaesarCipherV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateBySwappingAdjacentBytesV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	output := make([]byte, len(input))
	copy(output, input)
	for i := 0; i < len(output)-1; i += 2 {
		output[i], output[i+1] = output[i+1], output[i]
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateBySwappingAdjacentBytesV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateBySwappingAdjacentBytesV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateByShufflingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	output := make([]byte, len(input))
	copy(output, input)
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := len(output) - 1; i > 0; i-- {
		randVal := rng.Next()
		j := int((uint64(randVal) * uint64(i+1)) >> 32)
		output[i], output[j] = output[j], output[i]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateByShufflingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	n := len(input)
	indices := make([]int, n)
	for i := 0; i < n; i++ {
		indices[i] = i
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := n - 1; i > 0; i-- {
		randVal := rng.Next()
		j := int((uint64(randVal) * uint64(i+1)) >> 32)
		indices[i], indices[j] = indices[j], indices[i]
	}
	output := make([]byte, n)
	for i := 0; i < n; i++ {
		output[indices[i]] = input[i]
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithXORV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	output := make([]byte, len(input))
	for i, b := range input {
		output[i] = b ^ seed[i%len(seed)]
	}
	return output
}
func (dc *DarkstarCrypt) deobfuscateWithXORV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateWithXORV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateByInterleavingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	randomChars := "abcdefghijklmnopqrstuvwxyz0123456789"
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	output := make([]byte, len(input)*2)
	for i, b := range input {
		output[i*2] = b
		randIdx := int((uint64(rng.Next()) * uint64(len(randomChars))) >> 32)
		output[i*2+1] = randomChars[randIdx]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateByDeinterleavingV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	output := make([]byte, len(input)/2)
	for i := 0; i < len(input); i += 2 {
		output[i/2] = input[i]
	}
	return output
}

func (dc *DarkstarCrypt) obfuscateWithVigenereCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) deobfuscateWithVigenereCipherV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
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

func (dc *DarkstarCrypt) obfuscateWithSeededBlockReversalV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	blockSize := int((uint64(rng.Next())*uint64(len(input)/2))>>32) + 2
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
func (dc *DarkstarCrypt) deobfuscateWithSeededBlockReversalV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	return dc.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory)
}

func (dc *DarkstarCrypt) obfuscateWithSeededSubstitutionV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	chars := make([]byte, 256)
	for i := 0; i < 256; i++ {
		chars[i] = byte(i)
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := 255; i > 0; i-- {
		j := int((uint64(rng.Next()) * uint64(i+1)) >> 32)
		chars[i], chars[j] = chars[j], chars[i]
	}
	output := make([]byte, len(input))
	for i, b := range input {
		output[i] = chars[b]
	}
	return output
}

func (dc *DarkstarCrypt) deobfuscateWithSeededSubstitutionV2(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	chars := make([]byte, 256)
	for i := 0; i < 256; i++ {
		chars[i] = byte(i)
	}
	seedStr := string(seed)
	rng := prngFactory(seedStr)
	for i := 255; i > 0; i-- {
		j := int((uint64(rng.Next()) * uint64(i+1)) >> 32)
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

// Encrypt encrypts the mnemonic using the password and the Obfuscation scheme.
func (dc *DarkstarCrypt) Encrypt(mnemonic, keyMaterial string, forceV2 bool, forceV1 bool, forceV3 bool, forceV4 bool, forceV5 bool) (map[string]interface{}, error) {
	words := strings.Split(mnemonic, " ")
	var obfuscatedWords [][]byte
	var reverseKey [][]int

	isV5 := forceV5
	isV4 := (!forceV3 && !forceV2 && !forceV1 && !forceV5) || forceV4
	isV3 := forceV3
	isModern := isV3 || isV4 || isV5

	ctHex := ""
	ssHex := ""
	activePasswordStr := keyMaterial

	if isV5 {
		sch := mlkem1024.Scheme()
		pkBytes, err := hex.DecodeString(keyMaterial)
		if err != nil {
			return nil, fmt.Errorf("invalid kyber hex: %v", err)
		}
		pk, err := sch.UnmarshalBinaryPublicKey(pkBytes)
		if err != nil {
			return nil, fmt.Errorf("invalid public key: %v", err)
		}
		ctBytes, ssBytes, err := sch.Encapsulate(pk)
		if err != nil {
			return nil, err
		}
		ctHex = hex.EncodeToString(ctBytes)
		ssHex = hex.EncodeToString(ssBytes)
		activePasswordStr = ssHex
	}

	passwordBytes := []byte(activePasswordStr)

	prngFactory := func(s string) PRNG {
		if isModern {
			return NewDarkstarChaChaPRNG(s)
		}
		return NewMulberry32(s)
	}

	for _, word := range words {
		currentWordBytes := []byte(word)

		selectedFunctions := make([]int, 12)
		for i := 0; i < 12; i++ {
			selectedFunctions[i] = i
		}

		seedForSelection := activePasswordStr + word
		rngSel := prngFactory(seedForSelection)
		for i := 11; i > 0; i-- {
			j := int((uint64(rngSel.Next()) * uint64(i+1)) >> 32)
			selectedFunctions[i], selectedFunctions[j] = selectedFunctions[j], selectedFunctions[i]
		}

		cycleDepth := len(selectedFunctions)
		if isModern {
			hash := sha256.Sum256([]byte(seedForSelection))
			hashHex := hex.EncodeToString(hash[:])
			depthVal, _ := strconv.ParseInt(hashHex[:4], 16, 32)
			if isV5 {
				cycleDepth = 12 + (int(depthVal) % 501)
			} else {
				cycleDepth = 12 + (int(depthVal) % 53)
			}
		}

		checksum := generateChecksum(selectedFunctions)
		checksumBytes := []byte(strconv.Itoa(checksum))
		combinedSeed := append(append([]byte{}, passwordBytes...), checksumBytes...)

		var wordReverseKey []int

		for i := 0; i < cycleDepth; i++ {
			funcIndex := selectedFunctions[i%len(selectedFunctions)]

			if i >= 12 && !isV4 && !isV5 && (funcIndex == 2 || funcIndex == 3 || funcIndex == 8 || funcIndex == 9) {
				funcIndex = (funcIndex + 2) % 12
			}

			var f func([]byte, []byte, func(string) PRNG) []byte
			var isSeeded bool
			if isV4 || isV5 {
				f = dc.obfuscationFunctionsV4[funcIndex]
				isSeeded = funcIndex == 4 || funcIndex == 5 || funcIndex == 6 || funcIndex == 9
			} else {
				f = dc.obfuscationFunctionsV2[funcIndex]
				isSeeded = funcIndex >= 6
			}
			var seed []byte
			if isSeeded {
				seed = combinedSeed
			}

			// Apply correct function
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

	var encryptedContent string
	var err error
	targetIterations := ITERATIONS_V2
	if isV5 {
		targetIterations = ITERATIONS_V2
	}

	if isModern {
		encryptedContent, err = dc.encryptAES256GCM(base64Content, activePasswordStr, targetIterations)
	} else {
		encryptedContent, err = dc.encryptAES256(base64Content, activePasswordStr, targetIterations)
	}

	if err != nil {
		return nil, err
	}

	// Reverse Key serialization (Packed)
	encodedReverseKey, err := dc.packReverseKey(reverseKey, isModern)
	if err != nil {
		return nil, err
	}

	vProtocol := 2
	if isV5 {
		vProtocol = 5
	} else if isV4 {
		vProtocol = 4
	} else if isV3 {
		vProtocol = 3
	}

	if forceV1 {
		uncompressedRK, err := json.Marshal(reverseKey)
		if err != nil {
			return nil, err
		}

		return map[string]interface{}{
			"encryptedData": encryptedContent,
			"reverseKey":    base64.StdEncoding.EncodeToString(uncompressedRK),
		}, nil
	}

	// Construct result structure
	resultObj := map[string]interface{}{
		"v":    vProtocol,
		"data": encryptedContent,
	}
	if isV5 {
		resultObj["ct"] = ctHex
	}

	return map[string]interface{}{
		"encryptedData": resultObj,
		"reverseKey":    encodedReverseKey,
	}, nil
}

func (dc *DarkstarCrypt) Decrypt(encryptedDataRaw, reverseKeyB64, keyMaterial string) (string, error) {
	// 1. Decode Reverse Key
	rkBytes, err := base64.StdEncoding.DecodeString(reverseKeyB64)
	if err != nil {
		return "", errors.New("invalid reverse key base64")
	}

	var reverseKey [][]int
	// Try JSON first (Legacy V1)
	if err := json.Unmarshal(rkBytes, &reverseKey); err == nil {
		// PASSED JSON
	} else {
		// Not JSON, try Packed (V2/V3/V4 Compressed)
		// Detect protocol version from the data header first if possible
		isHeaderModern := false
		var parsed map[string]interface{}
		if json.Unmarshal([]byte(encryptedDataRaw), &parsed) == nil {
			if v, ok := parsed["v"].(float64); ok && (v == 3 || v == 4 || v == 5) {
				isHeaderModern = true
			}
		}

		reverseKey, err = dc.unpackReverseKey(reverseKeyB64, isHeaderModern)
		if err != nil {
			return "", errors.New("invalid reverse key format (json or packed)")
		}
	}

	// 2. Parse encrypted data
	var encryptedContent string
	var parsedDec map[string]interface{}
	isV3 := false
	isV4 := false
	isV5 := false
	ctHex := ""

	// Check if JSON
	if err := json.Unmarshal([]byte(encryptedDataRaw), &parsedDec); err == nil {
		if v, ok := parsedDec["v"].(float64); ok && v == 2 {
			if data, ok := parsedDec["data"].(string); ok {
				encryptedContent = data
			}
		} else if v, ok := parsedDec["v"].(float64); ok && v == 3 {
			if data, ok := parsedDec["data"].(string); ok {
				encryptedContent = data
				isV3 = true
			}
		} else if v, ok := parsedDec["v"].(float64); ok && v == 4 {
			if data, ok := parsedDec["data"].(string); ok {
				encryptedContent = data
				isV4 = true
			}
		} else if v, ok := parsedDec["v"].(float64); ok && v == 5 {
			if data, ok := parsedDec["data"].(string); ok {
				encryptedContent = data
				isV5 = true
				if ctStr, ok := parsedDec["ct"].(string); ok {
					ctHex = ctStr
				}
			}
		}
	}
	
	isModern := isV3 || isV4 || isV5

	activePasswordStr := keyMaterial
	if isV5 {
		sch := mlkem1024.Scheme()
		skBytes, err := hex.DecodeString(keyMaterial)
		if err != nil {
			return "", fmt.Errorf("invalid sk format: %v", err)
		}
		sk, err := sch.UnmarshalBinaryPrivateKey(skBytes)
		if err != nil {
			return "", fmt.Errorf("invalid sk unmarshal: %v", err)
		}
		ctBytes, err := hex.DecodeString(ctHex)
		if err != nil {
			return "", fmt.Errorf("invalid ct format: %v", err)
		}
		ssBytes, err := sch.Decapsulate(sk, ctBytes)
		if err != nil {
			return "", err
		}
		activePasswordStr = hex.EncodeToString(ssBytes)
	}

	targetIterations := ITERATIONS_V2
	if isV5 {
		targetIterations = ITERATIONS_V2
	}
	if encryptedContent == "" {
		encryptedContent = encryptedDataRaw // Fallback or direct string
	}

	// 3. AES Decrypt
	var decryptedBase64Bytes []byte
	var decErr error

	if isModern {
		decryptedBase64Bytes, decErr = dc.decryptAES256GCM(encryptedContent, activePasswordStr, targetIterations)
	} else {
		decryptedBase64Bytes, decErr = dc.decryptAES256(encryptedContent, activePasswordStr, targetIterations)
	}

	if decErr != nil {
		return "", fmt.Errorf("aes decryption failed: %v", decErr)
	}

	// 4. Decode Base64 Blob
	binaryString, err := base64.StdEncoding.DecodeString(string(decryptedBase64Bytes))
	if err != nil {
		return "", errors.New("failed to decode inner base64 blob")
	}
	fullBlob := binaryString

	var deobfuscatedWords []string
	passwordBytes := []byte(activePasswordStr)
	prngFactory := func(s string) PRNG {
		if isModern {
			return NewDarkstarChaChaPRNG(s)
		}
		return NewMulberry32(s)
	}

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

		uniqueSetMap := make(map[int]bool)
		var uniqueSet []int
		limit := len(wordReverseList)
		if limit > 12 {
			limit = 12
		}
		for _, v := range wordReverseList[:limit] {
			if !uniqueSetMap[v] {
				uniqueSetMap[v] = true
				uniqueSet = append(uniqueSet, v)
			}
		}

		checksum := generateChecksum(uniqueSet)
		checksumBytes := []byte(strconv.Itoa(checksum))
		combinedSeed := append(append([]byte{}, passwordBytes...), checksumBytes...)

		for j := len(wordReverseList) - 1; j >= 0; j-- {
			funcIndex := wordReverseList[j]
			
			var f func([]byte, []byte, func(string) PRNG) []byte
			var isSeeded bool

			if isV4 || isV5 {
				f = dc.deobfuscationFunctionsV4[funcIndex]
				isSeeded = funcIndex == 4 || funcIndex == 5 || funcIndex == 6 || funcIndex == 9
			} else {
				f = dc.deobfuscationFunctionsV2[funcIndex]
				isSeeded = funcIndex >= 6
			}
			
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

func (dc *DarkstarCrypt) packReverseKey(reverseKey [][]int, isV3 bool) (string, error) {
	var buffer []byte
	for _, wordKey := range reverseKey {
		if isV3 {
			// Uint16BE length header
			l := uint16(len(wordKey))
			buffer = append(buffer, byte(l>>8), byte(l&0xff))
		}
		for i := 0; i < len(wordKey); i += 2 {
			high := byte(wordKey[i] & 0x0F)
			var low byte
			if i+1 < len(wordKey) {
				low = byte(wordKey[i+1] & 0x0F)
			}
			buffer = append(buffer, (high<<4)|low)
		}
	}
	return base64.StdEncoding.EncodeToString(buffer), nil
}

func (dc *DarkstarCrypt) unpackReverseKey(b64 string, isV3 bool) ([][]int, error) {
	bytes, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, err
	}
	var reverseKey [][]int

	offset := 0
	for offset < len(bytes) {
		wordLen := 12 // Legacy V2 default
		if isV3 {
			if offset+2 > len(bytes) {
				break
			}
			wordLen = (int(bytes[offset]) << 8) | int(bytes[offset+1])
			offset += 2
		}

		numBytesToRead := (wordLen + 1) / 2
		var wordKey []int
		for i := 0; i < numBytesToRead; i++ {
			if offset >= len(bytes) {
				break
			}
			b := bytes[offset]
			offset++
			high := int((b >> 4) & 0x0F)
			low := int(b & 0x0F)
			wordKey = append(wordKey, high)
			if len(wordKey) < wordLen {
				wordKey = append(wordKey, low)
			}
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
	saltHex := hex.EncodeToString(salt)
	ivHex := hex.EncodeToString(iv)
	contentBase64 := base64.StdEncoding.EncodeToString(ciphertext)

	return saltHex + ivHex + contentBase64, nil
}

func (dc *DarkstarCrypt) encryptAES256GCM(data, password string, iterations int) (string, error) {
	salt := make([]byte, SALT_SIZE_BYTES)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	key := pbkdf2.Key([]byte(password), salt, iterations, KEY_SIZE, sha256.New)

	iv := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	ciphertext := aesgcm.Seal(nil, iv, []byte(data), nil)

	for i := range key {
		key[i] = 0
	}

	saltHex := hex.EncodeToString(salt)
	ivHex := hex.EncodeToString(iv)
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


func (dc *DarkstarCrypt) decryptAES256GCM(transitMessage, password string, iterations int) ([]byte, error) {
	if len(transitMessage) < 56 { // hex salt(32) + hex iv(24)
		return nil, errors.New("invalid message length")
	}
	saltHex := transitMessage[:32]
	ivHex := transitMessage[32:56]
	encryptedBase64 := transitMessage[56:]

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
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	for i := range key {
		key[i] = 0
	}

	return plaintext, nil
}

func parseHex(s string) ([]byte, error) {
	return hex.DecodeString(s)
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  darkstar-encry [flags] encrypt <mnemonic> <password>")
	fmt.Println("  darkstar-encry [flags] decrypt <encrypted_data> <reverse_key> <password>")
	fmt.Println("Flags:")
	fmt.Println("  --v1, --v2, --v3, --v4, --v5")
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	forceV1 := false
	forceV2 := false
	forceV3 := false
	forceV4 := false
	forceV5 := false

	args := os.Args[1:]
	for len(args) > 0 && strings.HasPrefix(args[0], "--") {
		flag := strings.ToLower(args[0])
		switch flag {
		case "--v1": forceV1 = true
		case "--v2": forceV2 = true
		case "--v3": forceV3 = true
		case "--v4": forceV4 = true
		case "--v5": forceV5 = true
		}
		args = args[1:]
	}

	if len(args) < 1 {
		printUsage()
		return
	}

	command := args[0]
	dc := NewDarkstarCrypt()

	switch command {
	case "encrypt":
		if len(args) < 3 {
			fmt.Println("Error: encrypt requires mnemonic and password")
			os.Exit(1)
		}
		mnemonic := args[1]
		password := args[2]
		result, err := dc.Encrypt(mnemonic, password, forceV2, forceV1, forceV3, forceV4, forceV5)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		j, _ := json.Marshal(result)
		fmt.Println(string(j))

	case "decrypt":
		if len(args) < 4 {
			fmt.Println("Error: decrypt requires data, key and password")
			os.Exit(1)
		}
		data := args[1]
		rk := args[2]
		password := args[3]
		decrypted, err := dc.Decrypt(data, rk, password)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Print(decrypted)

	default:
		fmt.Printf("Error: Unknown command %s\n", command)
		printUsage()
	}
}
