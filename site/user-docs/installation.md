# Install Skladno

Skladno works on Windows 11 x64 and Linux. Debian packages are available as preview builds and have been tested on Debian.

## Windows

1. Open the [latest GitHub release](https://github.com/kirillta/skladno/releases/latest).
2. Under **Assets**, download the Windows setup `.exe` and run it.
3. If Windows shows a SmartScreen warning, confirm that the installer came from this repository's release page. Releases are not digitally signed.
4. Open Skladno from the Start menu.

## Debian and Debian-based distributions

1. Open the [latest GitHub release](https://github.com/kirillta/skladno/releases/latest).
2. Under **Assets**, download the `skladno_VERSION_amd64.deb` package.
3. Open a terminal in the folder where you downloaded it. If the folder contains only that Skladno package, install it with:

   ```sh
   sudo apt install ./skladno_*.deb
   ```

4. Open Skladno from your applications menu.

Managed API keys on Linux require an available, unlocked Secret Service, such as GNOME Keyring. See [AI providers and models](providers.md) for other connection options.

## After installation

To use AI features, add a provider connection in **Settings → AI assistant**. Choose a **Backup folder** in **Settings → Data & backups** to protect your Articles.

Skladno stores Articles and Draft checkpoints on your computer. AI requests need an internet connection and send the relevant Article text and context to the provider you choose. The provider's data policies and pricing apply.

On Windows, see [Windows preview update recovery](update-recovery.md) for update controls and recovery. On Debian, install updates with your package manager or by installing the newer `.deb` package.
