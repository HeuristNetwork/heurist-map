/**
 * deploy-heurist-map.mjs - Publish the built heurist-map distribution to Heurist support files.
 *
 * The destination root is supplied by HEURIST_CLIENT_DIST_ROOT and defaults to the
 * reference-server support directory. The deploy is staged before replacing the
 * previous module directory, so a failed copy does not leave an empty deployment.
 */

import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleName = 'heurist-map';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(projectDirectory, 'dist');
const distributionRoot = process.env.HEURIST_CLIENT_DIST_ROOT ||
    //'/var/www/html/HEURIST/heurist/hclient/bundles';
    'C:/xampp/htdocs/heurist/hclient/bundles/';
    //'/var/www/html/HEURIST/HEURIST_SUPPORT/external_h5';
const destinationDirectory = path.join(distributionRoot, moduleName);
const stagingDirectory = `${destinationDirectory}.new-${process.pid}`;
const previousDirectory = `${destinationDirectory}.old-${process.pid}`;

async function verifyBuildDirectory() {
    const info = await stat(sourceDirectory).catch(() => null);
    if (!info?.isDirectory()) {
        throw new Error(`Build output directory does not exist: ${sourceDirectory}`);
    }

    const files = await readdir(sourceDirectory);
    if (!files.includes('heurist-map.js')) {
        throw new Error(`Build output does not contain heurist-map.js: ${sourceDirectory}`);
    }
    if (!files.includes('heurist-map-main.css')) {
        throw new Error(`Build output does not contain heurist-map-main.css: ${sourceDirectory}`);
    }
}

function productionFilter(source) {
    return true; //!source.endsWith('.map');
}

async function deploy() {
    await verifyBuildDirectory();
    await mkdir(distributionRoot, { recursive: true });
    await rm(stagingDirectory, { recursive: true, force: true });
    await rm(previousDirectory, { recursive: true, force: true });

    await cp(sourceDirectory, stagingDirectory, {
        recursive: true,
        filter: productionFilter
    });

    let hadPrevious = false;
    try {
        await rename(destinationDirectory, previousDirectory);
        hadPrevious = true;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    try {
        await rename(stagingDirectory, destinationDirectory);
    } catch (error) {
        if (hadPrevious) {
            await rename(previousDirectory, destinationDirectory).catch(() => {});
        }
        throw error;
    }

    await rm(previousDirectory, { recursive: true, force: true });
    console.log(`Heurist Map deployed to ${destinationDirectory}`);
}

deploy().catch(async (error) => {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    console.error(error);
    process.exitCode = 1;
});
