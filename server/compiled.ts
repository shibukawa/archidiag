// Entry of the single executable: the same CLI, serving the frontend files embedded at build time.
import { ASSETS } from './assets.generated'
import { run } from './main'

run(process.argv.slice(2), new Map(Object.entries(ASSETS).map(([path, file]) => [path, Bun.file(file)])))
