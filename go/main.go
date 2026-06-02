/*
 * D-ASP (ASP Cascade 16)
 * Implementation: Go (High-Performance Implementation)
 *
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

// Package main implements the D-ASP (ASP Cascade 16) cryptographic engine.
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/cloudflare/circl/kem/mlkem/mlkem1024"
)

var globalDiagnostic = false
var globalTelemetry = false

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
	hash := sha512.Sum512([]byte(seedStr))
	c.state[0] = 0x61707865
	c.state[1] = 0x3320646e
	c.state[2] = 0x79622d32
	c.state[3] = 0x6b206574
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
		x[a] += x[b]
		x[d] ^= x[a]
		x[d] = rotate(x[d], 16)
		x[c] += x[d]
		x[b] ^= x[c]
		x[b] = rotate(x[b], 12)
		x[a] += x[b]
		x[d] ^= x[a]
		x[d] = rotate(x[d], 8)
		x[c] += x[d]
		x[b] ^= x[c]
		x[b] = rotate(x[b], 7)
	}
	for i := 0; i < 10; i++ {
		quarterRound(0, 4, 8, 12)
		quarterRound(1, 5, 9, 13)
		quarterRound(2, 6, 10, 14)
		quarterRound(3, 7, 11, 15)
		quarterRound(0, 5, 10, 15)
		quarterRound(1, 6, 11, 12)
		quarterRound(2, 7, 8, 13)
		quarterRound(3, 4, 9, 14)
	}
	for i := 0; i < 16; i++ {
		x[i] += st[i]
	}
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

type DarkstarCrypt struct{}

func NewDarkstarCrypt() *DarkstarCrypt {
	return &DarkstarCrypt{}
}

func cleanHex(s string) string {
	var b strings.Builder
	for _, c := range s {
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			b.WriteRune(c)
		}
	}
	return b.String()
}

func daspCascade32(block []byte, roundKeys []uint32) {
	var state [8]uint32
	for i := 0; i < 8; i++ {
		state[i] = binary.LittleEndian.Uint32(block[i*4 : (i+1)*4])
	}

	rotate := func(v, n uint32) uint32 { return (v << n) | (v >> (32 - n)) }
	distArr := [3]int{4, 2, 1}
	rotArr := [4]uint32{16, 12, 8, 7}

	for r := uint32(0); r < 16; r++ {
		rk := roundKeys[r*8 : (r+1)*8]
		for j := 0; j < 8; j++ {
			state[j] += rk[j]
		}
		rc := 0x9E3779B9 + r
		for j := 0; j < 8; j++ {
			state[j] ^= rc
		}

		dist := distArr[r%3]
		rot := rotArr[r%4]

		for i := 0; i < 8; i += dist * 2 {
			for j := 0; j < dist; j++ {
				a := i + j
				b := i + j + dist
				state[a] += state[b]
				state[b] ^= state[a]
				state[b] = rotate(state[b], rot)
			}
		}
	}

	for i := 0; i < 8; i++ {
		binary.LittleEndian.PutUint32(block[i*4:(i+1)*4], state[i])
	}
}

func (dc *DarkstarCrypt) Encrypt(payloadStr string, pkHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	pkBytes, _ := hex.DecodeString(cleanHex(pkHex))

	sch := mlkem1024.Scheme()
	kemStart := time.Now()
	pk, err := sch.UnmarshalBinaryPublicKey(pkBytes)
	if err != nil {
		return "", err
	}
	ctBytes, ss, err := sch.Encapsulate(pk)
	if err != nil {
		return "", err
	}
	kemDur := time.Since(kemStart)
	ctHex := hex.EncodeToString(ctBytes)

	kdfStart := time.Now()
	var prk []byte
	if len(hwid) > 0 {
		mac := hmac.New(sha256.New, hwid)
		mac.Write(ss)
		prk = mac.Sum(nil)
	} else {
		mac := hmac.New(sha256.New, make([]byte, 32))
		mac.Write(ss)
		prk = mac.Sum(nil)
	}
	macExp := hmac.New(sha256.New, prk)
	macExp.Write([]byte("dasp-identity-v3\x01"))
	blendedSS := macExp.Sum(nil)
	blendedSSHex := hex.EncodeToString(blendedSS)

	cHasher := sha256.New()
	cHasher.Write(append([]byte("cipher"), blendedSS...))
	cipherKey := cHasher.Sum(nil)
	activePasswordStr := hex.EncodeToString(cipherKey)

	hHasher := sha256.New()
	hHasher.Write(append([]byte("hmac"), blendedSS...))
	activeHmacKey := hHasher.Sum(nil)

	macGen := hmac.New(sha256.New, []byte(activePasswordStr))
	macGen.Write([]byte("dasp-word-0"))
	wordKey := macGen.Sum(nil)
	wordKeyHex := hex.EncodeToString(wordKey)

	for i := range ss {
		ss[i] = 0
	}
	runtime.KeepAlive(ss)
	kdfDur := time.Since(kdfStart)

	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	rngPath := NewDarkstarChaChaPRNG(wordKeyHex)
	var roundKeys [128]uint32
	for i := 0; i < 128; i++ {
		roundKeys[i] = rngPath.Next()
	}

	payloadBytes := []byte(payloadStr)
	cascadeStart := time.Now()

	nonce := make([]byte, 32)
	copy(nonce, chainState)

	for i := 0; i < len(payloadBytes); i += 32 {
		chunkLen := 32
		if i+chunkLen > len(payloadBytes) {
			chunkLen = len(payloadBytes) - i
		}

		block := make([]byte, 32)
		copy(block, nonce)

		daspCascade32(block, roundKeys[:])

		for j := 0; j < chunkLen; j++ {
			payloadBytes[i+j] ^= block[j]
		}

		for j := 0; j < 32; j++ {
			nonce[j]++
			if nonce[j] != 0 {
				break
			}
		}
	}

	cascadeDur := time.Since(cascadeStart)

	h := hmac.New(sha256.New, activeHmacKey)
	h.Write(ctBytes)
	h.Write(payloadBytes)
	macTag := hex.EncodeToString(h.Sum(nil))

	if globalDiagnostic || os.Getenv("DASP_DIAGNOSTIC") == "1" {
		diag := map[string]interface{}{
			"diagnostics": map[string]interface{}{
				"stage1_blended_ss": blendedSSHex,
				"stage2_word_key":   wordKeyHex,
				"stage4_mac":        macTag,
			},
		}
		dj, _ := json.Marshal(diag)
		fmt.Fprintf(os.Stderr, "%s\n", dj)
	}

	totalDur := time.Since(totalStart)

	for i := range prk {
		prk[i] = 0
	}
	runtime.KeepAlive(prk)
	for i := range blendedSS {
		blendedSS[i] = 0
	}
	runtime.KeepAlive(blendedSS)
	for i := range cipherKey {
		cipherKey[i] = 0
	}
	runtime.KeepAlive(cipherKey)
	for i := range activeHmacKey {
		activeHmacKey[i] = 0
	}
	runtime.KeepAlive(activeHmacKey)
	for i := range wordKey {
		wordKey[i] = 0
	}
	runtime.KeepAlive(wordKey)
	for i := range chainInit {
		chainInit[i] = 0
	}
	runtime.KeepAlive(chainInit)
	for i := range chainState {
		chainState[i] = 0
	}
	runtime.KeepAlive(chainState)
	for i := range roundKeys {
		roundKeys[i] = 0
	}
	runtime.KeepAlive(roundKeys)

	finalHash := sha256.Sum256(payloadBytes)
	fmt.Fprintf(os.Stderr, "Go-DCE-Prevent-Hash: %x\n", finalHash)

	if globalTelemetry {
		timingReport := map[string]interface{}{
			"timings": map[string]interface{}{
				"kem_us":     float64(kemDur.Nanoseconds()) / 1000.0,
				"kdf_us":     float64(kdfDur.Nanoseconds()) / 1000.0,
				"cascade_us": float64(cascadeDur.Nanoseconds()) / 1000.0,
				"total_us":   float64(totalDur.Nanoseconds()) / 1000.0,
			},
		}
		tj, _ := json.Marshal(timingReport)
		fmt.Fprintf(os.Stderr, "%s\n", tj)
	}

	inner := map[string]interface{}{"data": hex.EncodeToString(payloadBytes), "ct": ctHex, "mac": macTag}
	innerJson, _ := json.Marshal(inner)
	return string(innerJson), nil
}

func (dc *DarkstarCrypt) Decrypt(encDataRaw string, skHex string, hwid []byte) (string, error) {
	totalStart := time.Now()
	var val map[string]interface{}
	if err := json.Unmarshal([]byte(encDataRaw), &val); err != nil {
		return "", err
	}
	ctHex, _ := val["ct"].(string)
	dataHex, _ := val["data"].(string)
	macHex, _ := val["mac"].(string)

	skBytes, _ := hex.DecodeString(cleanHex(skHex))
	var finalHwid []byte = hwid

	ctBytes, _ := hex.DecodeString(ctHex)
	payloadBytes, _ := hex.DecodeString(dataHex)
	sch := mlkem1024.Scheme()
	kemStart := time.Now()
	sk, err := sch.UnmarshalBinaryPrivateKey(skBytes)
	if err != nil {
		return "", err
	}
	ss, err := sch.Decapsulate(sk, ctBytes)
	if err != nil {
		return "", err
	}
	kemDur := time.Since(kemStart)

	kdfStart := time.Now()
	var prk []byte
	if len(finalHwid) > 0 {
		mac := hmac.New(sha256.New, finalHwid)
		mac.Write(ss)
		prk = mac.Sum(nil)
	} else {
		mac := hmac.New(sha256.New, make([]byte, 32))
		mac.Write(ss)
		prk = mac.Sum(nil)
	}
	macExp := hmac.New(sha256.New, prk)
	macExp.Write([]byte("dasp-identity-v3\x01"))
	blendedSS := macExp.Sum(nil)
	blendedSSHex := hex.EncodeToString(blendedSS)

	cHasher := sha256.New()
	cHasher.Write(append([]byte("cipher"), blendedSS...))
	cipherKey := cHasher.Sum(nil)
	activePasswordStr := hex.EncodeToString(cipherKey)

	hHasher := sha256.New()
	hHasher.Write(append([]byte("hmac"), blendedSS...))
	activeHmacKey := hHasher.Sum(nil)

	macGen := hmac.New(sha256.New, []byte(activePasswordStr))
	macGen.Write([]byte("dasp-word-0"))
	wordKey := macGen.Sum(nil)
	wordKeyHex := hex.EncodeToString(wordKey)
	kdfDur := time.Since(kdfStart)

	h := hmac.New(sha256.New, activeHmacKey)
	h.Write(ctBytes)
	h.Write(payloadBytes)
	macActual := hex.EncodeToString(h.Sum(nil))

	if globalDiagnostic || os.Getenv("DASP_DIAGNOSTIC") == "1" {
		diag := map[string]interface{}{
			"diagnostics": map[string]interface{}{
				"stage1_raw_ss":     hex.EncodeToString(ss),
				"stage1_blended_ss": blendedSSHex,
				"stage2_word_key":   wordKeyHex,
				"stage4_mac":        macActual,
			},
		}
		dj, _ := json.Marshal(diag)
		fmt.Fprintf(os.Stderr, "%s\n", dj)
	}

	tag, _ := hex.DecodeString(macHex)
	if !hmac.Equal(h.Sum(nil), tag) {
		return "", errors.New("Integrity Check Failed")
	}

	chainInit := sha256.Sum256([]byte("dasp-chain-" + activePasswordStr))
	chainState := chainInit[:]

	rngPath := NewDarkstarChaChaPRNG(wordKeyHex)
	var roundKeys [128]uint32
	for i := 0; i < 128; i++ {
		roundKeys[i] = rngPath.Next()
	}

	cascadeStart := time.Now()

	nonce := make([]byte, 32)
	copy(nonce, chainState)

	for i := 0; i < len(payloadBytes); i += 32 {
		chunkLen := 32
		if i+chunkLen > len(payloadBytes) {
			chunkLen = len(payloadBytes) - i
		}

		block := make([]byte, 32)
		copy(block, nonce)

		daspCascade32(block, roundKeys[:])

		for j := 0; j < chunkLen; j++ {
			payloadBytes[i+j] ^= block[j]
		}

		for j := 0; j < 32; j++ {
			nonce[j]++
			if nonce[j] != 0 {
				break
			}
		}
	}
	cascadeDur := time.Since(cascadeStart)

	totalDur := time.Since(totalStart)

	for i := range ss {
		ss[i] = 0
	}
	runtime.KeepAlive(ss)
	for i := range prk {
		prk[i] = 0
	}
	runtime.KeepAlive(prk)
	for i := range blendedSS {
		blendedSS[i] = 0
	}
	runtime.KeepAlive(blendedSS)
	for i := range cipherKey {
		cipherKey[i] = 0
	}
	runtime.KeepAlive(cipherKey)
	for i := range activeHmacKey {
		activeHmacKey[i] = 0
	}
	runtime.KeepAlive(activeHmacKey)
	for i := range wordKey {
		wordKey[i] = 0
	}
	runtime.KeepAlive(wordKey)
	for i := range chainInit {
		chainInit[i] = 0
	}
	runtime.KeepAlive(chainInit)
	for i := range chainState {
		chainState[i] = 0
	}
	runtime.KeepAlive(chainState)
	for i := range roundKeys {
		roundKeys[i] = 0
	}
	runtime.KeepAlive(roundKeys)

	finalHash := sha256.Sum256(payloadBytes)
	fmt.Fprintf(os.Stderr, "Go-DCE-Prevent-Hash: %x\n", finalHash)

	if globalTelemetry {
		timingReport := map[string]interface{}{
			"timings": map[string]interface{}{
				"kem_us":     float64(kemDur.Nanoseconds()) / 1000.0,
				"kdf_us":     float64(kdfDur.Nanoseconds()) / 1000.0,
				"cascade_us": float64(cascadeDur.Nanoseconds()) / 1000.0,
				"total_us":   float64(totalDur.Nanoseconds()) / 1000.0,
			},
		}
		tj, _ := json.Marshal(timingReport)
		fmt.Fprintf(os.Stderr, "%s\n", tj)
	}

	return string(payloadBytes), nil
}

func main() {
	var hwid []byte
	var newHwid []byte
	args := os.Args[1:]

	// Flag parsing for --diagnostic and --telemetry
	var filtered []string
	for _, arg := range args {
		if arg == "--diagnostic" {
			globalDiagnostic = true
		} else if arg == "--telemetry" {
			globalTelemetry = true
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
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error reading HWID file: %v\n", err)
					os.Exit(1)
				}
				val = string(c)
			}
			hwid, _ = hex.DecodeString(cleanHex(val))
			args = append(args[:i], args[i+2:]...)
			i--
		} else if args[i] == "--new-hwid" && i+1 < len(args) {
			val := args[i+1]
			if strings.HasPrefix(val, "@") {
				c, err := os.ReadFile(val[1:])
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error reading New HWID file: %v\n", err)
					os.Exit(1)
				}
				val = string(c)
			}
			newHwid, _ = hex.DecodeString(cleanHex(val))
			args = append(args[:i], args[i+2:]...)
			i--
		}
	}
	if len(args) < 1 {
		return
	}
	command := args[0]
	dc := NewDarkstarCrypt()
	resolve := func(s string) string {
		if strings.HasPrefix(s, "@") {
			c, err := os.ReadFile(s[1:])
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
				os.Exit(1)
			}
			return strings.TrimSpace(string(c))
		}
		return s
	}

	switch command {
	case "encrypt":
		res, err := dc.Encrypt(resolve(args[1]), resolve(args[2]), hwid)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Encryption Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(res)
	case "decrypt":
		res, err := dc.Decrypt(resolve(args[1]), resolve(args[2]), hwid)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Decryption Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Print(res)
	case "rebind":
		if len(args) < 4 {
			return
		}
		data := resolve(args[1])
		skHex := resolve(args[2])
		newPkHex := resolve(args[3])
		pt, err := dc.Decrypt(data, skHex, hwid)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Rebind Decryption Error: %v\n", err)
			os.Exit(1)
		}
		res, err := dc.Encrypt(pt, newPkHex, newHwid)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Rebind Encryption Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(res)
	case "keygen":
		sch := mlkem1024.Scheme()
		pk, sk, _ := sch.GenerateKeyPair()
		pkb, _ := pk.MarshalBinary()
		skb, _ := sk.MarshalBinary()
		fmt.Printf("PK: %s\nSK: %s\n", hex.EncodeToString(pkb), hex.EncodeToString(skb))
	case "test":
		sch := mlkem1024.Scheme()
		pk, sk, _ := sch.GenerateKeyPair()
		pkb, _ := pk.MarshalBinary()
		skb, _ := sk.MarshalBinary()
		pkHex := hex.EncodeToString(pkb)
		skHex := hex.EncodeToString(skb)
		res, err := dc.Encrypt("test payload", pkHex, nil)
		if err != nil {
			fmt.Printf("Enc Err: %v\n", err)
		}
		dec, err := dc.Decrypt(res, skHex, nil)
		if err != nil {
			fmt.Printf("Err: %v\n", err)
		}
		fmt.Printf("Decrypted: %s\n", dec)
	}
}
