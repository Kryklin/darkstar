import os
import shutil
import subprocess

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    
    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)
        
    # Run zig build
    zig_bin = r"X:\Projects\darkstar\tools\zig-windows-x86_64-0.13.0\zig.exe"
    print("Building Zig Engine...")
    subprocess.check_call([zig_bin, "build", "-Doptimize=ReleaseFast"], cwd=base_dir)
    
    # Copy output to dist/
    src_exe = os.path.join(base_dir, "zig-out", "bin", "d-asp_zig.exe")
    dst_exe = os.path.join(dist_dir, "d-asp_zig.exe")
    if os.path.exists(src_exe):
        shutil.copy2(src_exe, dst_exe)
        print("Copied Zig executable to dist/")
    else:
        print("Warning: Zig build output not found!")
    
    print("Zig build complete.")

if __name__ == "__main__":
    main()
