# Build recordly-gabriel on a Mac

Double-click `build-recordly-gabriel.command` in the project folder, or run:

```sh
npm run build:gabriel
```

The script builds for your Mac's processor and produces a locally signed `recordly-gabriel.app` in `release/gabriel/mac-arm64/` (Apple silicon) or `release/gabriel/mac/` (Intel). Before reporting success, it checks the signature and native tools, then opens the packaged app with a temporary test profile to verify styled text, desktop APIs, and applying sound settings. It closes the test app and removes that profile afterward. Drag the finished app into Applications when you want to install it.

You need Node.js 22 or newer, npm, and Apple's Command Line Tools (`xcode-select --install`). The first build needs an internet connection to download dependencies and runtimes. If the caption engine is not already bundled, the script uses CMake from your computer or downloads it into the project's `.tmp` folder using Python 3 and pip.

The build includes the sounds from the `whooshes` folder. Use **Whoosh volume** in the editor's Zoom panel or **Settings → Motion** to change all zoom sounds from 0–100%; 0% mutes them. The setting is saved with projects, preferences, and presets, and applies to preview playback and MP4 export.

Open **Settings → Sounds** to choose separate effects for small zoom in, small zoom out, large zoom in, and large zoom out. Preview each choice, select **No sound** to disable one kind of transition, or change the magnification threshold that defines a large zoom (2× by default). Connected zooms use the actual change in magnification to choose the sound. Choices are saved with projects, preferences, and presets.

In Settings → Sounds, click **Apply changes** after editing sounds, volume, or the large-zoom threshold. Previews audition your pending choices; playback, exports, and saved settings update when you apply them.

Mouse click sounds follow the recorded button-down events in playback and MP4 exports, including right, middle, and double clicks. **Settings → Sounds** has separate **Whoosh volume** and **Mouse click volume** sliders. Click **Apply changes** to save both; 0% mutes only that effect. Click timing follows clip trims, order, repeated clips, and playback speed. Recordings without click telemetry remain silent. The bundled `src/assets/sounds/mouse-click.wav` is an original synthesized click.
