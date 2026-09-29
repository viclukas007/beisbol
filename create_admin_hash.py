"""Genera la huella de la clave inicial sin mostrar ni guardar la contraseña."""
import getpass
import hashlib
import secrets

password = getpass.getpass('Contraseña inicial (8–128 caracteres): ')
if not 8 <= len(password) <= 128:
    raise SystemExit('La contraseña debe tener entre 8 y 128 caracteres.')
if password != getpass.getpass('Confirma la contraseña: '):
    raise SystemExit('Las contraseñas no coinciden.')
salt = secrets.token_hex(16)
key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=32768, r=8, p=1, maxmem=67108864, dklen=64)
print('ADMIN_PASSWORD_HASH=scrypt:' + salt + ':' + key.hex())
