import os
import sys
import json

# Add d-kasp-512/python to sys.path
sys.path.append(os.path.join(os.getcwd(), 'd-kasp-512', 'python'))

from darkstar_crypt import DarkstarCrypt

dc = DarkstarCrypt()
mnemonic = "apple banana"
password = "test"

# Test V4 (Password based)
try:
    res_obj = dc.encrypt(mnemonic, password, force_v4=True)
    print("ENCRYPTED V4 SUCCESS")
    
    dec = dc.decrypt(res_obj["encryptedData"], res_obj["reverseKey"], password)
    print(f"DECRYPTED V4: '{dec}'")

    if dec == mnemonic:
        print("PYTHON V4 SELF-TEST PASSED")
    else:
        print(f"PYTHON V4 SELF-TEST FAILED. '{dec}' != '{mnemonic}'")
except Exception as e:
    print(f"PYTHON V4 SELF-TEST ERROR: {e}")
    import traceback
    traceback.print_exc()
