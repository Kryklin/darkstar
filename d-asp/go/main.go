// Package main implements the D-ASP cryptographic suite.
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/cloudflare/circl/kem/mlkem/mlkem1024"
)

var globalDiagnostic = false

// PRNG defines the interface for deterministic random number generation.
type PRNG interface {
	Next() uint32
}

type DarkstarChaChaPRNG struct {
	state    [16]uint32
	block    [16]uint32
	blockIdx int
}

func NewDarkstarChaChaPRNG(seedStr string) *DarkstarChaChaPRNG {
	c := &DarkstarChaChaPRNG{}
	hash := sha256.Sum256([]byte(seedStr))
	c.state[0] = 0x61707865; c.state[1] = 0x3320646e; c.state[2] = 0x79622d32; c.state[3] = 0x6b206574;
	for i := 0; i < 8; i++ {
		chunk := hash[i*4 : (i+1)*4]
		c.state[4+i] = uint32(chunk[0]) | uint32(chunk[1])<<8 | uint32(chunk[2])<<16 | uint32(chunk[3])<<24
	}
	c.state[12] = 0; c.state[13] = 0; c.state[14] = 0; c.state[15] = 0
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

type TransformationFn func([]byte, []byte, func(string) PRNG) []byte

type DarkstarCrypt struct {
	forwardPipeline []TransformationFn
	reversePipeline []TransformationFn
}

func NewDarkstarCrypt() *DarkstarCrypt {
	dc := &DarkstarCrypt{}
	dc.forwardPipeline = []TransformationFn{
		dc.transSBox, dc.transModMult, dc.transPBox, dc.transCyclicRot,
		dc.transKeyedXOR, dc.transFeistel, dc.transModAdd, dc.transMatrixHill,
		dc.transGFMult, dc.transBitFlip, dc.transColumnar, dc.transRecXOR, dc.transMDSNetwork,
	}
	dc.reversePipeline = []TransformationFn{
		dc.invTransSBox, dc.invTransModMult, dc.invTransPBox, dc.invTransCyclicRot,
		dc.invTransKeyedXOR, dc.invTransFeistel, dc.invTransModAdd, dc.invTransMatrixHill,
		dc.invTransGFMult, dc.invTransBitFlip, dc.invTransColumnar, dc.invTransRecXOR, dc.invTransMDSNetwork,
	}
	return dc
}

func cleanHex(s string) string {
	re := regexp.MustCompile("[^a-fA-F0-9]")
	return re.ReplaceAllString(s, "")
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
		if (b & 1) != 0 { p ^= a }
		hi := a & 0x80
		a = a << 1
		if hi != 0 { a ^= 0x1b }
		b >>= 1
	}
	return p
}

