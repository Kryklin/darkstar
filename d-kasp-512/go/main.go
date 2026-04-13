// Package main implements the d-kasp-512 encryption scheme.
//
// d-kasp-512 (V5) Features:
// - D: Darkstar ecosystem origin
// - K: Kyber-1024 (ML-KEM-1024) NIST Root of Trust
// - A: Augmented 64-layer SPN/ARX gauntlet
// - S: Sequential word-based path-logic
// - P: Permutation-based non-linear core
// - 1024: 256-bit Post-Quantum security parity
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/hmac"
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
	c.state[12] = 0 // counter
	c.state[13] = 0 // nonce
	c.state[14] = 0 // nonce
	c.state[15] = 0 // nonce

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
		dc.obfuscateMDSNetworkV9,
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
		dc.deobfuscateMDSNetworkV9,
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

var MDS_MATRIX = [4][4]byte{
	{0x02, 0x03, 0x01, 0x01},
	{0x01, 0x02, 0x03, 0x01},
	{0x01, 0x01, 0x02, 0x03},
	{0x03, 0x01, 0x01, 0x02},
}

var INV_MDS_MATRIX = [4][4]byte{
	{0x0E, 0x0B, 0x0D, 0x09},
	{0x09, 0x0E, 0x0B, 0x0D},
	{0x0D, 0x09, 0x0E, 0x0B},
	{0x0B, 0x0D, 0x09, 0x0E},
}

func (dc *DarkstarCrypt) obfuscateMDSNetworkV9(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	if len(input) < 4 {
		return dc.obfuscateMatrixHillV4(input, seed, prngFactory)
	}
	out := make([]byte, len(input))
	for i := 0; i < len(input); i += 4 {
		end := i + 4
		if end > len(input) {
			copy(out[i:], input[i:])
			continue
		}
		block := input[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ {
				sum ^= gfMult(block[col], MDS_MATRIX[row][col])
			}
			out[i+row] = sum
		}
	}
	return out
}

