import os
import shutil

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    
    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)
        
    # Copy dasp.py
    src_py = os.path.join(base_dir, "dasp.py")
    dst_py = os.path.join(dist_dir, "dasp.py")
    shutil.copy2(src_py, dst_py)
    
    # Copy wasm
    src_wasm = os.path.join(base_dir, "..", "wasm", "dasp_crypto.wasm")
    docker_wasm = os.path.join(base_dir, "wasm", "dasp_crypto.wasm")
    dst_wasm = os.path.join(dist_dir, "dasp_crypto.wasm")
    if os.path.exists(src_wasm):
        shutil.copy2(src_wasm, dst_wasm)
    elif os.path.exists(docker_wasm):
        shutil.copy2(docker_wasm, dst_wasm)
    else:
        print("Warning: wasm file not found, skipping copy.")
        
    print("Obfuscating Python output...")
    try:
        import python_minifier
        with open(dst_py, 'r', encoding='utf-8') as f:
            code = f.read()
        obfuscated_code = python_minifier.minify(
            code,
            rename_globals=True,
            rename_locals=True
        )
        with open(dst_py, 'w', encoding='utf-8') as f:
            f.write(obfuscated_code)
        print("Obfuscation complete.")
    except ImportError:
        print("Warning: python-minifier not found. Skipping obfuscation.")
        
    print("Python build complete.")

if __name__ == "__main__":
    main()
