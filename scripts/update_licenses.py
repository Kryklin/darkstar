import os

HEADER = """/*
 * D-ASP (ASP Cascade 16) Cryptographic Suite
 * Copyright (c) 2026 Darkstar Project (Kalem Slight)
 *
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"""

C_DIR = r"x:\Projects\darkstar\d-asp\c"

for filename in os.listdir(C_DIR):
    if filename.endswith(".c") or filename.endswith(".h"):
        filepath = os.path.join(C_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove existing license or block comment headers if they look like NIST/CC0
        if content.startswith("/*") or content.startswith("/**"):
            end_comment = content.find("*/")
            if end_comment != -1:
                # Check for NIST/CC0 keywords to be safe
                if "NIST" in content[:end_comment+2] or "CC0" in content[:end_comment+2] or "author(s)" in content[:end_comment+2]:
                    content = content[end_comment + 2:].lstrip()
                elif "Copyright (c) 2026 Darkstar Project (Kalem Slight)" in content[:end_comment+2]:
                    # Already updated (like spna_engine.c or main.c)
                    continue

        # Prepend new header
        new_content = HEADER + content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filename}")