func (dc *DarkstarCrypt) deobfuscateMDSNetworkV9(input []byte, seed []byte, prngFactory func(string) PRNG) []byte {
	if len(input) < 4 {
		return dc.deobfuscateMatrixHillV4(input, seed, prngFactory)
	}
	out := make([]byte, len(input))
	for i := 0; i < len(input); i += 4 {
		end := i + 4
		if end > len(input) {
			copy(out[i:], input[i:])
			continue
		}
		block := input[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ {
				sum ^= gfMult(block[col], INV_MDS_MATRIX[row][col])
			}
			out[i+row] = sum
		}
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
		val := int(b) + int(keyCode)
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

// Encrypt transforms a plaintext mnemonic into an obfuscated and encrypted payload.
func (dc *DarkstarCrypt) Encrypt(mnemonic string, keyMaterial string, v int) (map[string]interface{}, error) {
	words := strings.Split(mnemonic, " ")
	var obfuscatedWords [][]byte
	var reverseKey [][]int

	isV5 := v >= 5
	isV4 := v == 4
	isModern := v >= 3

	var ctHex string
	var v7HmacKey []byte
	activePasswordStr := keyMaterial

	sch := mlkem1024.Scheme()
	if isV5 {
		pkBytes, err := hex.DecodeString(keyMaterial)
		if err != nil { return nil, fmt.Errorf("invalid kyber hex: %v", err) }
		pk, err := sch.UnmarshalBinaryPublicKey(pkBytes)
		if err != nil { return nil, fmt.Errorf("invalid public key: %v", err) }
		
		ct, ss, err := sch.Encapsulate(pk)
		if err != nil { return nil, err }
		
		ctHex = hex.EncodeToString(ct)
		ssBytes := ss
		
		if v >= 7 {
			// V7 Key Derivation
			cHasher := sha256.New()
			cHasher.Write([]byte("dkasp-v7-cipher-key"))
			cHasher.Write(ssBytes)
			cipherKeyHex := hex.EncodeToString(cHasher.Sum(nil))
			
			hHasher := sha256.New()
			hHasher.Write([]byte("dkasp-v7-hmac-key"))
			hHasher.Write(ssBytes)
			v7HmacKey = hHasher.Sum(nil)
			
			activePasswordStr = cipherKeyHex
		} else {
			activePasswordStr = hex.EncodeToString(ssBytes)
		}
		for i := range ssBytes { ssBytes[i] = 0 }
	}

	// V6+: Stop splitting by space. Treat as one binary stream.
	words = []string{mnemonic}
	if v < 6 {
		words = strings.Split(mnemonic, " ")
	}

	prngFactory := func(s string) PRNG {
		if isModern {
			return NewDarkstarChaChaPRNG(s)
		}
		return NewMulberry32(s)
	}

	// Fix 2: Chain state init (V6 only)
	var v6ChainState []byte
	if v >= 6 {
		init := sha256.Sum256([]byte("dkasp-chain-v6" + activePasswordStr))
		v6ChainState = init[:]
	}

	for index, word := range words {
		currentWordBytes := []byte(word)

		if v >= 6 {
			// V6+: Modern HMAC-based key schedule and path generation
			mac := hmac.New(sha256.New, []byte(activePasswordStr))
			mac.Write([]byte(fmt.Sprintf("dkasp-v6-word-%d", index)))
			wordKey := mac.Sum(nil)
			wordKeyHex := hex.EncodeToString(wordKey)

			// Fix 2: XOR word bytes with chain state before gauntlet
			for i := range currentWordBytes {
				currentWordBytes[i] ^= v6ChainState[i%32]
			}

			// Derive func key via HMAC
			baseSlice := make([]int, 12)
			for i := range baseSlice { baseSlice[i] = i }
			chk := generateChecksum(baseSlice)
			mac2 := hmac.New(sha256.New, wordKey)
			mac2.Write([]byte(fmt.Sprintf("keyed-%d", chk)))
			funcKey := mac2.Sum(nil)

			if v >= 8 {
				// V8: SPNA Structured Gauntlet (16 Rounds = 64 Layers) with Balanced Path
				rngPath := prngFactory(wordKeyHex)
				groupS := []int{0, 1, 5}
				groupP := []int{2, 3, 10}
				groupN := []int{7, 8, 11}
				groupA := []int{4, 6, 9}

				for i := 0; i < 16; i++ {
					// S: Substitution
					sIdx := 0
					if i%4 == 0 {
						sIdx = 0
					} else if i%4 == 2 {
						sIdx = 1
					} else {
						sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))]
					}
					currentWordBytes = dc.obfuscationFunctionsV4[sIdx](currentWordBytes, funcKey, prngFactory)

					// P: Permutation
					pIdx := groupP[int(rngPath.Next()%uint32(len(groupP)))]
					currentWordBytes = dc.obfuscationFunctionsV4[pIdx](currentWordBytes, funcKey, prngFactory)

					// N: Network (V9 prioritized MDS)
					var nIdx int
					if v >= 9 {
						groupN := []int{12, 12, 11}
						nIdx = groupN[int(rngPath.Next()%uint32(len(groupN)))]
					} else {
						if i%4 == 1 {
							nIdx = 8
						} else if i%4 == 3 {
							nIdx = 7
						} else {
							nIdx = groupN[int(rngPath.Next()%uint32(len(groupN)))]
						}
					}
					currentWordBytes = dc.obfuscationFunctionsV4[nIdx](currentWordBytes, funcKey, prngFactory)

					// A: Algebraic
					aIdx := groupA[int(rngPath.Next()%uint32(len(groupA)))]
					currentWordBytes = dc.obfuscationFunctionsV4[aIdx](currentWordBytes, funcKey, prngFactory)
				}
			} else {
				// V6-V7: Determinized randomized path
				hash := sha256.Sum256([]byte(wordKeyHex))
				depthVal := (int(hash[0]) << 8) | int(hash[1])
				cycleDepth := 12 + (depthVal % 501)
				rngPath := prngFactory(wordKeyHex)
				
				path := make([]int, 0, cycleDepth)
				lastThree := [3]int{99, 99, 99}
				for i := 0; i < cycleDepth; i++ {
					fi := int(rngPath.Next() % 12)
					if lastThree[0] == fi && lastThree[1] == fi && lastThree[2] == fi {
						fi = (fi + 1 + int(rngPath.Next()%11)) % 12
					}
					lastThree[0] = lastThree[1]; lastThree[1] = lastThree[2]; lastThree[2] = fi
					path = append(path, fi)
				}
				// Enforce min 6 distinct in first 12
				{
					first12 := path[:12]
					distinct := make(map[int]bool)
					for _, x := range first12 { distinct[x] = true }
					if len(distinct) < 6 {
						var missing []int
						for i := 0; i < 12; i++ { if !distinct[i] { missing = append(missing, i) } }
						mi := 0
						for i := 0; i < 12 && mi < len(missing); i++ {
							count := 0
							for _, x := range first12 { if x == path[i] { count++ } }
							if count > 2 { path[i] = missing[mi]; mi++ }
						}
					}
				}

				for _, funcIndex := range path {
					isSeeded := funcIndex == 4 || funcIndex == 5 || funcIndex == 6 || funcIndex == 9
					var seed []byte
					if isSeeded { seed = funcKey }
					currentWordBytes = dc.obfuscationFunctionsV4[funcIndex](currentWordBytes, seed, prngFactory)
				}
			}

			// Fix 2: Update chain state from obfuscated bytes
			chainInput := append(v6ChainState, currentWordBytes...)
			newState := sha256.Sum256(chainInput)
			v6ChainState = newState[:]
			obfuscatedWords = append(obfuscatedWords, currentWordBytes)
			continue

		} else {
			// Legacy V2-V5 path (unchanged)
			selectedFunctions := make([]int, 12)
			for i := 0; i < 12; i++ { selectedFunctions[i] = i }

			seedForSelection := activePasswordStr
			if v < 6 { seedForSelection += word }
			if v >= 5 { seedForSelection += strconv.Itoa(index) }
			rngSel := prngFactory(seedForSelection)
			for i := 11; i > 0; i-- {
				randVal := rngSel.Next()
				j := int((uint64(randVal) * uint64(i+1)) >> 32)
				selectedFunctions[i], selectedFunctions[j] = selectedFunctions[j], selectedFunctions[i]
			}

			cycleDepth := len(selectedFunctions)
			if isModern {
				hash := sha256.Sum256([]byte(seedForSelection))
				hashHex := hex.EncodeToString(hash[:])
				val, _ := strconv.ParseUint(hashHex[:4], 16, 32)
				depthVal := int(val)
				if v >= 5 { cycleDepth = 12 + (depthVal % 501) } else { cycleDepth = 12 + (depthVal % 53) }
			}

			checksum := generateChecksum(selectedFunctions)
			checksumStr := strconv.Itoa(checksum)
			indexStr := strconv.Itoa(index)
			combinedSeed := []byte(activePasswordStr + checksumStr)
			if v >= 5 { combinedSeed = append(combinedSeed, []byte(indexStr)...) }

			wordReverseKey := []int{}

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
				if isSeeded { seed = combinedSeed }

				currentWordBytes = f(currentWordBytes, seed, prngFactory)
				wordReverseKey = append(wordReverseKey, funcIndex)
			}
			obfuscatedWords = append(obfuscatedWords, currentWordBytes)
			reverseKey = append(reverseKey, wordReverseKey)
			continue
		}

		obfuscatedWords = append(obfuscatedWords, currentWordBytes)
	}

	// Packed Binary Reverse Key
	encodedReverseKey := ""
	if v < 6 {
		encodedReverseKey, _ = dc.packReverseKey(reverseKey, isModern)
	}

	// Final Blob Construction
	totalLength := 0
	for _, wb := range obfuscatedWords {
		totalLength += 2 + len(wb)
	}
	finalBlob := make([]byte, totalLength)
	offset := 0
	for _, wb := range obfuscatedWords {
		finalBlob[offset] = byte((len(wb) >> 8) & 0xff)
		finalBlob[offset+1] = byte(len(wb) & 0xff)
		copy(finalBlob[offset+2:], wb)
		offset += 2 + len(wb)
	}

	if len(finalBlob) > 16384 {
		return nil, fmt.Errorf("obfuscated payload exceeds 16384-byte limit (%d bytes)", len(finalBlob))
	}
	var finalPayload []byte
	if v >= 6 {
		// V6: encrypt exact blob — no fixed padding needed
		finalPayload = finalBlob
	} else {
		// V1-V5: pad to fixed size to obscure word count from stored reverse key
		paddedData := make([]byte, 16384)
		copy(paddedData, finalBlob)
		finalPayload = paddedData
	}

	var aad []byte
	if v < 6 {
		aad = []byte(encodedReverseKey)
	}

	var encryptedContent string
	var macTag string
	if v >= 7 {
		encryptedContent = hex.EncodeToString(finalPayload)
		ctBytes, _ := hex.DecodeString(ctHex)
		h := hmac.New(sha256.New, v7HmacKey)
		h.Write([]byte{byte(v)})
		h.Write(ctBytes)
		h.Write(finalPayload)
		macTag = hex.EncodeToString(h.Sum(nil))
	} else {
		var err error
		encryptedContent, err = dc.encryptAES256GCM(finalPayload, activePasswordStr, ITERATIONS_V2, aad)
		if err != nil { return nil, err }
	}

	inner := map[string]interface{}{
		"v":    v,
		"data": encryptedContent,
		"ct":   ctHex,
		"mac":  macTag,
	}
	innerJson, _ := json.Marshal(inner)

	return map[string]interface{}{
		"encryptedData": string(innerJson),
		"reverseKey":    encodedReverseKey,
	}, nil
}