func (dc *DarkstarCrypt) transSBox(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = SBOX[b] }
	return out
}
func (dc *DarkstarCrypt) invTransSBox(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = INV_SBOX[b] }
	return out
}
func (dc *DarkstarCrypt) transModMult(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = byte((uint16(b) * 167) & 0xFF) }
	return out
}
func (dc *DarkstarCrypt) invTransModMult(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = byte((uint16(b) * 23) & 0xFF) }
	return out
}
func (dc *DarkstarCrypt) transPBox(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	n := len(in)
	for i := 0; i < n; i++ {
		b := in[i]
		b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4)
		b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2)
		b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1)
		out[n-1-i] = b
	}
	return out
}
func (dc *DarkstarCrypt) invTransPBox(in []byte, s []byte, pf func(string) PRNG) []byte {
	return dc.transPBox(in, s, pf)
}
func (dc *DarkstarCrypt) transCyclicRot(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = (b >> 3) | (b << 5) }
	return out
}
func (dc *DarkstarCrypt) invTransCyclicRot(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = (b << 3) | (b >> 5) }
	return out
}
func (dc *DarkstarCrypt) transKeyedXOR(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = b ^ s[i%len(s)] }
	return out
}
func (dc *DarkstarCrypt) invTransKeyedXOR(in []byte, s []byte, pf func(string) PRNG) []byte {
	return dc.transKeyedXOR(in, s, pf)
}
func (dc *DarkstarCrypt) transFeistel(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	copy(out, in)
	half := len(out) / 2
	if half == 0 { return out }
	for i := 0; i < half; i++ { out[i] ^= (out[half+i] + s[i%len(s)]) }
	return out
}
func (dc *DarkstarCrypt) invTransFeistel(in []byte, s []byte, pf func(string) PRNG) []byte {
	return dc.transFeistel(in, s, pf)
}
func (dc *DarkstarCrypt) transModAdd(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = b + s[i%len(s)] }
	return out
}
func (dc *DarkstarCrypt) invTransModAdd(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = b - s[i%len(s)] }
	return out
}
func (dc *DarkstarCrypt) transMatrixHill(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) == 0 { return make([]byte, 0) }
	out := make([]byte, len(in)); out[0] = in[0]
	for i := 1; i < len(in); i++ { out[i] = in[i] + out[i-1] }
	return out
}
func (dc *DarkstarCrypt) invTransMatrixHill(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) == 0 { return make([]byte, 0) }
	out := make([]byte, len(in)); out[0] = in[0]
	for i := len(in) - 1; i > 0; i-- { out[i] = in[i] - in[i-1] }
	return out
}
func (dc *DarkstarCrypt) transGFMult(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = gfMult(b, 0x02) }
	return out
}
func (dc *DarkstarCrypt) invTransGFMult(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in { out[i] = gfMult(b, 0x8d) }
	return out
}
func (dc *DarkstarCrypt) transBitFlip(in []byte, s []byte, pf func(string) PRNG) []byte {
	out := make([]byte, len(in))
	for i, b := range in {
		mask := s[i%len(s)]
		out[i] = b ^ ((mask & 0xAA) | (^mask & 0x55))
	}
	return out
}
func (dc *DarkstarCrypt) invTransBitFlip(in []byte, s []byte, pf func(string) PRNG) []byte {
	return dc.transBitFlip(in, s, pf)
}
func (dc *DarkstarCrypt) transColumnar(in []byte, s []byte, pf func(string) PRNG) []byte {
	n := len(in); out := make([]byte, n)
	cols := 3; idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols { out[idx] = in[i]; idx++ }
	}
	return out
}
func (dc *DarkstarCrypt) invTransColumnar(in []byte, s []byte, pf func(string) PRNG) []byte {
	n := len(in); out := make([]byte, n)
	cols := 3; idx := 0
	for c := 0; c < cols; c++ {
		for i := c; i < n; i += cols { out[i] = in[idx]; idx++ }
	}
	return out
}
func (dc *DarkstarCrypt) transRecXOR(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) == 0 { return make([]byte, 0) }
	out := make([]byte, len(in)); out[0] = in[0]
	for i := 1; i < len(in); i++ { out[i] = out[i-1] ^ in[i] }
	return out
}
func (dc *DarkstarCrypt) invTransRecXOR(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) == 0 { return make([]byte, 0) }
	out := make([]byte, len(in)); out[0] = in[0]
	for i := len(in) - 1; i > 0; i-- { out[i] = in[i] ^ in[i-1] }
	return out
}

var MDS = [4][4]byte{
	{0x02, 0x03, 0x01, 0x01}, {0x01, 0x02, 0x03, 0x01},
	{0x01, 0x01, 0x02, 0x03}, {0x03, 0x01, 0x01, 0x02},
}
var INV_MDS = [4][4]byte{
	{0x0E, 0x0B, 0x0D, 0x09}, {0x09, 0x0E, 0x0B, 0x0D},
	{0x0D, 0x09, 0x0E, 0x0B}, {0x0B, 0x0D, 0x09, 0x0E},
}

func (dc *DarkstarCrypt) transMDSNetwork(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) < 4 { return dc.transMatrixHill(in, s, pf) }
	out := make([]byte, len(in))
	for i := 0; i < len(in); i += 4 {
		end := i + 4
		if end > len(in) { copy(out[i:], in[i:]); continue }
		block := in[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ { sum ^= gfMult(block[col], MDS[row][col]) }
			out[i+row] = sum
		}
	}
	return out
}
func (dc *DarkstarCrypt) invTransMDSNetwork(in []byte, s []byte, pf func(string) PRNG) []byte {
	if len(in) < 4 { return dc.invTransMatrixHill(in, s, pf) }
	out := make([]byte, len(in))
	for i := 0; i < len(in); i += 4 {
		end := i + 4
		if end > len(in) { copy(out[i:], in[i:]); continue }
		block := in[i:end]
		for row := 0; row < 4; row++ {
			var sum byte = 0
			for col := 0; col < 4; col++ { sum ^= gfMult(block[col], INV_MDS[row][col]) }
			out[i+row] = sum
		}
	}
	return out
}

