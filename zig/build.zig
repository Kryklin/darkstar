const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "d-asp_zig",
        .root_source_file = b.path("main.zig"),
        .target = target,
        .optimize = optimize,
    });

    const c_flags = &[_][]const u8{
        "-std=c11",
        "-O3",
    };

    exe.addCSourceFile(.{ .file = b.path("../c/ml_kem.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/fips202.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/sha512.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/sha256.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/rng.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/poly.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/poly_sampling.c"), .flags = c_flags });
    exe.addCSourceFile(.{ .file = b.path("../c/gf_math.c"), .flags = c_flags });

    exe.addIncludePath(b.path("../c"));

    exe.linkLibC();
    exe.linkSystemLibrary("bcrypt");
    exe.linkSystemLibrary("ws2_32");
    exe.linkSystemLibrary("advapi32");
    exe.linkSystemLibrary("userenv");

    exe.addWin32ResourceFile(.{
        .file = b.path("icon.rc"),
    });

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
