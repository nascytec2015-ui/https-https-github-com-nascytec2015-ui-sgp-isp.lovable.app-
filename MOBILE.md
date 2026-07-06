# SGP-ISP — App Mobile (Android / iOS)

O projeto está configurado com **Capacitor** para gerar apps nativos.

## Pré-requisitos
- Node 20+ e Bun (ou npm)
- **Android**: Android Studio (SDK 34+), Java 17
- **iOS**: Mac com Xcode 15+, CocoaPods

## Passo a passo (no seu PC)

1. Conecte o projeto ao GitHub pelo botão **+ → GitHub → Connect project** no Lovable.
2. Clone o repositório:
   ```bash
   git clone <url-do-seu-repo>
   cd <pasta>
   bun install   # ou: npm install
   ```
3. Adicione as plataformas nativas (só na primeira vez):
   ```bash
   npx cap add android
   npx cap add ios   # apenas no Mac
   ```
4. Build do web + sync para nativo:
   ```bash
   bun run build
   npx cap sync
   ```
5. Rodar no dispositivo / emulador:
   ```bash
   npx cap run android
   npx cap run ios
   ```

## Ícone e Splash
- Arquivos-fonte em `resources/icon.png` e `resources/splash.png` (1024x1024).
- Para gerar todos os tamanhos automaticamente:
  ```bash
  npm i -g @capacitor/assets
  npx capacitor-assets generate --iconBackgroundColor "#1e3a8a" --splashBackgroundColor "#1e3a8a"
  npx cap sync
  ```

## Hot reload (modo desenvolvimento)
O `capacitor.config.ts` já está apontando para a URL do Lovable —
toda alteração publicada no Lovable aparece no app instalado automaticamente.

## Build automático via GitHub Actions (recomendado)

Um workflow já está configurado em `.github/workflows/build-android.yml`. A cada push na branch `main`, o GitHub compila o APK automaticamente.

### Como baixar o APK pronto
1. Conecte o projeto ao GitHub pelo botão **+ → GitHub → Connect project** no Lovable.
2. Faça qualquer alteração e publique no Lovable (isso faz push para o GitHub).
3. No GitHub, vá em **Actions → Build Android APK**.
4. Clique na execução mais recente (verde ✅).
5. Role até **Artifacts** e baixe `sgp-isp-apk`.
6. O arquivo `app-debug.apk` dentro do ZIP pode ser instalado diretamente no seu Android.

> **Dica:** ative as notificações do GitHub no celular para saber quando o build terminar.

## Build manual no PC (alternativa)

Se preferir compilar localmente com o Android Studio já instalado:

1. Clone o repositório:
   ```bash
   git clone <url-do-seu-repo>
   cd <pasta>
   bun install   # ou: npm install
   ```
2. Adicione a plataforma Android (só na primeira vez):
   ```bash
   npx cap add android
   ```
3. Build web + sync:
   ```bash
   bun run build
   npx cap sync android
   ```
4. Gere o APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   O APK será gerado em `android/app/build/outputs/apk/debug/app-debug.apk`.
5. Envie para o celular via USB, WhatsApp, Google Drive ou `adb install app-debug.apk`.

## Build de produção (lojas)
1. Remova (ou comente) o bloco `server` em `capacitor.config.ts`.
2. `bun run build && npx cap sync`
3. Android Studio → **Build → Generate Signed Bundle (.aab)** → Google Play
4. Xcode → **Product → Archive** → App Store Connect (apenas Mac)

## Notas
- iOS exige Mac + conta Apple Developer (US$ 99/ano).
- Android exige conta Google Play (US$ 25 única vez).
- O backend (Lovable Cloud) é o mesmo do app web — login e dados sincronizam.