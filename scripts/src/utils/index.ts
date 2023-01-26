import * as path from 'path'
import * as fs from 'fs/promises'

export * as coinmarketcap from './coinmarketcap'

export async function writeFile(name: string, data: string | Buffer): Promise<void> {
  name = `output/${name}`
  const directory = path.dirname(name)
  if (directory) {
    await fs.mkdir(directory, { recursive: true })
  }
  await fs.writeFile(name, data)
}
