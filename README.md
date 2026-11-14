# Claude Buddy

Claude Buddy is a tiny pixel-art Claude who lives on your desktop. He walks around your screen, and when you want to chat, click him and type. He sends your message to Claude Code, the same tool you may already use in a terminal, and answers right in a speech bubble.

There is no API key to set up. Claude Buddy uses the copy of Claude Code already installed on your computer.

## What you need

- Node.js 18 or newer
- Claude Code installed, and signed in once. Open a terminal and run:

```bash
claude
```

Follow the prompts to sign in, then you can close it. If you can chat with Claude in the terminal, Claude Buddy can too.

## Run it

From the `claude-buddy` folder, install the dependencies once:

```bash
npm install
```

Then start the buddy:

```bash
npm start
```

## How to use it

- **Chat:** Click him to open a speech bubble, then type and press Enter. Press Shift+Enter for a new line.
- **Close the bubble:** Press Esc, or click the close button.
- **Move him:** Click and drag him anywhere on the screen.
- **Menu:** Right-click him to open the menu. From there you can Customize him (name, color, hat, accessory, size, speed, behavior, window layer, and noises), put him to nap, call him over with "Come here!", turn on Follow my cursor, switch Stay above other windows, toggle Noises, or start a New conversation.
- **Follow cursor:** Pick "Follow cursor" as his behavior and he trots after your mouse, stopping just beside it.
- **Above or behind windows:** "Above windows" keeps him on top of everything. "Behind windows" makes him a normal window, so your other windows cover him; click him to bring him forward.
- **Claude noises:** He chirps, boops, babbles while he answers, snores when he naps, and dings when a reply finishes while his bubble is closed. Turn noises on or off, set the volume, and pick a Squeaky, Normal, or Deep voice.
- **Quit:** Choose Quit from the right-click menu, from the tray or menu bar icon, or press Cmd+Q on Mac or Ctrl+Q on Windows and Linux.

## Build an installer

You can package Claude Buddy as a standalone app. Build on the operating system you are targeting, since each one makes its own kind of file. The result goes in the `dist/` folder.

On a Mac, to make a `.dmg`:

```bash
npm run dist:mac
```

On Windows, to make an `.exe` installer:

```bash
npm run dist:win
```

On Linux, to make an `AppImage`:

```bash
npm run dist:linux
```

## Notes

- **Mac:** The app is not code-signed, so the first time you open it, right-click it and choose Open, then confirm. After that it opens normally.
- **Linux:** Transparency needs a desktop compositor, which most modern desktops already have. On Linux, the small box around him stays clickable, so it can block clicks on whatever is directly behind him.
