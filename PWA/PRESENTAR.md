# Presentar la demo en el celular (misma red, sin túnel)

La PWA necesita **contexto seguro** para la cámara, el GPS, el service worker y
el "Instalar app". En una IP de LAN por `http://` plano, Chrome bloquea todo eso.
Acá hay tres formas de presentar en el teléfono **sin túnel**, de más simple a más
completa. En todas, la PC y el celular deben estar en la **misma red Wi-Fi**.

> IP de esta PC: **192.168.10.164** (si cambia de red, regenerá el certificado — ver abajo).

---

## Antes que nada: el firewall de Windows

La primera vez que levantes un servidor que escucha en la red, Windows puede
preguntar *"¿Permitir que Python se comunique en estas redes?"*. **Permitilo en
redes privadas**. Si no aparece el cartel y el celular no conecta, habilitá el
puerto a mano en el Firewall de Windows (TCP 8443 u 8000).

---

## Opción A — HTTPS con certificado autofirmado  → cámara + GPS

La más rápida para mostrar el **escaneo del AprilTag** y el **GPS**.

1. En la PC, desde esta carpeta:
   ```
   python serve_https.py
   ```
   Imprime `https://192.168.10.164:8443`.
2. En el celular (Chrome o Safari), abrí esa URL.
3. Saltará un aviso de certificado → **Configuración avanzada → Continuar de
   todos modos**. (Es tu propio certificado; es seguro.)
4. Dale permiso de **cámara** y **ubicación** cuando los pida.

✅ Cámara y GPS funcionan.
⚠️ El **"Instalar app"** puede NO aparecer: Chrome Android no registra el service
worker con un certificado que no es de confianza. Para que el instalar también
funcione, usá la Opción B o C.

---

## Opción B — HTTP + flag de Chrome  → TODO (incl. instalar), solo Android

Sin certificados. Trata un origen `http://` como seguro.

1. En la PC:
   ```
   python -m http.server 8000 --bind 0.0.0.0
   ```
2. En Chrome del celular abrí: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. En el campo de texto poné: `http://192.168.10.164:8000`
4. Cambiá el selector a **Enabled** y tocá **Relaunch**.
5. Abrí `http://192.168.10.164:8000`.

✅ Cámara, GPS, service worker e **Instalar app**: todo funciona (el flag vuelve al
origen "contexto seguro").
ℹ️ Es por teléfono y conviene **desactivar el flag** al terminar la demo.
❌ No sirve en iPhone (Safari no tiene ese flag).

---

## Opción C — HTTPS de confianza con mkcert  → TODO, sin flags, Android e iPhone

La más prolija (sin advertencias, el instalar funciona). Requiere instalar una vez
la CA local en el teléfono.

1. Instalá [mkcert](https://github.com/FiloSottile/mkcert) en la PC y corré:
   ```
   mkcert -install
   mkcert -cert-file cert.pem -key-file key.pem 192.168.10.164 localhost 127.0.0.1
   ```
   (Sobrescribe el `cert.pem`/`key.pem` autofirmados por unos de confianza.)
2. Pasá el root CA al celular: `mkcert -CAROOT` te dice la carpeta; copiá
   `rootCA.pem` al teléfono e instalalo como **CA de confianza**
   (Android: Ajustes → Seguridad → Cifrado y credenciales → Instalar un
   certificado → Certificado de CA).
3. En la PC: `python serve_https.py`
4. En el celular abrí `https://192.168.10.164:8443` — sin advertencias.

✅ Cámara, GPS, service worker e **Instalar app**: todo, en Android y iPhone.

---

## Recomendación rápida

- **Demo en Android mostrando el "Instalar app":** Opción B (flag) — cero certificados.
- **Demo en iPhone, o algo prolijo sin flags:** Opción C (mkcert).
- **Solo mostrar el lector de tags y el GPS, ya:** Opción A.

---

## Regenerar el certificado si cambia la IP

Borrá `cert.pem` y `key.pem` y volvé a correr `python serve_https.py`
(los recrea con la IP actual), o a mano desde Git Bash:

```
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem \
  -days 365 -subj "//CN=YardFinder" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<NUEVA_IP>"
```

## Notas

- `cert.pem` / `key.pem` son de demo (clave privada incluida). No los uses en
  producción ni los publiques como credenciales reales.
- El servidor manda `Cache-Control: no-store`, así que no vas a arrastrar
  versiones viejas entre pruebas.
