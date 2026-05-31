using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
using System.Numerics;

namespace DarkstarCSharp
{
    class Program
    {
        [DllImport("dasp_kem.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int crypto_kem_keypair(byte[] pk, byte[] sk);

        [DllImport("dasp_kem.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int crypto_kem_enc(byte[] ct, byte[] ss, byte[] pk);

        [DllImport("dasp_kem.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int crypto_kem_dec(byte[] ss, byte[] ct, byte[] sk);

        class DarkstarChaChaPRNG
        {
            private uint[] state = new uint[16];
            private uint[] block = new uint[16];
            private int blockIdx;

            public DarkstarChaChaPRNG(string seedStr)
            {
                byte[] hash = SHA512.HashData(Encoding.UTF8.GetBytes(seedStr));
                state[0] = 0x61707865;
                state[1] = 0x3320646e;
                state[2] = 0x79622d32;
                state[3] = 0x6b206574;
                for (int i = 0; i < 8; i++)
                {
                    state[4 + i] = BitConverter.ToUInt32(hash, i * 4);
                }
                state[12] = 0; state[13] = 0; state[14] = 0; state[15] = 0;
                block = ChaChaBlock(state);
                blockIdx = 0;
            }

            private uint[] ChaChaBlock(uint[] st)
            {
                uint[] x = new uint[16];
                Array.Copy(st, x, 16);

                void QuarterRound(int a, int b, int c, int d)
                {
                    x[a] += x[b]; x[d] ^= x[a]; x[d] = BitOperations.RotateLeft(x[d], 16);
                    x[c] += x[d]; x[b] ^= x[c]; x[b] = BitOperations.RotateLeft(x[b], 12);
                    x[a] += x[b]; x[d] ^= x[a]; x[d] = BitOperations.RotateLeft(x[d], 8);
                    x[c] += x[d]; x[b] ^= x[c]; x[b] = BitOperations.RotateLeft(x[b], 7);
                }

                for (int i = 0; i < 10; i++)
                {
                    QuarterRound(0, 4, 8, 12);
                    QuarterRound(1, 5, 9, 13);
                    QuarterRound(2, 6, 10, 14);
                    QuarterRound(3, 7, 11, 15);
                    QuarterRound(0, 5, 10, 15);
                    QuarterRound(1, 6, 11, 12);
                    QuarterRound(2, 7, 8, 13);
                    QuarterRound(3, 4, 9, 14);
                }
                for (int i = 0; i < 16; i++) x[i] += st[i];
                return x;
            }

            public uint Next()
            {
                if (blockIdx >= 16)
                {
                    state[12]++;
                    block = ChaChaBlock(state);
                    blockIdx = 0;
                }
                return block[blockIdx++];
            }
        }

        static unsafe void DaspCascade32(byte* block, uint* roundKeys)
        {
            uint* state = (uint*)block;
            int[] distArr = { 4, 2, 1 };
            int[] rotArr = { 16, 12, 8, 7 };

            for (uint r = 0; r < 16; r++)
            {
                uint* rk = roundKeys + (r * 8);
                state[0] += rk[0]; state[1] += rk[1]; state[2] += rk[2]; state[3] += rk[3];
                state[4] += rk[4]; state[5] += rk[5]; state[6] += rk[6]; state[7] += rk[7];

                uint rc = 0x9E3779B9 + r;
                state[0] ^= rc; state[1] ^= rc; state[2] ^= rc; state[3] ^= rc;
                state[4] ^= rc; state[5] ^= rc; state[6] ^= rc; state[7] ^= rc;

                int dist = distArr[r % 3];
                int rot = rotArr[r % 4];

                for (int i = 0; i < 8; i += dist * 2)
                {
                    for (int j = 0; j < dist; j++)
                    {
                        int a = i + j;
                        int b = i + j + dist;
                        state[a] += state[b];
                        state[b] ^= state[a];
                        state[b] = BitOperations.RotateLeft(state[b], rot);
                    }
                }
            }
        }

        static byte[] CleanHex(string hex)
        {
            var sb = new StringBuilder();
            foreach (var c in hex)
            {
                if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))
                    sb.Append(c);
            }
            return Convert.FromHexString(sb.ToString());
        }

        static string Encrypt(string payloadStr, string pkHex, byte[] hwid)
        {
            var totalWatch = Stopwatch.StartNew();
            byte[] pk = CleanHex(pkHex);
            byte[] ct = new byte[1568];
            byte[] ss = new byte[32];

            var kemWatch = Stopwatch.StartNew();
            if (crypto_kem_enc(ct, ss, pk) != 0) throw new Exception("KEM Encapsulation failed");
            kemWatch.Stop();

            var kdfWatch = Stopwatch.StartNew();
            byte[] prk = HMACSHA256.HashData(hwid != null && hwid.Length > 0 ? hwid : new byte[32], ss);
            byte[] blendedSS = HMACSHA256.HashData(prk, Encoding.UTF8.GetBytes("dasp-identity-v3\x01"));
            
            byte[] cInput = new byte[6 + blendedSS.Length];
            Encoding.UTF8.GetBytes("cipher").CopyTo(cInput, 0);
            blendedSS.CopyTo(cInput, 6);
            byte[] cipherKey = SHA256.HashData(cInput);
            string activePasswordStr = Convert.ToHexString(cipherKey).ToLower();

            byte[] hInput = new byte[4 + blendedSS.Length];
            Encoding.UTF8.GetBytes("hmac").CopyTo(hInput, 0);
            blendedSS.CopyTo(hInput, 4);
            byte[] activeHmacKey = SHA256.HashData(hInput);

            byte[] wordKey = HMACSHA256.HashData(Encoding.UTF8.GetBytes(activePasswordStr), Encoding.UTF8.GetBytes("dasp-word-0"));
            kdfWatch.Stop();

            byte[] chainState = SHA256.HashData(Encoding.UTF8.GetBytes("dasp-chain-" + activePasswordStr));

            var prng = new DarkstarChaChaPRNG(Convert.ToHexString(wordKey).ToLower());
            uint[] roundKeys = new uint[128];
            for (int i = 0; i < 128; i++) roundKeys[i] = prng.Next();

            byte[] payloadBytes = Encoding.UTF8.GetBytes(payloadStr);
            byte[] nonce = new byte[32];
            Array.Copy(chainState, nonce, 32);

            var cascadeWatch = Stopwatch.StartNew();
            unsafe
            {
                fixed (byte* pPayload = payloadBytes)
                fixed (uint* pRoundKeys = roundKeys)
                {
                    byte* pBlock = stackalloc byte[32];
                    for (int i = 0; i < payloadBytes.Length; i += 32)
                    {
                        int chunkLen = Math.Min(32, payloadBytes.Length - i);
                        fixed (byte* pNonce = nonce)
                        {
                            Buffer.MemoryCopy(pNonce, pBlock, 32, 32);
                        }
                        
                        DaspCascade32(pBlock, pRoundKeys);

                        for (int j = 0; j < chunkLen; j++)
                        {
                            pPayload[i + j] ^= pBlock[j];
                        }

                        for (int j = 0; j < 32; j++)
                        {
                            if (++nonce[j] != 0) break;
                        }
                    }
                }
            }
            cascadeWatch.Stop();

            byte[] hmacInput = new byte[ct.Length + payloadBytes.Length];
            ct.CopyTo(hmacInput, 0);
            payloadBytes.CopyTo(hmacInput, ct.Length);
            byte[] macTag = HMACSHA256.HashData(activeHmacKey, hmacInput);
            
            totalWatch.Stop();
            
            if (Environment.GetEnvironmentVariable("DASP_TELEMETRY") == "1")
            {
                Console.Error.WriteLine(JsonSerializer.Serialize(new {
                    timings = new {
                        kem_us = kemWatch.Elapsed.TotalMicroseconds,
                        kdf_us = kdfWatch.Elapsed.TotalMicroseconds,
                        cascade_us = cascadeWatch.Elapsed.TotalMicroseconds,
                        total_us = totalWatch.Elapsed.TotalMicroseconds
                    }
                }));
            }

            var result = new {
                data = Convert.ToHexString(payloadBytes).ToLower(),
                ct = Convert.ToHexString(ct).ToLower(),
                mac = Convert.ToHexString(macTag).ToLower()
            };
            return JsonSerializer.Serialize(result);
        }

        class Envelope { public string data { get; set; } public string ct { get; set; } public string mac { get; set; } }

        static string Decrypt(string encDataRaw, string skHex, byte[] hwid)
        {
            var env = JsonSerializer.Deserialize<Envelope>(encDataRaw);
            byte[] ct = CleanHex(env.ct);
            byte[] payloadBytes = CleanHex(env.data);
            byte[] expectedMac = CleanHex(env.mac);
            byte[] sk = CleanHex(skHex);
            byte[] ss = new byte[32];

            if (crypto_kem_dec(ss, ct, sk) != 0) throw new Exception("KEM Decapsulation failed");

            byte[] prk = HMACSHA256.HashData(hwid != null && hwid.Length > 0 ? hwid : new byte[32], ss);
            byte[] blendedSS = HMACSHA256.HashData(prk, Encoding.UTF8.GetBytes("dasp-identity-v3\x01"));

            byte[] cInput = new byte[6 + blendedSS.Length];
            Encoding.UTF8.GetBytes("cipher").CopyTo(cInput, 0);
            blendedSS.CopyTo(cInput, 6);
            byte[] cipherKey = SHA256.HashData(cInput);
            string activePasswordStr = Convert.ToHexString(cipherKey).ToLower();

            byte[] hInput = new byte[4 + blendedSS.Length];
            Encoding.UTF8.GetBytes("hmac").CopyTo(hInput, 0);
            blendedSS.CopyTo(hInput, 4);
            byte[] activeHmacKey = SHA256.HashData(hInput);

            byte[] wordKey = HMACSHA256.HashData(Encoding.UTF8.GetBytes(activePasswordStr), Encoding.UTF8.GetBytes("dasp-word-0"));

            byte[] hmacInput = new byte[ct.Length + payloadBytes.Length];
            ct.CopyTo(hmacInput, 0);
            payloadBytes.CopyTo(hmacInput, ct.Length);
            byte[] macActual = HMACSHA256.HashData(activeHmacKey, hmacInput);

            if (!CryptographicOperations.FixedTimeEquals(macActual, expectedMac)) throw new Exception("Integrity Check Failed");

            byte[] chainState = SHA256.HashData(Encoding.UTF8.GetBytes("dasp-chain-" + activePasswordStr));

            var prng = new DarkstarChaChaPRNG(Convert.ToHexString(wordKey).ToLower());
            uint[] roundKeys = new uint[128];
            for (int i = 0; i < 128; i++) roundKeys[i] = prng.Next();

            byte[] nonce = new byte[32];
            Array.Copy(chainState, nonce, 32);

            unsafe
            {
                fixed (byte* pPayload = payloadBytes)
                fixed (uint* pRoundKeys = roundKeys)
                {
                    byte* pBlock = stackalloc byte[32];
                    for (int i = 0; i < payloadBytes.Length; i += 32)
                    {
                        int chunkLen = Math.Min(32, payloadBytes.Length - i);
                        fixed (byte* pNonce = nonce) Buffer.MemoryCopy(pNonce, pBlock, 32, 32);
                        
                        DaspCascade32(pBlock, pRoundKeys);

                        for (int j = 0; j < chunkLen; j++) pPayload[i + j] ^= pBlock[j];
                        for (int j = 0; j < 32; j++) if (++nonce[j] != 0) break;
                    }
                }
            }

            return Encoding.UTF8.GetString(payloadBytes);
        }

        static void Main(string[] args)
        {
            if (args.Length < 1) return;
            string command = args[0];
            byte[] hwid = null;

            int argIdx = 1;
            string payloadOrData = null;
            string keyHex = null;

            while (argIdx < args.Length)
            {
                if (args[argIdx] == "--hwid" && argIdx + 1 < args.Length)
                {
                    string hStr = args[argIdx + 1];
                    if (hStr.StartsWith("@")) hStr = File.ReadAllText(hStr.Substring(1)).Trim();
                    hwid = CleanHex(hStr);
                    argIdx += 2;
                }
                else if (args[argIdx] == "--telemetry")
                {
                    Environment.SetEnvironmentVariable("DASP_TELEMETRY", "1");
                    argIdx++;
                }
                else
                {
                    if (payloadOrData == null) payloadOrData = args[argIdx];
                    else if (keyHex == null) keyHex = args[argIdx];
                    argIdx++;
                }
            }

            Func<string, string> Resolve = (string s) => s.StartsWith("@") ? File.ReadAllText(s.Substring(1)).Trim() : s;

            try
            {
                if (command == "encrypt") Console.WriteLine(Encrypt(Resolve(payloadOrData), Resolve(keyHex), hwid));
                else if (command == "decrypt") Console.Write(Decrypt(Resolve(payloadOrData), Resolve(keyHex), hwid));
                else if (command == "keygen")
                {
                    byte[] pk = new byte[1568];
                    byte[] sk = new byte[3168];
                    crypto_kem_keypair(pk, sk);
                    Console.WriteLine($"{{\"pk\":\"{Convert.ToHexString(pk).ToLower()}\",\"sk\":\"{Convert.ToHexString(sk).ToLower()}\"}}");
                }
                else if (command == "test")
                {
                    byte[] pk = new byte[1568];
                    byte[] sk = new byte[3168];
                    crypto_kem_keypair(pk, sk);
                    string enc = Encrypt("test payload", Convert.ToHexString(pk), null);
                    string dec = Decrypt(enc, Convert.ToHexString(sk), null);
                    Console.WriteLine($"Decrypted: {dec}");
                }
            }
            catch (Exception ex) { Console.Error.WriteLine("Error: " + ex.Message); Environment.Exit(1); }
        }
    }
}