func (dc *DarkstarCrypt) Decrypt(encryptedDataRaw, reverseKeyB64, keyMaterial string) (string, error) {
	isV3 := false
	isV4 := false
	isV5 := false
	isV6 := false
	ctHex := ""
	detectedVersion := 2
	encryptedContent := ""

	// Check Version
	if strings.HasPrefix(strings.TrimSpace(encryptedDataRaw), "{") {
		var parsed map[string]interface{}
		json.Unmarshal([]byte(encryptedDataRaw), &parsed)
		if ver, ok := parsed["v"].(float64); ok {
			detectedVersion = int(ver)
			if detectedVersion == 3 {
				isV3 = true
			} else if detectedVersion == 4 {
				isV4 = true
			} else if detectedVersion >= 5 {
				isV5 = true
				if detectedVersion >= 6 {
					isV6 = true
				}
				ctHex, _ = parsed["ct"].(string)
			}
		}
		if data, ok := parsed["data"].(string); ok {
			encryptedContent = data
		}
	}

	isModern := isV3 || isV4 || isV5 || isV6
	activePasswordStr := keyMaterial
	var v7HmacKey []byte
	if isV5 {
		sch := mlkem1024.Scheme()
		skBytes, err := hex.DecodeString(keyMaterial)
		if err != nil { return "", err }
		ctBytes, err := hex.DecodeString(ctHex)
		if err != nil { return "", err }
		
		sk, err := sch.UnmarshalBinaryPrivateKey(skBytes)
		if err != nil { return "", err }
		
		ssBytes, err := sch.Decapsulate(sk, ctBytes)
		if err != nil { return "", err }
		
		if detectedVersion >= 7 {
			// V7 Key Derivation
			cHasher := sha256.New()
			cHasher.Write([]byte("dkasp-v7-cipher-key"))
			cHasher.Write(ssBytes)
			cipherKeyHex := hex.EncodeToString(cHasher.Sum(nil))
			
			hHasher := sha256.New()
			hHasher.Write([]byte("dkasp-v7-hmac-key"))
			hHasher.Write(ssBytes)
			v7HmacKey = hHasher.Sum(nil)
			
			activePasswordStr = cipherKeyHex
		} else {
			activePasswordStr = hex.EncodeToString(ssBytes)
		}
		for i := range ssBytes { ssBytes[i] = 0 }
	}


	var aad []byte
	if isModern && !isV6 && reverseKeyB64 != "" {
		aad = []byte(reverseKeyB64)
	}

	// Decrypt Primary layer (AES or HMAC-V7)
	var fullBlob []byte
	if detectedVersion >= 7 {
		payloadBytes, err := hex.DecodeString(encryptedContent)
		if err != nil { return "", err }
		
		ctBytes, _ := hex.DecodeString(ctHex)
		h := hmac.New(sha256.New, v7HmacKey)
		h.Write([]byte{byte(detectedVersion)})
		h.Write(ctBytes)
		h.Write(payloadBytes)
		macTag := h.Sum(nil)
		
		var parsed map[string]interface{}
		json.Unmarshal([]byte(encryptedDataRaw), &parsed)
		expectedMacHex, _ := parsed["mac"].(string)
		expectedMac, _ := hex.DecodeString(expectedMacHex)
		
		if !hmac.Equal(macTag, expectedMac) {
			return "", errors.New("D-KASP V7: Integrity Check Failed (MAC mismatch)")
		}
		fullBlob = payloadBytes
	} else if isModern {
		dec, err := dc.decryptAES256GCM(encryptedContent, activePasswordStr, ITERATIONS_V2, aad)
		if err != nil { return "", err }
		if detectedVersion >= 5 {
			fullBlob = dec
		} else {
			s, err := base64.StdEncoding.DecodeString(string(dec))
			if err != nil { return "", err }
			fullBlob = s
		}
	} else {
		dec, err := dc.decryptAES256(encryptedContent, activePasswordStr, ITERATIONS_V2)
		if err != nil { return "", err }
		s, err := base64.StdEncoding.DecodeString(string(dec))
		if err != nil { return "", err }
		fullBlob = s
	}

	var reverseKeyJson [][]int
	if !isV6 {
		reverseKeyJson, _ = dc.unpackReverseKey(reverseKeyB64, isModern)
	}

	var deobfuscatedWords []string
	prngFactory := func(s string) PRNG {
		if isModern {
			return NewDarkstarChaChaPRNG(s)
		}
		return NewMulberry32(s)
	}

	offset := 0
	wordIndex := 0

	// Fix 2: Init chain state for V6 decrypt
	var v6ChainDecryptState []byte
	if isV6 {
		init := sha256.Sum256([]byte("dkasp-chain-v6" + activePasswordStr))
		v6ChainDecryptState = init[:]
	}

	for offset < len(fullBlob) {
		if !isV6 && wordIndex >= len(reverseKeyJson) {
			break
		}

		if offset+2 > len(fullBlob) { break }
		lenVal := (int(fullBlob[offset]) << 8) | int(fullBlob[offset+1])
		offset += 2
		if offset+lenVal > len(fullBlob) { break }
		cipherWordBytes := make([]byte, lenVal)
		copy(cipherWordBytes, fullBlob[offset:offset+lenVal])
		currentWordBytes := make([]byte, lenVal)
		copy(currentWordBytes, cipherWordBytes)
		offset += lenVal

		if isV6 {
			// Fix 1: HMAC key schedule
			mac := hmac.New(sha256.New, []byte(activePasswordStr))
			mac.Write([]byte(fmt.Sprintf("dkasp-v6-word-%d", wordIndex)))
			wordKey := mac.Sum(nil)
			wordKeyHex := hex.EncodeToString(wordKey)

			// Fix 4: Regenerate sanitised path (identical to encrypt)
			hashArr := sha256.Sum256([]byte(wordKeyHex))
			depthVal := (int(hashArr[0]) << 8) | int(hashArr[1])
			cycleDepth := 12 + (depthVal % 501)

			rngPath := prngFactory(wordKeyHex)
			path := make([]int, 0, cycleDepth)
			lastThree := [3]int{99, 99, 99}
			for i := 0; i < cycleDepth; i++ {
				fi := int(rngPath.Next() % 12)
				if lastThree[0] == fi && lastThree[1] == fi && lastThree[2] == fi {
					fi = (fi + 1 + int(rngPath.Next()%11)) % 12
				}
				lastThree[0] = lastThree[1]; lastThree[1] = lastThree[2]; lastThree[2] = fi
				path = append(path, fi)
			}
			// Fix 4b: Ensure min 6 distinct in first 12
			{
				first12 := path[:12]
				distinct := make(map[int]bool)
				for _, x := range first12 { distinct[x] = true }
				if len(distinct) < 6 {
					var missing []int
					for i := 0; i < 12; i++ { if !distinct[i] { missing = append(missing, i) } }
					mi := 0
					for i := 0; i < 12 && mi < len(missing); i++ {
						count := 0
						for _, x := range first12 { if x == path[i] { count++ } }
						if count > 2 { path[i] = missing[mi]; mi++ }
					}
				}
			}

			// Fix 1: Derive func key via HMAC
			baseSlice := make([]int, 12)
			for i := range baseSlice { baseSlice[i] = i }
			checksum := generateChecksum(baseSlice)
			mac2 := hmac.New(sha256.New, wordKey)
			mac2.Write([]byte(fmt.Sprintf("keyed-%d", checksum)))
			funcKey := mac2.Sum(nil)

			if detectedVersion >= 8 {
				// V8: Inverse SPNA Structured Gauntlet
				rngPath := prngFactory(wordKeyHex)
				groupS := []int{0, 1, 5}
				groupP := []int{2, 3, 10}
				groupN := []int{7, 8, 11}
				groupA := []int{4, 6, 9}

				type step struct{ s, p, n, a int }
				roundPaths := make([]step, 16)
				for i := 0; i < 16; i++ {
					// S: Substitution
					sIdx := 0
					if i % 4 == 0 {
						sIdx = 0 
					} else if i % 4 == 2 {
						sIdx = 1
					} else {
						sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))]
					}

					// P: Permutation
					pIdx := groupP[int(rngPath.Next()%uint32(len(groupP)))]

					// N: Network (V9 prioritized MDS)
					nIdx := 0
					if detectedVersion >= 9 {
						groupN_V9 := []int{12, 12, 11}
						nIdx = groupN_V9[int(rngPath.Next()%uint32(len(groupN_V9)))]
					} else {
						if i % 4 == 1 {
							nIdx = 8
						} else if i % 4 == 3 {
							nIdx = 7
						} else {
							nIdx = groupN[int(rngPath.Next()%uint32(len(groupN)))]
						}
					}

					// A: Algebraic
					aIdx := groupA[int(rngPath.Next()%uint32(len(groupA)))]

					roundPaths[i] = step{s: sIdx, p: pIdx, n: nIdx, a: aIdx}
				}

				for j := 15; j >= 0; j-- {
					r := roundPaths[j]
					// Inverse Order: A -> N -> P -> S
					currentWordBytes = dc.deobfuscationFunctionsV4[r.a](currentWordBytes, funcKey, prngFactory)
					currentWordBytes = dc.deobfuscationFunctionsV4[r.n](currentWordBytes, funcKey, prngFactory)
					currentWordBytes = dc.deobfuscationFunctionsV4[r.p](currentWordBytes, funcKey, prngFactory)
					currentWordBytes = dc.deobfuscationFunctionsV4[r.s](currentWordBytes, funcKey, prngFactory)
				}
			} else {
				// Apply inverse transforms in reverse order
				for j := len(path) - 1; j >= 0; j-- {
					funcIndex := path[j]
					isSeeded := funcIndex == 4 || funcIndex == 5 || funcIndex == 6 || funcIndex == 9
					var seed []byte
					if isSeeded {
						seed = funcKey
					}
					currentWordBytes = dc.deobfuscationFunctionsV4[funcIndex](currentWordBytes, seed, prngFactory)
				}
			}

			// Fix 2: Undo chain XOR, then advance chain from cipher bytes
			for i := range currentWordBytes {
				currentWordBytes[i] ^= v6ChainDecryptState[i%32]
			}
			chainInput := append(v6ChainDecryptState, cipherWordBytes...)
			newState := sha256.Sum256(chainInput)
			v6ChainDecryptState = newState[:]

		} else {
			wordReverseKey := reverseKeyJson[wordIndex]

			uniqueFuncs := make(map[int]bool)
			for _, f := range wordReverseKey { uniqueFuncs[f] = true }
			var uniqueSet []int
			for f := range uniqueFuncs { uniqueSet = append(uniqueSet, f) }
			finalChecksum := generateChecksum(uniqueSet)

			checksumStr := strconv.Itoa(finalChecksum)
			indexStr := strconv.Itoa(wordIndex)
			combinedSeed := []byte(activePasswordStr + checksumStr)
			if detectedVersion >= 5 { combinedSeed = append(combinedSeed, []byte(indexStr)...) }

			for j := len(wordReverseKey) - 1; j >= 0; j-- {
				funcIndex := wordReverseKey[j]
				var f func([]byte, []byte, func(string) PRNG) []byte
				var isSeeded bool
				if isV6 {
					f = dc.deobfuscationFunctionsV4[funcIndex]
					isSeeded = funcIndex >= 6
				} else if isV4 || isV5 {
					f = dc.deobfuscationFunctionsV4[funcIndex]
					isSeeded = funcIndex == 4 || funcIndex == 5 || funcIndex == 6 || funcIndex == 9
				} else {
					f = dc.deobfuscationFunctionsV2[funcIndex]
					isSeeded = funcIndex >= 6
				}
				var seed []byte
				if isSeeded { seed = combinedSeed }
				currentWordBytes = f(currentWordBytes, seed, prngFactory)
			}
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

func (dc *DarkstarCrypt) encryptAES256GCM(data []byte, password string, iterations int, aad []byte) (string, error) {
	salt := make([]byte, SALT_SIZE_BYTES)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	key := pbkdf2.Key([]byte(password), salt, iterations, KEY_SIZE, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesgcm.Seal(nil, nonce, data, aad)

	saltHex := hex.EncodeToString(salt)
	ivHex := hex.EncodeToString(nonce)
	cipherB64 := base64.StdEncoding.EncodeToString(ciphertext)

	for i := range key {
		key[i] = 0
	}

	return saltHex + ivHex + cipherB64, nil
}

func (dc *DarkstarCrypt) decryptAES256GCM(transitMessage, password string, iterations int, aad []byte) ([]byte, error) {
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

	plaintext, err := aesgcm.Open(nil, iv, ciphertext, aad)
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
	fmt.Println("Darkstar D-KASP-512 (V5) Cryptographic Suite")
	fmt.Println("\nUsage:")
	fmt.Println("  darkstar [flags] <command> [args]")
	fmt.Println("\nFlags:")
	fmt.Println("  -v, --v <1-5>       D-KASP Protocol Version (default: 5)")
	fmt.Println("  -c, --core <aes|arx> Encryption Core (default: aes)")
	fmt.Println("  -f, --format <json|csv|text> Output format")
	fmt.Println("\nCommands:")
	fmt.Println("  encrypt <mnemonic> <password>    Encrypt a mnemonic phrase")
	fmt.Println("  decrypt <data> <rk> <password>   Decrypt a Darkstar payload")
	fmt.Println("  keygen                          Generate ML-KEM-1024 Keypair")
	fmt.Println("  test                            Run internal self-test")
}

func resolveArg(arg string) string {
	if strings.HasPrefix(arg, "@") {
		path := arg[1:]
		content, err := os.ReadFile(path)
		if err != nil {
			fmt.Printf("Error reading argument file %s: %v\n", path, err)
			os.Exit(1)
		}
		return strings.TrimSpace(string(content))
	}
	return arg
}

func main() {
	var v int = 5
	var format string = ""
	// var core string = "aes"

	args := os.Args[1:]
	for len(args) > 0 && strings.HasPrefix(args[0], "-") {
		arg := args[0]
		if arg == "-h" || arg == "--help" {
			printUsage()
			return
		}
		if (arg == "-v" || arg == "--v") && len(args) > 1 {
			v, _ = strconv.Atoi(args[1])
			args = args[2:]
		} else if (arg == "-f" || arg == "--format") && len(args) > 1 {
			format = args[1]
			args = args[2:]
		} else if (arg == "-c" || arg == "--core") && len(args) > 1 {
			// core = args[1]
			args = args[2:]
		} else {
			// Legacy flags or unknown
			if arg == "--v1" { v = 1 }
			if arg == "--v2" { v = 2 }
			if arg == "--v3" { v = 3 }
			if arg == "--v4" { v = 4 }
			if arg == "--v5" { v = 5 }
			args = args[1:]
		}
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
		mnemonic := resolveArg(args[1])
		password := resolveArg(args[2])
		res, err := dc.Encrypt(mnemonic, password, v)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		
		f := format
		if f == "" { f = "json" }
		
		switch f {
		case "json":
			j, _ := json.Marshal(res)
			fmt.Println(string(j))
		case "csv":
			fmt.Printf("%s,%s\n", res["encryptedData"], res["reverseKey"])
		default:
			fmt.Printf("Data: %s\nReverseKey: %s\n", res["encryptedData"], res["reverseKey"])
		}

	case "decrypt":
		if len(args) < 4 {
			fmt.Println("Error: decrypt requires data, rk and password")
			os.Exit(1)
		}
		data := resolveArg(args[1])
		rk := resolveArg(args[2])
		password := resolveArg(args[3])
		res, err := dc.Decrypt(data, rk, password)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		
		if format == "json" {
			fmt.Printf("{\"decrypted\":\"%s\"}\n", res)
		} else {
			fmt.Print(res)
		}

	case "keygen":
		sch := mlkem1024.Scheme()
		pk, sk, _ := sch.GenerateKeyPair()
		pkBytes, _ := pk.MarshalBinary()
		skBytes, _ := sk.MarshalBinary()
		pkHex := hex.EncodeToString(pkBytes)
		skHex := hex.EncodeToString(skBytes)
		
		f := format
		if f == "" { f = "text" }
		
		switch f {
		case "json":
			fmt.Printf("{\"pk\":\"%s\",\"sk\":\"%s\"}\n", pkHex, skHex)
		case "csv":
			fmt.Printf("%s,%s\n", pkHex, skHex)
		default:
			fmt.Printf("PK: %s\nSK: %s\n", pkHex, skHex)
		}

	case "test":
		mnemonic := "apple banana cherry date"
		password := "MySecre!Password123"
		decPsw := password
		
		if v >= 5 {
			sch := mlkem1024.Scheme()
			pk, sk, _ := sch.GenerateKeyPair()
			pkBytes, _ := pk.MarshalBinary()
			skBytes, _ := sk.MarshalBinary()
			password = hex.EncodeToString(pkBytes)
			decPsw = hex.EncodeToString(skBytes)
		}
		
		fmt.Printf("--- Darkstar Go Self-Test (V%d) ---\n", v)
		res, err := dc.Encrypt(mnemonic, password, v)
		if err != nil {
			fmt.Printf("Test Encryption Failed: %v\n", err)
			os.Exit(1)
		}
		
		decrypted, err := dc.Decrypt(res["encryptedData"].(string), res["reverseKey"].(string), decPsw)
		if err != nil {
			fmt.Printf("Test Decryption Failed: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Printf("Decrypted: '%s'\n", decrypted)
		if decrypted == mnemonic {
			fmt.Println("Result: PASSED")
		} else {
			fmt.Println("Result: FAILED")
			os.Exit(1)
		}

	default:
		fmt.Printf("Error: Unknown command %s\n", command)
		printUsage()
	}
}

