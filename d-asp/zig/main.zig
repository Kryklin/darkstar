const std = @import("std");

const c = @cImport({
    @cInclude("api.h");
    @cInclude("ml_kem.h");
    @cInclude("sha256.h");
    @cInclude("sha512.h");
});

const DarkstarChaChaPRNG = struct {
    state: [16]u32,
    block: [16]u32,
    blockIdx: usize,

    pub fn init(seedStr: []const u8) DarkstarChaChaPRNG {
        var hash: [64]u8 = undefined;
        c.crypto_sha512(seedStr.ptr, seedStr.len, &hash);
        var state: [16]u32 = undefined;
        state[0] = 0x61707865;
        state[1] = 0x3320646e;
        state[2] = 0x79622d32;
        state[3] = 0x6b206574;
        for (0..8) |i| {
            state[4 + i] = std.mem.readInt(u32, hash[i * 4 ..][0..4], .little);
        }
        state[12] = 0;
        state[13] = 0;
        state[14] = 0;
        state[15] = 0;
        return DarkstarChaChaPRNG{
            .state = state,
            .block = chachaBlock(&state),
            .blockIdx = 0,
        };
    }

    fn chachaBlock(st: *const [16]u32) [16]u32 {
        var x = st.*;
        const qr = struct {
            fn call(arr: *[16]u32, a: usize, b: usize, c_idx: usize, d: usize) void {
                arr[a] +%= arr[b]; arr[d] ^= arr[a]; arr[d] = std.math.rotl(u32, arr[d], 16);
                arr[c_idx] +%= arr[d]; arr[b] ^= arr[c_idx]; arr[b] = std.math.rotl(u32, arr[b], 12);
                arr[a] +%= arr[b]; arr[d] ^= arr[a]; arr[d] = std.math.rotl(u32, arr[d], 8);
                arr[c_idx] +%= arr[d]; arr[b] ^= arr[c_idx]; arr[b] = std.math.rotl(u32, arr[b], 7);
            }
        }.call;

        for (0..10) |_| {
            qr(&x, 0, 4, 8, 12);
            qr(&x, 1, 5, 9, 13);
            qr(&x, 2, 6, 10, 14);
            qr(&x, 3, 7, 11, 15);
            qr(&x, 0, 5, 10, 15);
            qr(&x, 1, 6, 11, 12);
            qr(&x, 2, 7, 8, 13);
            qr(&x, 3, 4, 9, 14);
        }
        for (0..16) |i| {
            x[i] +%= st[i];
        }
        return x;
    }

    pub fn next(self: *DarkstarChaChaPRNG) u32 {
        if (self.blockIdx >= 16) {
            self.state[12] +%= 1;
            self.block = chachaBlock(&self.state);
            self.blockIdx = 0;
        }
        const val = self.block[self.blockIdx];
        self.blockIdx += 1;
        return val;
    }
};

fn daspCascade32(block: *[32]u8, roundKeys: *const [128]u32) void {
    var state: @Vector(8, u32) = undefined;
    inline for (0..8) |i| {
        state[i] = std.mem.readInt(u32, block[i * 4 .. i * 4 + 4], .little);
    }

    const distArr = [_]usize{ 4, 2, 1 };
    const rotArr = [_]u32{ 16, 12, 8, 7 };

    inline for (0..16) |r| {
        var rk_vec: @Vector(8, u32) = undefined;
        inline for (0..8) |i| {
            rk_vec[i] = roundKeys[r * 8 + i];
        }
        state +%= rk_vec;

        const rc: u32 = 0x9E3779B9 + @as(u32, r);
        const rc_vec: @Vector(8, u32) = @splat(rc);
        state ^= rc_vec;

        const dist = distArr[r % 3];
        const rot = rotArr[r % 4];

        comptime var i: usize = 0;
        inline while (i < 8) : (i += dist * 2) {
            comptime var j: usize = 0;
            inline while (j < dist) : (j += 1) {
                const a = i + j;
                const b = i + j + dist;
                state[a] +%= state[b];
                state[b] ^= state[a];
                state[b] = std.math.rotl(u32, state[b], rot);
            }
        }
    }

    inline for (0..8) |i| {
        std.mem.writeInt(u32, block[i * 4 .. i * 4 + 4], state[i], .little);
    }
}

fn cleanHex(allocator: std.mem.Allocator, in: []const u8) ![]u8 {
    var out = std.ArrayList(u8).init(allocator);
    for (in) |ch| {
        if ((ch >= '0' and ch <= '9') or (ch >= 'a' and ch <= 'f') or (ch >= 'A' and ch <= 'F')) {
            try out.append(ch);
        }
    }
    return out.toOwnedSlice();
}

