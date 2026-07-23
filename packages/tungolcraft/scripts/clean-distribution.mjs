import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const distributionDirectory = path.join(packageDirectory, 'dist')

if (
	path.dirname(distributionDirectory) !== packageDirectory
	|| path.basename(distributionDirectory) !== 'dist'
) {
	throw new Error(`Refusing to clean unexpected path: ${distributionDirectory}`)
}

rmSync(distributionDirectory, { recursive: true, force: true })
