import {
    cp,
    mkdir,
    readdir,
    rm
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(
    fileURLToPath(import.meta.url)
);

const projectDirectory = path.resolve(
    scriptDirectory,
    '..'
);

const sourceDirectory = path.join(
    projectDirectory,
    'dist'
);

/*
 * Adjust this filesystem path to your installation.
 *
 * This is a filesystem path, not a browser URL.
 */
const destinationDirectory =
    'C:/xampp/htdocs/heurist/external/heurist-map';
    //'/var/www/html/heurist/external/heurist-map';

async function verifyBuildDirectory() {
    const files = await readdir(sourceDirectory);

    if (!files.includes('index.html')) {
        throw new Error(
            `Build output does not contain index.html: ${sourceDirectory}`
        );
    }
}

async function deploy() {
    //await verifyBuildDirectory();

    /*
     * Remove only the dedicated heurist-map distribution directory.
     * Never point this at /heurist/external itself.
     */
    await rm(destinationDirectory, {
        recursive: true,
        force: true
    });

    await mkdir(destinationDirectory, {
        recursive: true
    });

    await cp(sourceDirectory, destinationDirectory, {
        recursive: true
    });

    console.log(
        `Heurist Map deployed to ${destinationDirectory}`
    );
}

deploy().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});