# git-ignored-size

See how much space your Git-ignored files use.

```sh
npx git-ignored-size
```

## Install

```sh
npm install -g git-ignored-size
```

Then run:

```sh
gis
```

## Commands

```sh
gis                 # show help
gis .               # scan current repo
gis ../my-repo      # scan another repo
gis json            # print JSON
```

## Example

```txt
 Size  Path
-----  ----
842 MB node_modules
217 MB .next
 14 MB dist

Total: 1.05 GB across 3 ignored entries
```

## License

MIT
