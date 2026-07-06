const { app, BrowserWindow, dialog, shell, Menu } = require("electron");
const path = require("path");
const https = require("https");
const pkg = require("./package.json");

const APP_URL = "https://happy-isp-studio.lovable.app";
const VERSION_MANIFEST_URL = APP_URL + "/desktop-version.json";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

let mainWindow = null;
let lastNotifiedVersion = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Happy ISP Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: "Arquivo",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { role: "forceReload", label: "Recarregar (forçar)" },
        { type: "separator" },
        { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Verificar atualizações…",
          click: () => checkForUpdates({ silent: false }),
        },
        {
          label: `Versão ${pkg.version}`,
          enabled: false,
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "cache-control": "no-cache" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchJson(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("timeout")));
  });
}

// Compara semver "a.b.c"; retorna >0 se remote > local
function compareVersion(remote, local) {
  const a = String(remote)
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const b = String(local)
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

async function checkForUpdates({ silent }) {
  try {
    const manifest = await fetchJson(VERSION_MANIFEST_URL);
    const remote = String(manifest.version || "");
    const local = pkg.version;
    const isNewer = compareVersion(remote, local) > 0;

    if (!isNewer) {
      if (!silent) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Tudo em dia",
          message: `Você já está na versão mais recente (${local}).`,
          detail:
            "O conteúdo do aplicativo (telas, recursos e dados) é sempre atualizado automaticamente ao abrir o app.",
          buttons: ["OK"],
        });
      }
      return;
    }

    if (silent && lastNotifiedVersion === remote) return;
    lastNotifiedVersion = remote;

    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Nova versão disponível",
      message: `Versão ${remote} disponível (atual: ${local})`,
      detail:
        (manifest.notes ? manifest.notes + "\n\n" : "") +
        "Deseja baixar agora? O download abrirá no navegador. Depois extraia o ZIP e substitua o executável.",
      buttons: ["Baixar agora", "Mais tarde"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0 && manifest.downloadUrl) {
      shell.openExternal(manifest.downloadUrl);
    }
  } catch (err) {
    if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Falha ao verificar atualizações",
        message: "Não foi possível verificar atualizações agora.",
        detail: String(err && err.message ? err.message : err),
        buttons: ["OK"],
      });
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  // Verifica logo após abrir (com pequeno atraso para a janela carregar)
  setTimeout(() => checkForUpdates({ silent: true }), 4000);
  // E periodicamente enquanto o app fica aberto
  setInterval(() => checkForUpdates({ silent: true }), CHECK_INTERVAL_MS);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
