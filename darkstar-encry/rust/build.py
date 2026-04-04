import subprocess
with open('stdout.txt', 'wb') as fout, open('stderr.txt', 'wb') as ferr:
    p = subprocess.Popen("cargo build", shell=True, stdout=fout, stderr=ferr)
    p.communicate()