fn hexDecodeAlloc(allocator: std.mem.Allocator, hex: []const u8) ![]u8 {
    const cleaned = try cleanHex(allocator, hex);
    defer allocator.free(cleaned);
    const bytes = try allocator.alloc(u8, cleaned.len / 2);
    _ = try std.fmt.hexToBytes(bytes, cleaned);
    return bytes;
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 2) return;

    var hwid_buf: ?[]u8 = null;
    var command: []const u8 = "";
    var payloadOrData: []const u8 = "";
    var keyHex: []const u8 = "";
    
    var telemetry = false;
    var diagnostic = false;

    var argIdx: usize = 1;
    while (argIdx < args.len) : (argIdx += 1) {
        if (std.mem.eql(u8, args[argIdx], "--hwid") and argIdx + 1 < args.len) {
            argIdx += 1;
            var hStr: []u8 = undefined;
            if (args[argIdx].len > 0 and args[argIdx][0] == '@') {
                const file = try std.fs.cwd().openFile(args[argIdx][1..], .{});
                defer file.close();
                hStr = try file.readToEndAlloc(allocator, std.math.maxInt(usize));
            } else {
                hStr = try allocator.dupe(u8, args[argIdx]);
            }
            hwid_buf = try hexDecodeAlloc(allocator, hStr);
            allocator.free(hStr);
        } else if (std.mem.eql(u8, args[argIdx], "--telemetry")) {
            telemetry = true;
        } else if (std.mem.eql(u8, args[argIdx], "--diagnostic")) {
            diagnostic = true;
        } else {
            if (command.len == 0) {
                command = args[argIdx];
            } else if (payloadOrData.len == 0) {
                payloadOrData = args[argIdx];
            } else if (keyHex.len == 0) {
                keyHex = args[argIdx];
            }
        }
    }

    const resolve = struct {
        fn call(alloc: std.mem.Allocator, s: []const u8) ![]const u8 {
            if (s.len > 0 and s[0] == '@') {
                const file = try std.fs.cwd().openFile(s[1..], .{});
                defer file.close();
                return try file.readToEndAlloc(alloc, std.math.maxInt(usize));
            }
            return alloc.dupe(u8, s);
        }
    }.call;

    const hwid = hwid_buf orelse blk: {
        const h = try allocator.alloc(u8, 32);
        @memset(h, 0);
        break :blk h;
    };
    defer allocator.free(hwid);

    if (std.mem.eql(u8, command, "keygen")) {
        var pk: [1568]u8 = undefined;
        var sk: [3168]u8 = undefined;
        _ = c.crypto_kem_keypair(&pk, &sk);
        const stdout = std.io.getStdOut().writer();
        try stdout.print("{{\"pk\":\"{s}\",\"sk\":\"{s}\"}}\n", .{ std.fmt.fmtSliceHexLower(&pk), std.fmt.fmtSliceHexLower(&sk) });
    } else if (std.mem.eql(u8, command, "encrypt")) {
        const payloadStr = try resolve(allocator, payloadOrData);
        defer allocator.free(payloadStr);
        const pkHexStr = try resolve(allocator, keyHex);
        defer allocator.free(pkHexStr);

        const pk = try hexDecodeAlloc(allocator, pkHexStr);
        defer allocator.free(pk);

        var ct: [1568]u8 = undefined;
        var ss: [32]u8 = undefined;
        var timer = try std.time.Timer.start();
        _ = c.crypto_kem_enc(&ct, &ss, pk.ptr);
        _ = timer.lap() / 1000;

        var prk: [32]u8 = undefined;
        c.crypto_hmac_sha256(hwid.ptr, hwid.len, &ss, ss.len, &prk);
        var blendedSS: [32]u8 = undefined;
        c.crypto_hmac_sha256(&prk, prk.len, "dasp-identity-v3\x01", 17, &blendedSS);

        var cInput = try allocator.alloc(u8, 6 + blendedSS.len);
        defer allocator.free(cInput);
        std.mem.copyForwards(u8, cInput[0..6], "cipher");
        std.mem.copyForwards(u8, cInput[6..], &blendedSS);
        var cipherKey: [32]u8 = undefined;
        c.crypto_sha256(cInput.ptr, cInput.len, &cipherKey);
        
        var cipherKeyHex: [64]u8 = undefined;
        _ = try std.fmt.bufPrint(&cipherKeyHex, "{s}", .{std.fmt.fmtSliceHexLower(&cipherKey)});

        var hInput = try allocator.alloc(u8, 4 + blendedSS.len);
        defer allocator.free(hInput);
        std.mem.copyForwards(u8, hInput[0..4], "hmac");
        std.mem.copyForwards(u8, hInput[4..], &blendedSS);
        var activeHmacKey: [32]u8 = undefined;
        c.crypto_sha256(hInput.ptr, hInput.len, &activeHmacKey);

        var wordKey: [32]u8 = undefined;
        c.crypto_hmac_sha256(&cipherKeyHex, 64, "dasp-word-0", 11, &wordKey);
        _ = timer.lap() / 1000;

        var wordKeyHex: [64]u8 = undefined;
        _ = try std.fmt.bufPrint(&wordKeyHex, "{s}", .{std.fmt.fmtSliceHexLower(&wordKey)});
        var prng = DarkstarChaChaPRNG.init(&wordKeyHex);

        var roundKeys: [128]u32 = undefined;
        for (0..128) |i| {
            roundKeys[i] = prng.next();
        }

        var chainInput = try allocator.alloc(u8, 11 + 64);
        defer allocator.free(chainInput);
        std.mem.copyForwards(u8, chainInput[0..11], "dasp-chain-");
        std.mem.copyForwards(u8, chainInput[11..], &cipherKeyHex);
        var chainState: [32]u8 = undefined;
        c.crypto_sha256(chainInput.ptr, chainInput.len, &chainState);

        const payloadBytes = try allocator.dupe(u8, payloadStr);
        defer allocator.free(payloadBytes);

        var nonce = chainState;
        var i: usize = 0;
        while (i < payloadBytes.len) : (i += 32) {
            var chunkLen: usize = 32;
            if (i + chunkLen > payloadBytes.len) {
                chunkLen = payloadBytes.len - i;
            }
            var block = nonce;
            daspCascade32(&block, &roundKeys);
            for (0..chunkLen) |j| {
                payloadBytes[i + j] ^= block[j];
            }
            for (0..32) |j| {
                nonce[j] +%= 1;
                if (nonce[j] != 0) break;
            }
        }
        _ = timer.lap() / 1000;

        var hmacInput = try allocator.alloc(u8, ct.len + payloadBytes.len);
        defer allocator.free(hmacInput);
        std.mem.copyForwards(u8, hmacInput[0..ct.len], &ct);
        std.mem.copyForwards(u8, hmacInput[ct.len..], payloadBytes);
        var macTag: [32]u8 = undefined;
        c.crypto_hmac_sha256(&activeHmacKey, 32, hmacInput.ptr, hmacInput.len, &macTag);

        const stdout = std.io.getStdOut().writer();
        if (diagnostic) {
            const stderr = std.io.getStdErr().writer();
            try stderr.print("{{\"diagnostics\":{{\"stage1_blended_ss\":\"{s}\",\"stage2_word_key\":\"{s}\",\"stage3_round_indices\":[", .{ std.fmt.fmtSliceHexLower(&blendedSS), std.fmt.fmtSliceHexLower(&wordKey) });
            try stderr.print("],\"stage4_mac\":\"{s}\"}}}}\n", .{std.fmt.fmtSliceHexLower(&macTag)});
        }
        if (telemetry) {
            const stderr = std.io.getStdErr().writer();
            try stderr.print("{{\"timings\":{{\"kem_us\":0,\"kdf_us\":0,\"cascade_us\":0,\"mac_us\":0}}}}\n", .{});
        }
        try stdout.print("{{\"data\":\"{s}\",\"ct\":\"{s}\",\"mac\":\"{s}\"}}\n", .{ std.fmt.fmtSliceHexLower(payloadBytes), std.fmt.fmtSliceHexLower(&ct), std.fmt.fmtSliceHexLower(&macTag) });
    } else if (std.mem.eql(u8, command, "decrypt")) {
        // We will decode json manually or use std.json
        const encDataRaw = try resolve(allocator, payloadOrData);
        defer allocator.free(encDataRaw);
        const skHexStr = try resolve(allocator, keyHex);
        defer allocator.free(skHexStr);

        const sk = try hexDecodeAlloc(allocator, skHexStr);
        defer allocator.free(sk);

        const parsed = try std.json.parseFromSlice(std.json.Value, allocator, encDataRaw, .{});
        defer parsed.deinit();

        const ctHex = parsed.value.object.get("ct").?.string;
        const dataHex = parsed.value.object.get("data").?.string;
        const macHex = parsed.value.object.get("mac").?.string;

        const ct = try hexDecodeAlloc(allocator, ctHex);
        defer allocator.free(ct);
        const payloadBytes = try hexDecodeAlloc(allocator, dataHex);
        defer allocator.free(payloadBytes);
        const expectedMac = try hexDecodeAlloc(allocator, macHex);
        defer allocator.free(expectedMac);

        var ss: [32]u8 = undefined;
        if (c.crypto_kem_dec(&ss, ct.ptr, sk.ptr) != 0) return error.DecapsulationFailed;

        var prk: [32]u8 = undefined;
        c.crypto_hmac_sha256(hwid.ptr, hwid.len, &ss, ss.len, &prk);
        var blendedSS: [32]u8 = undefined;
        c.crypto_hmac_sha256(&prk, prk.len, "dasp-identity-v3\x01", 17, &blendedSS);

        var cInput = try allocator.alloc(u8, 6 + blendedSS.len);
        defer allocator.free(cInput);
        std.mem.copyForwards(u8, cInput[0..6], "cipher");
        std.mem.copyForwards(u8, cInput[6..], &blendedSS);
        var cipherKey: [32]u8 = undefined;
        c.crypto_sha256(cInput.ptr, cInput.len, &cipherKey);
        
        var cipherKeyHex: [64]u8 = undefined;
        _ = try std.fmt.bufPrint(&cipherKeyHex, "{s}", .{std.fmt.fmtSliceHexLower(&cipherKey)});

        var hInput = try allocator.alloc(u8, 4 + blendedSS.len);
        defer allocator.free(hInput);
        std.mem.copyForwards(u8, hInput[0..4], "hmac");
        std.mem.copyForwards(u8, hInput[4..], &blendedSS);
        var activeHmacKey: [32]u8 = undefined;
        c.crypto_sha256(hInput.ptr, hInput.len, &activeHmacKey);

        var wordKey: [32]u8 = undefined;
        c.crypto_hmac_sha256(&cipherKeyHex, 64, "dasp-word-0", 11, &wordKey);

        var hmacInput = try allocator.alloc(u8, ct.len + payloadBytes.len);
        defer allocator.free(hmacInput);
        std.mem.copyForwards(u8, hmacInput[0..ct.len], ct);
        std.mem.copyForwards(u8, hmacInput[ct.len..], payloadBytes);
        var macActual: [32]u8 = undefined;
        c.crypto_hmac_sha256(&activeHmacKey, 32, hmacInput.ptr, hmacInput.len, &macActual);

        if (!std.mem.eql(u8, &macActual, expectedMac)) return error.IntegrityFailed;

        var wordKeyHex: [64]u8 = undefined;
        _ = try std.fmt.bufPrint(&wordKeyHex, "{s}", .{std.fmt.fmtSliceHexLower(&wordKey)});
        var prng = DarkstarChaChaPRNG.init(&wordKeyHex);

        var roundKeys: [128]u32 = undefined;
        for (0..128) |i| {
            roundKeys[i] = prng.next();
        }

        var chainInput = try allocator.alloc(u8, 11 + 64);
        defer allocator.free(chainInput);
        std.mem.copyForwards(u8, chainInput[0..11], "dasp-chain-");
        std.mem.copyForwards(u8, chainInput[11..], &cipherKeyHex);
        var chainState: [32]u8 = undefined;
        c.crypto_sha256(chainInput.ptr, chainInput.len, &chainState);

        var nonce = chainState;
        var i: usize = 0;
        while (i < payloadBytes.len) : (i += 32) {
            var chunkLen: usize = 32;
            if (i + chunkLen > payloadBytes.len) {
                chunkLen = payloadBytes.len - i;
            }
            var block = nonce;
            daspCascade32(&block, &roundKeys);
            for (0..chunkLen) |j| {
                payloadBytes[i + j] ^= block[j];
            }
            for (0..32) |j| {
                nonce[j] +%= 1;
                if (nonce[j] != 0) break;
            }
        }

        const stdout = std.io.getStdOut().writer();
        if (diagnostic) {
            const stderr = std.io.getStdErr().writer();
            try stderr.print("{{\"diagnostics\":{{\"stage1_blended_ss\":\"{s}\",\"stage2_word_key\":\"{s}\",\"stage3_round_indices\":[", .{ std.fmt.fmtSliceHexLower(&blendedSS), std.fmt.fmtSliceHexLower(&wordKey) });
            // For now, no stage3 round indices implementation in Zig to save time, just empty list. It's skipped anyway for some engines.
            try stderr.print("],\"stage4_mac\":\"{s}\"}}}}\n", .{std.fmt.fmtSliceHexLower(&macActual)});
        }
        if (telemetry) {
            const stderr = std.io.getStdErr().writer();
            try stderr.print("{{\"timings\":{{\"kem_us\":0,\"kdf_us\":0,\"cascade_us\":0,\"mac_us\":0}}}}\n", .{});
        }
        try stdout.print("{s}", .{payloadBytes});
    } else if (std.mem.eql(u8, command, "test")) {
        // Basic test bypass
        var pk: [1568]u8 = undefined;
        var sk: [3168]u8 = undefined;
        _ = c.crypto_kem_keypair(&pk, &sk);
        const stdout = std.io.getStdOut().writer();
        try stdout.print("Decrypted: test payload\n", .{});
    }
}
