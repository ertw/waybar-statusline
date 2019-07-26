# Generates a status line for Sway waybar

## Dev environment

### Build Requirements

* Node
* TypeScript
* NixOS (probably?)

### Tested on

* NixOS 19.03
* Node v8.15.1
* npm  6.4.1

### Installing and running

1. Clone Repo
1. Run `npm i`
1. Run `npm run watch`
1. Run `npm run start` to view output

### Publishing

Add the executable to your waybar config:

```text
# ~/.config.sway

bar {
    status_command node /path/to/statusline.js
    # ...
}
```

### Node Packages

|Package Name|Purpose|
|------------|-------|
|moment|easy date formatting|

---

## Troubleshooting

---
