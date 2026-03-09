import { LspLanguageDetector } from './packages/core/src/lsp/LspLanguageDetector.js';
import { WorkspaceContext } from './packages/core/src/utils/workspaceContext.js';
import { FileDiscoveryService } from './packages/core/src/services/fileDiscoveryService.js';
import * as path from 'path';

async function test() {
    const workspaceRoot = process.cwd(); // moli-code root
    const workspaceContext = new WorkspaceContext(workspaceRoot, [workspaceRoot]);
    const fileDiscoveryService = new FileDiscoveryService(workspaceRoot);

    const detector = new LspLanguageDetector(workspaceContext, fileDiscoveryService);
    const detected = await detector.detectLanguages();

    console.log("Detected languages from root:", detected);
    console.log("Is 'c' detected?:", detected.includes('c'));
    console.log("Is 'cpp' detected?:", detected.includes('cpp'));
}

test().catch(console.error);