func (dc *DarkstarCrypt) Encrypt(payload string, pkHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	pkBytes, _ := hex.DecodeString(cleanHex(pkHex))
	var finalHwid []byte = hwid
	if len(pkBytes) == 1600 && len(finalHwid) == 0 {
		finalHwid = pkBytes[1568:]; pkBytes = pkBytes[:1568]
	}

	sch := mlkem1024.Scheme()
	kemStart := time.Now()
	pk, err := sch.UnmarshalBinaryPublicKey(pkBytes); if err != nil { return "", err }
	ss, ct, err := sch.Encapsulate(pk); if err != nil { return "", err }
	kemDur := time.Since(kemStart)

	kdfStart := time.Now()
	kHasher := sha256.New(); kHasher.Write(ss)
	if len(finalHwid) > 0 { kHasher.Write(finalHwid) }
	kHasher.Write([]byte("dasp-identity-v3"))
	blendedSS := kHasher.Sum(nil)
	blendedSSHex := hex.EncodeToString(blendedSS)

	cHasher := sha256.New(); cHasher.Write(append([]byte("cipher"), blendedSS...))
	cipherKey := cHasher.Sum(nil); activePasswordStr := hex.EncodeToString(cipherKey)

	hHasher := sha256.New(); hHasher.Write(append([]byte("hmac"), blendedSS...))
	activeHmacKey := hHasher.Sum(nil)

	macGen := hmac.New(sha256.New, []byte(activePasswordStr)); macGen.Write([]byte("dasp-word-0"))
	wordKey := macGen.Sum(nil); wordKeyHex := hex.EncodeToString(wordKey)
	kdfDur := time.Since(kdfStart)

	prngFactory := func(s string) PRNG { return NewDarkstarChaChaPRNG(s) }
	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	currentWordBytes := []byte(payload)
	for i := range currentWordBytes { currentWordBytes[i] ^= chainState[i%32] }

	chk := generateChecksum([]int{0,1,2,3,4,5,6,7,8,9,10,11})
	mac2 := hmac.New(sha256.New, wordKey); mac2.Write([]byte(fmt.Sprintf("keyed-%d", chk)))
	funcKey := mac2.Sum(nil)

	rngPath := prngFactory(wordKeyHex)
	groupS := []int{0, 1, 5}; groupP := []int{2, 3, 10}
	groupN := []int{12, 12, 11}; groupA := []int{4, 6, 9}

	var roundIndices [][]int
	gauntletStart := time.Now()
	for i := 0; i < 16; i++ {
		sIdx := 0
		switch i % 4 {
		case 0:
			sIdx = 0
		case 2:
			sIdx = 1
		default:
			sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))]
		}
		pIdx := groupP[int(rngPath.Next()%uint32(len(groupP)))]
		nIdx := groupN[int(rngPath.Next()%uint32(len(groupN)))]
		aIdx := groupA[int(rngPath.Next()%uint32(len(groupA)))]
		
		currentWordBytes = dc.forwardPipeline[sIdx](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.forwardPipeline[pIdx](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.forwardPipeline[nIdx](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.forwardPipeline[aIdx](currentWordBytes, funcKey, prngFactory)
		roundIndices = append(roundIndices, []int{sIdx, pIdx, nIdx, aIdx})
	}
	gauntletDur := time.Since(gauntletStart)
	runtime.KeepAlive(currentWordBytes)

	h := hmac.New(sha256.New, activeHmacKey); h.Write(ct); h.Write(currentWordBytes)
	macTag := hex.EncodeToString(h.Sum(nil))

	if globalDiagnostic || os.Getenv("DASP_DIAGNOSTIC") == "1" {
		diag := map[string]interface{}{
			"diagnostics": map[string]interface{}{
				"stage1_blended_ss": blendedSSHex,
				"stage2_word_key":   wordKeyHex,
				"stage3_round_indices": roundIndices,
				"stage4_mac":        macTag,
			},
		}
		dj, _ := json.Marshal(diag); fmt.Fprintf(os.Stderr, "%s\n", dj)
	}

	totalDur := time.Since(totalStart)
	timingReport := map[string]interface{}{
		"timings": map[string]interface{}{
			"kem_us":      kemDur.Microseconds(),
			"kdf_us":      kdfDur.Microseconds(),
			"gauntlet_us": gauntletDur.Microseconds(),
			"total_us":    totalDur.Microseconds(),
		},
	}
	tj, _ := json.Marshal(timingReport)
	fmt.Fprintf(os.Stderr, "%s\n", tj)

	inner := map[string]interface{}{"data": hex.EncodeToString(currentWordBytes), "ct": hex.EncodeToString(ct), "mac": macTag}
	innerJson, _ := json.Marshal(inner); return string(innerJson), nil
}


func (dc *DarkstarCrypt) Decrypt(encDataRaw string, skHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	var val map[string]interface{}
	if err := json.Unmarshal([]byte(encDataRaw), &val); err != nil { return "", err }
	ctHex, _ := val["ct"].(string); dataHex, _ := val["data"].(string); macHex, _ := val["mac"].(string)

	skBytes, _ := hex.DecodeString(cleanHex(skHex))
	var finalHwid []byte = hwid
	if len(skBytes) == 3200 && len(finalHwid) == 0 {
		finalHwid = skBytes[3168:]; skBytes = skBytes[:3168]
	}

	ctBytes, _ := hex.DecodeString(ctHex); payloadBytes, _ := hex.DecodeString(dataHex)
	sch := mlkem1024.Scheme()
	kemStart := time.Now()
	sk, err := sch.UnmarshalBinaryPrivateKey(skBytes); if err != nil { return "", err }
	ss, err := sch.Decapsulate(sk, ctBytes); if err != nil { return "", err }
	kemDur := time.Since(kemStart)

	kdfStart := time.Now()
	kHasher := sha256.New(); kHasher.Write(ss)
	if len(finalHwid) > 0 { kHasher.Write(finalHwid) }
	kHasher.Write([]byte("dasp-identity-v3"))
	blendedSS := kHasher.Sum(nil); blendedSSHex := hex.EncodeToString(blendedSS)

	cHasher := sha256.New(); cHasher.Write(append([]byte("cipher"), blendedSS...))
	cipherKey := cHasher.Sum(nil); activePasswordStr := hex.EncodeToString(cipherKey)

	hHasher := sha256.New(); hHasher.Write(append([]byte("hmac"), blendedSS...))
	activeHmacKey := hHasher.Sum(nil)

	macGen := hmac.New(sha256.New, []byte(activePasswordStr)); macGen.Write([]byte("dasp-word-0"))
	wordKey := macGen.Sum(nil); wordKeyHex := hex.EncodeToString(wordKey)
	kdfDur := time.Since(kdfStart)

	prngFactory := func(s string) PRNG { return NewDarkstarChaChaPRNG(s) }
	rngPath := prngFactory(wordKeyHex)
	type stp struct{ s, p, n, a int }
	roundPaths := make([]stp, 16); var roundIndices [][]int
	groupS := []int{0, 1, 5}; groupP := []int{2, 3, 10}
	groupN := []int{12, 12, 11}; groupA := []int{4, 6, 9}

	for i := 0; i < 16; i++ {
		sIdx := 0
		switch i % 4 {
		case 0:
			sIdx = 0
		case 2:
			sIdx = 1
		default:
			sIdx = groupS[int(rngPath.Next()%uint32(len(groupS)))]
		}
		pIdx := groupP[int(rngPath.Next()%uint32(len(groupP)))]
		nIdx := groupN[int(rngPath.Next()%uint32(len(groupN)))]
		aIdx := groupA[int(rngPath.Next()%uint32(len(groupA)))]
		roundPaths[i] = stp{sIdx, pIdx, nIdx, aIdx}
		roundIndices = append(roundIndices, []int{sIdx, pIdx, nIdx, aIdx})
	}

	h := hmac.New(sha256.New, activeHmacKey); h.Write(ctBytes); h.Write(payloadBytes)
	macActual := hex.EncodeToString(h.Sum(nil))

	if globalDiagnostic || os.Getenv("DASP_DIAGNOSTIC") == "1" {
		diag := map[string]interface{}{
			"diagnostics": map[string]interface{}{
				"stage1_raw_ss": hex.EncodeToString(ss),
				"stage1_blended_ss": blendedSSHex,
				"stage2_word_key": wordKeyHex, "stage3_round_indices": roundIndices,
				"stage4_mac": macActual,
			},
		}
		dj, _ := json.Marshal(diag); fmt.Fprintf(os.Stderr, "%s\n", dj)
	}

	tag, _ := hex.DecodeString(macHex)
	if !hmac.Equal(h.Sum(nil), tag) { return "", errors.New("Integrity Check Failed") }

	chk := generateChecksum([]int{0,1,2,3,4,5,6,7,8,9,10,11})
	mac2 := hmac.New(sha256.New, wordKey); mac2.Write([]byte(fmt.Sprintf("keyed-%d", chk)))
	funcKey := mac2.Sum(nil)

	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	gauntletStart := time.Now()
	currentWordBytes := payloadBytes
	for j := 15; j >= 0; j-- {
		r := roundPaths[j]
		currentWordBytes = dc.reversePipeline[r.a](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.n](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.p](currentWordBytes, funcKey, prngFactory)
		currentWordBytes = dc.reversePipeline[r.s](currentWordBytes, funcKey, prngFactory)
	}
	gauntletDur := time.Since(gauntletStart)
	runtime.KeepAlive(currentWordBytes)

	for i := range currentWordBytes { currentWordBytes[i] ^= chainState[i%32] }

	totalDur := time.Since(totalStart)
	timingReport := map[string]interface{}{
		"timings": map[string]interface{}{
			"kem_us":      kemDur.Microseconds(),
			"kdf_us":      kdfDur.Microseconds(),
			"gauntlet_us": gauntletDur.Microseconds(),
			"total_us":    totalDur.Microseconds(),
		},
	}
	tj, _ := json.Marshal(timingReport)
	fmt.Fprintf(os.Stderr, "%s\n", tj)

	return string(currentWordBytes), nil
}

func main() {
	var hwid []byte
	args := os.Args[1:]
	
	// Flag parsing for --diagnostic
	var filtered []string
	for _, arg := range args {
		if arg == "--diagnostic" {
			globalDiagnostic = true
		} else {
			filtered = append(filtered, arg)
		}
	}
	args = filtered

	for i := 0; i < len(args); i++ {
		if args[i] == "--hwid" && i+1 < len(args) {
			val := args[i+1]
			if strings.HasPrefix(val, "@") {
				c, err := os.ReadFile(val[1:])
				if err != nil { fmt.Fprintf(os.Stderr, "Error reading HWID file: %v\n", err); os.Exit(1) }
				val = string(c)
			}
			hwid, _ = hex.DecodeString(cleanHex(val))
			args = append(args[:i], args[i+2:]...); i--
		}
	}
	if len(args) < 1 { return }
	command := args[0]
	dc := NewDarkstarCrypt()
	resolve := func(s string) string {
		if strings.HasPrefix(s, "@") {
			c, err := os.ReadFile(s[1:])
			if err != nil { fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err); os.Exit(1) }
			return strings.TrimSpace(string(c))
		}
		return s
	}

	switch command {
	case "encrypt":
		res, err := dc.Encrypt(resolve(args[1]), resolve(args[2]), hwid)
		if err != nil { fmt.Fprintf(os.Stderr, "Encryption Error: %v\n", err); os.Exit(1) }
		fmt.Println(res)
	case "decrypt":
		res, err := dc.Decrypt(resolve(args[1]), resolve(args[2]), hwid)
		if err != nil { fmt.Fprintf(os.Stderr, "Decryption Error: %v\n", err); os.Exit(1) }
		fmt.Print(res)
	case "keygen":
		sch := mlkem1024.Scheme()
		pk, sk, _ := sch.GenerateKeyPair()
		pkb, _ := pk.MarshalBinary(); skb, _ := sk.MarshalBinary()
		fmt.Printf("PK: %s\nSK: %s\n", hex.EncodeToString(pkb), hex.EncodeToString(skb))
	case "test":
		sch := mlkem1024.Scheme()
		pk, sk, _ := sch.GenerateKeyPair()
		pkb, _ := pk.MarshalBinary(); skb, _ := sk.MarshalBinary()
		pkHex := hex.EncodeToString(pkb); skHex := hex.EncodeToString(skb)
		res, _ := dc.Encrypt("test payload", pkHex, nil)
		dec, _ := dc.Decrypt(res, skHex, nil)
		fmt.Printf("Decrypted: %s\n", dec)
	}
}
