import { Config, ToolRegistry, NativeLspService, NativeLspClient, LspTool } from '@dobby/moli-code-core';

async function main() {
    const config = new Config({
        targetDir: '/Users/dobby/moli-code/test-project',
    } as any);

    // Mock cli argument parsing effect
    (config as any).lspEnabled = true;

    const lspService = new NativeLspService(
        config as any,
        config.getWorkspaceContext(),
        {} as any, // appEvents mock
        (config as any).getFileService(),
        {} as any, // ideContextStore mock
        {
            workspaceRoot: '/Users/dobby/moli-code/test-project',
            requireTrustedWorkspace: false, // Force trust for test
        }
    );

    await lspService.discoverAndPrepare();
    console.log("Servers prepared:", Array.from((lspService as any).serverManager.serverHandles.keys()));

    const client = new NativeLspClient(lspService);
    config.setLspClient(client);

    const registry = new ToolRegistry(config as any);
    registry.registerTool(new LspTool(config as any));

    if (registry) {
        const lspTool = Array.from((registry as any).tools.values()).find((t: any) => t.name === 'lsp') as unknown as LspTool;
        if (lspTool) {
            console.log("Found LSP Tool, executing documentSymbol on main.c...");

            await lspService.start();
            console.log("READY HANDLES MAP:", (lspService as any).getReadyHandles());
            console.log("Calling notifyFileChanged on test-project/main.c");
            await lspService.notifyFileChanged('test-project/main.c');
            await new Promise(r => setTimeout(r, 1000));
            const handles = (lspService as any).serverManager.serverHandles;
            for (const [name, handle] of handles.entries()) {
                if (name === 'clangd') {
                    const response = await handle.connection.request('textDocument/documentSymbol', {
                        textDocument: { uri: 'file:///Users/dobby/moli-code/test-project/main.c' }
                    });
                    console.log("Raw clangd documentSymbol response:", JSON.stringify(response, null, 2));
                }
            }
        }
    } else {
        console.log("Registry not found");
    }
    await lspService.stop();
}

main().catch(console.error);
